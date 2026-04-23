import { PassThrough } from 'stream';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DAPStream } from '../src/dap/protocol';
import type { DAPResponse } from '../src/contracts/dap';

const BODY_ENC = 'utf8' as const;

function frame(obj: unknown): Buffer {
  const body   = JSON.stringify(obj);
  const header = `Content-Length: ${Buffer.byteLength(body, BODY_ENC)}\r\n\r\n`;
  return Buffer.concat([Buffer.from(header, 'ascii'), Buffer.from(body, BODY_ENC)]);
}

function makeResponse(requestSeq: number, success = true): DAPResponse {
  return { seq: 100, type: 'response', request_seq: requestSeq, success, command: 'initialize', body: {} };
}

function makeStreams() {
  const readable = new PassThrough();
  const writable = new PassThrough();
  return { readable, writable };
}

describe('DAPStream', () => {
  describe('sendRequest', () => {
    it('writes a valid Content-Length framed message to writable', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 100);
      const chunks: Buffer[] = [];
      writable.on('data', (c: Buffer) => chunks.push(c));

      // Act — send but don't wait (response won't come)
      const promise = sut.sendRequest('initialize', { clientID: 'test' });

      // Assert written bytes
      await new Promise(r => setImmediate(r));
      const written = Buffer.concat(chunks).toString(BODY_ENC);
      expect(written).toMatch(/^Content-Length: \d+\r\n\r\n/);
      const bodyStart = written.indexOf('\r\n\r\n') + 4;
      const parsed = JSON.parse(written.slice(bodyStart)) as { seq: number; type: string; command: string };
      expect(parsed.type).toBe('request');
      expect(parsed.command).toBe('initialize');
      expect(parsed.seq).toBe(1);

      // Cleanup — reject promise so test doesn't hang
      sut.dispose();
      await promise.catch(() => undefined);
    });

    it('uses incrementing seq numbers for successive requests', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 100);
      const seqs: number[] = [];
      writable.on('data', (c: Buffer) => {
        const text = c.toString(BODY_ENC);
        if (!text.startsWith('Content-Length')) {
          const parsed = JSON.parse(text) as { seq: number };
          seqs.push(parsed.seq);
        }
      });

      // Act
      const p1 = sut.sendRequest('initialize');
      const p2 = sut.sendRequest('launch');
      sut.dispose();
      await Promise.allSettled([p1, p2]);

      // Assert
      expect(seqs).toEqual([1, 2]);
    });

    it('resolves when matching response seq arrives', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 1000);

      // Act
      const promise = sut.sendRequest('initialize');
      readable.push(frame(makeResponse(1)));
      const result = await promise;

      // Assert
      expect(result.request_seq).toBe(1);
      expect(result.success).toBe(true);
    });

    it('rejects when response indicates failure', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 1000);

      // Act
      const promise = sut.sendRequest('initialize');
      const failResponse = { ...makeResponse(1, false), message: 'not supported' };
      readable.push(frame(failResponse));

      // Assert
      await expect(promise).rejects.toThrow('not supported');
    });

    it('rejects after configurable timeout elapses', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 50);

      // Act & Assert
      await expect(sut.sendRequest('initialize')).rejects.toThrow(/timed out/);
    });
  });

  describe('message parsing', () => {
    it('extracts correct JSON body from a framed response', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 1000);
      const promise = sut.sendRequest('next');

      // Act — push full framed response
      readable.push(frame(makeResponse(1)));
      const result = await promise;

      // Assert
      expect(result.command).toBe('initialize');
      expect(result.body).toEqual({});
    });

    it('buffers and parses chunked partial reads correctly', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 1000);
      const promise = sut.sendRequest('next');

      // Act — split the framed message across two chunks
      const full = frame(makeResponse(1));
      const mid  = Math.floor(full.length / 2);
      readable.push(full.slice(0, mid));
      await new Promise(r => setImmediate(r));
      readable.push(full.slice(mid));
      const result = await promise;

      // Assert
      expect(result.success).toBe(true);
    });

    it('parses two back-to-back messages from a single chunk', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 1000);
      const p1 = sut.sendRequest('initialize');
      const p2 = sut.sendRequest('launch');

      // Act — push both responses concatenated
      const combined = Buffer.concat([frame(makeResponse(1)), frame({ ...makeResponse(2), request_seq: 2 })]);
      readable.push(combined);
      const [r1, r2] = await Promise.all([p1, p2]);

      // Assert
      expect(r1.request_seq).toBe(1);
      expect(r2.request_seq).toBe(2);
    });
  });

  describe('event listener', () => {
    it('calls registered handler when matching event is received', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 1000);
      const handler = vi.fn();
      sut.on('stopped', handler);

      // Act
      readable.push(frame({ seq: 5, type: 'event', event: 'stopped', body: { reason: 'breakpoint' } }));
      await new Promise(r => setImmediate(r));

      // Assert
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ reason: 'breakpoint' });
    });

    it('does not call handler registered for a different event', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 1000);
      const handler = vi.fn();
      sut.on('exited', handler);

      // Act
      readable.push(frame({ seq: 6, type: 'event', event: 'terminated', body: {} }));
      await new Promise(r => setImmediate(r));

      // Assert
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('rejects all pending requests on dispose', async () => {
      // Arrange
      const { readable, writable } = makeStreams();
      const sut = new DAPStream(readable, writable, 5000);
      const p1 = sut.sendRequest('initialize');
      const p2 = sut.sendRequest('launch');

      // Act
      sut.dispose();

      // Assert
      await expect(p1).rejects.toThrow('DAPStream disposed');
      await expect(p2).rejects.toThrow('DAPStream disposed');
    });
  });
});

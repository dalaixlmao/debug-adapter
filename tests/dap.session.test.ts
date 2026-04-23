import { describe, it, expect, vi } from 'vitest';
import { DAPSession } from '../src/dap/session';
import type { IDAPClient, DAPEventName, DAPResponse } from '../src/contracts/dap';

function makeResponse(body: unknown = {}): DAPResponse {
  return { seq: 1, type: 'response', request_seq: 1, success: true, command: 'test', body };
}

function makeMockClient(): IDAPClient & { triggerEvent: (name: DAPEventName, body?: unknown) => void } {
  const handlers = new Map<DAPEventName, Array<(body: unknown) => void>>();

  return {
    sendRequest: vi.fn().mockResolvedValue(makeResponse()),
    on(event: DAPEventName, cb: (body: unknown) => void) {
      const list = handlers.get(event) ?? [];
      handlers.set(event, [...list, cb]);
    },
    dispose: vi.fn(),
    triggerEvent(name: DAPEventName, body: unknown = {}) {
      handlers.get(name)?.forEach(h => h(body));
    },
  };
}

describe('DAPSession', () => {
  describe('initialize', () => {
    it('resolves with adapter capabilities when initialized event fires', async () => {
      // Arrange
      const client = makeMockClient();
      const caps = { supportsStepInTargetsRequest: true };
      vi.mocked(client.sendRequest).mockResolvedValueOnce(makeResponse(caps));
      const sut = new DAPSession(client);

      // Act — trigger initialized event after sendRequest resolves
      const promise = sut.initialize();
      await vi.waitFor(() => expect(client.sendRequest).toHaveBeenCalledWith('initialize', expect.any(Object)));
      client.triggerEvent('initialized');
      const result = await promise;

      // Assert
      expect(result).toEqual(caps);
      expect(client.sendRequest).toHaveBeenCalledWith('configurationDone');
    });

    it('sends initialize request with correct clientID and adapterID', async () => {
      // Arrange
      const client = makeMockClient();
      const sut = new DAPSession(client);

      // Act
      const promise = sut.initialize();
      client.triggerEvent('initialized');
      await promise;

      // Assert
      expect(client.sendRequest).toHaveBeenCalledWith('initialize', expect.objectContaining({
        clientID: 'debug-adapter',
        adapterID: 'debug-adapter',
        linesStartAt1: true,
        columnsStartAt1: true,
      }));
    });
  });

  describe('launch', () => {
    it('sends launch request and resolves when stopped event fires', async () => {
      // Arrange
      const client = makeMockClient();
      const sut = new DAPSession(client);

      // Act
      const promise = sut.launch('/app.py', 'python');
      await vi.waitFor(() => expect(client.sendRequest).toHaveBeenCalledWith('launch', expect.any(Object)));
      client.triggerEvent('stopped', { reason: 'entry' });
      await promise;

      // Assert
      expect(client.sendRequest).toHaveBeenCalledWith('launch', { program: '/app.py', stopOnEntry: true });
    });

    it('sends launch request with stopOnEntry true for javascript', async () => {
      // Arrange
      const client = makeMockClient();
      const sut = new DAPSession(client);

      // Act
      const promise = sut.launch('/app.js', 'javascript');
      client.triggerEvent('stopped');
      await promise;

      // Assert
      expect(client.sendRequest).toHaveBeenCalledWith('launch', { program: '/app.js', stopOnEntry: true });
    });
  });

  describe('stepIn', () => {
    it('sends stepIn with threadId=1 and resolves on next stopped event', async () => {
      // Arrange
      const client = makeMockClient();
      const sut = new DAPSession(client);

      // Act
      const promise = sut.stepIn();
      await vi.waitFor(() => expect(client.sendRequest).toHaveBeenCalledWith('stepIn', expect.any(Object)));
      client.triggerEvent('stopped', { reason: 'step' });
      await promise;

      // Assert
      expect(client.sendRequest).toHaveBeenCalledWith('stepIn', { threadId: 1 });
    });
  });

  describe('getStackTrace', () => {
    it('returns stack frames from response body', async () => {
      // Arrange
      const frames = [{ id: 1, name: 'main', line: 10, column: 1 }];
      const client = makeMockClient();
      vi.mocked(client.sendRequest).mockResolvedValueOnce(makeResponse({ stackFrames: frames }));
      const sut = new DAPSession(client);

      // Act
      const result = await sut.getStackTrace(1);

      // Assert
      expect(result).toEqual(frames);
      expect(client.sendRequest).toHaveBeenCalledWith('stackTrace', { threadId: 1 });
    });
  });

  describe('getScopes', () => {
    it('returns scopes from response body', async () => {
      // Arrange
      const scopes = [{ name: 'Locals', variablesReference: 2, expensive: false }];
      const client = makeMockClient();
      vi.mocked(client.sendRequest).mockResolvedValueOnce(makeResponse({ scopes }));
      const sut = new DAPSession(client);

      // Act
      const result = await sut.getScopes(1);

      // Assert
      expect(result).toEqual(scopes);
      expect(client.sendRequest).toHaveBeenCalledWith('scopes', { frameId: 1 });
    });
  });

  describe('getVariables', () => {
    it('returns variables from response body', async () => {
      // Arrange
      const variables = [{ name: 'x', value: '42', variablesReference: 0 }];
      const client = makeMockClient();
      vi.mocked(client.sendRequest).mockResolvedValueOnce(makeResponse({ variables }));
      const sut = new DAPSession(client);

      // Act
      const result = await sut.getVariables(2);

      // Assert
      expect(result).toEqual(variables);
      expect(client.sendRequest).toHaveBeenCalledWith('variables', { variablesReference: 2 });
    });
  });

  describe('disconnect', () => {
    it('sends disconnect with terminateDebuggee true and calls dispose', async () => {
      // Arrange
      const client = makeMockClient();
      const sut = new DAPSession(client);

      // Act
      await sut.disconnect();

      // Assert
      expect(client.sendRequest).toHaveBeenCalledWith('disconnect', { terminateDebuggee: true });
      expect(client.dispose).toHaveBeenCalledOnce();
    });
  });
});

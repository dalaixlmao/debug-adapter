import { Readable, Writable } from 'stream';
import { config } from '../config/config';
import type { DAPResponse, DAPEvent, DAPEventName } from '../contracts/dap';

const HEADER_ENCODING        = 'ascii' as const;
const BODY_ENCODING          = 'utf8' as const;
const HEADER_SEP             = '\r\n\r\n';
const CONTENT_LENGTH_PREFIX  = 'Content-Length: ';

interface PendingRequest {
  readonly resolve: (response: DAPResponse) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export class DAPStream {
  private seq = 1;
  private buffer = '';
  private readonly pending   = new Map<number, PendingRequest>();
  private readonly listeners = new Map<DAPEventName, Array<(body: unknown) => void>>();

  constructor(
    private readonly readable: Readable,
    private readonly writable: Writable,
    private readonly timeoutMs: number = config.DAP_REQUEST_TIMEOUT_MS,
  ) {
    this.readable.on('data', (chunk: Buffer) => this.handleChunk(chunk));
  }

  sendRequest(command: string, args?: unknown): Promise<DAPResponse> {
    const seq  = this.seq++;
    const body = JSON.stringify({ seq, type: 'request', command, arguments: args });
    const header = `${CONTENT_LENGTH_PREFIX}${Buffer.byteLength(body, BODY_ENCODING)}${HEADER_SEP}`;
    this.writable.write(header, HEADER_ENCODING);
    this.writable.write(body, BODY_ENCODING);
    return new Promise<DAPResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`DAP request timed out: ${command} (seq=${seq})`));
      }, this.timeoutMs);
      this.pending.set(seq, { resolve, reject, timer });
    });
  }

  on(event: DAPEventName, callback: (body: unknown) => void): void {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, callback]);
  }

  dispose(): void {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error('DAPStream disposed'));
    }
    this.pending.clear();
    this.listeners.clear();
  }

  private handleChunk(chunk: Buffer): void {
    this.buffer += chunk.toString(BODY_ENCODING);
    this.parseMessages();
  }

  private parseMessages(): void {
    while (true) {
      const sepIdx = this.buffer.indexOf(HEADER_SEP);
      if (sepIdx === -1) break;
      const contentLength = parseContentLength(this.buffer.slice(0, sepIdx));
      if (contentLength === null) break;
      const bodyStart = sepIdx + HEADER_SEP.length;
      if (this.buffer.length < bodyStart + contentLength) break;
      const rawBody = this.buffer.slice(bodyStart, bodyStart + contentLength);
      this.buffer = this.buffer.slice(bodyStart + contentLength);
      this.dispatchMessage(rawBody);
    }
  }

  private dispatchMessage(rawBody: string): void {
    let message: unknown;
    try { message = JSON.parse(rawBody); } catch { return; }
    if (!isDAPMessage(message)) return;
    if (message.type === 'response') {
      this.handleResponse(message as DAPResponse);
    } else if (message.type === 'event') {
      this.handleEvent(message as DAPEvent);
    }
  }

  private handleResponse(response: DAPResponse): void {
    const pending = this.pending.get(response.request_seq);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(response.request_seq);
    if (response.success) {
      pending.resolve(response);
    } else {
      pending.reject(new Error(response.message ?? 'DAP request failed'));
    }
  }

  private handleEvent(event: DAPEvent): void {
    const handlers = this.listeners.get(event.event as DAPEventName);
    handlers?.forEach(h => h(event.body));
  }
}

function parseContentLength(header: string): number | null {
  const line = header.split('\r\n').find(l => l.startsWith(CONTENT_LENGTH_PREFIX));
  if (!line) return null;
  const value = parseInt(line.slice(CONTENT_LENGTH_PREFIX.length), 10);
  return isNaN(value) ? null : value;
}

function isDAPMessage(value: unknown): value is { type: string } {
  return typeof value === 'object' && value !== null && 'type' in value && 'seq' in value;
}

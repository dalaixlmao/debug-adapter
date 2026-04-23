export type DAPEventName = 'stopped' | 'terminated' | 'exited' | 'output';

export interface DAPMessage {
  readonly seq: number;
  readonly type: 'request' | 'response' | 'event';
}

export interface DAPRequest extends DAPMessage {
  readonly type: 'request';
  readonly command: string;
  readonly arguments?: unknown;
}

export interface DAPResponse extends DAPMessage {
  readonly type: 'response';
  readonly request_seq: number;
  readonly success: boolean;
  readonly command: string;
  readonly message?: string;
  readonly body?: unknown;
}

export interface DAPEvent extends DAPMessage {
  readonly type: 'event';
  readonly event: string;
  readonly body?: unknown;
}

export interface IDAPClient {
  sendRequest(command: string, args?: unknown): Promise<DAPResponse>;
  on(event: DAPEventName, callback: (body: unknown) => void): void;
  dispose(): void;
}

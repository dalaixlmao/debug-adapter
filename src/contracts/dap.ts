export type DAPEventName = 'initialized' | 'stopped' | 'terminated' | 'exited' | 'output';

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

export type AdapterType = 'python' | 'javascript';

export interface DAPCapabilities {
  readonly supportsStepInTargetsRequest?: boolean;
  readonly supportTerminateDebuggee?: boolean;
  readonly supportsConfigurationDoneRequest?: boolean;
}

export interface DAPStackFrame {
  readonly id: number;
  readonly name: string;
  readonly line: number;
  readonly column: number;
  readonly source?: { readonly path?: string };
}

export interface DAPScope {
  readonly name: string;
  readonly variablesReference: number;
  readonly expensive: boolean;
}

export interface DAPVariable {
  readonly name: string;
  readonly value: string;
  readonly type?: string;
  readonly variablesReference: number;
}

export interface IDAPSession {
  initialize(): Promise<DAPCapabilities>;
  launch(filePath: string, adapterType: AdapterType): Promise<void>;
  stepIn(): Promise<void>;
  getStackTrace(threadId: number): Promise<DAPStackFrame[]>;
  getScopes(frameId: number): Promise<DAPScope[]>;
  getVariables(variablesReference: number): Promise<DAPVariable[]>;
  disconnect(): Promise<void>;
}

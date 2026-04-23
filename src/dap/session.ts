import type {
  IDAPClient,
  IDAPSession,
  AdapterType,
  DAPCapabilities,
  DAPStackFrame,
  DAPScope,
  DAPVariable,
  DAPEventName,
} from '../contracts/dap';
import { DAP_SESSION_CLIENT_ID, DAP_SESSION_ADAPTER_ID, DAP_DEFAULT_THREAD_ID } from '../config/config';

export class DAPSession implements IDAPSession {
  constructor(private readonly client: IDAPClient) {}

  async initialize(): Promise<DAPCapabilities> {
    const initializedPromise = this.waitForEvent('initialized');
    const response = await this.client.sendRequest('initialize', {
      clientID: DAP_SESSION_CLIENT_ID,
      adapterID: DAP_SESSION_ADAPTER_ID,
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path',
    });
    await initializedPromise;
    await this.client.sendRequest('configurationDone');
    return (response.body ?? {}) as DAPCapabilities;
  }

  async launch(filePath: string, adapterType: AdapterType): Promise<void> {
    const stoppedPromise = this.waitForEvent('stopped');
    await this.client.sendRequest('launch', buildLaunchArgs(filePath, adapterType));
    await stoppedPromise;
  }

  async stepIn(): Promise<void> {
    const stoppedPromise = this.waitForEvent('stopped');
    await this.client.sendRequest('stepIn', { threadId: DAP_DEFAULT_THREAD_ID });
    await stoppedPromise;
  }

  async getStackTrace(threadId: number): Promise<DAPStackFrame[]> {
    const response = await this.client.sendRequest('stackTrace', { threadId });
    return (response.body as { stackFrames: DAPStackFrame[] }).stackFrames;
  }

  async getScopes(frameId: number): Promise<DAPScope[]> {
    const response = await this.client.sendRequest('scopes', { frameId });
    return (response.body as { scopes: DAPScope[] }).scopes;
  }

  async getVariables(variablesReference: number): Promise<DAPVariable[]> {
    const response = await this.client.sendRequest('variables', { variablesReference });
    return (response.body as { variables: DAPVariable[] }).variables;
  }

  async disconnect(): Promise<void> {
    await this.client.sendRequest('disconnect', { terminateDebuggee: true });
    this.client.dispose();
  }

  private waitForEvent(eventName: DAPEventName): Promise<void> {
    return new Promise<void>((resolve) => {
      this.client.on(eventName, () => resolve());
    });
  }
}

function buildLaunchArgs(filePath: string, adapterType: AdapterType): Record<string, unknown> {
  if (adapterType === 'python') {
    return { program: filePath, stopOnEntry: true };
  }
  return { program: filePath, stopOnEntry: true };
}

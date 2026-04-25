import type {
  IDAPClient,
  IDAPSession,
  AdapterType,
  DAPCapabilities,
  DAPStackFrame,
  DAPScope,
  DAPVariable,
  DAPEventName,
  StepOutcome,
} from '../contracts/dap';
import { DAP_SESSION_CLIENT_ID, DAP_SESSION_ADAPTER_ID, DAP_DEFAULT_THREAD_ID, config } from '../config/config';

export class DAPSession implements IDAPSession {
  constructor(private readonly client: IDAPClient) {}

  async initialize(): Promise<DAPCapabilities> {
    const response = await this.client.sendRequest('initialize', {
      clientID: DAP_SESSION_CLIENT_ID,
      adapterID: DAP_SESSION_ADAPTER_ID,
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path',
    });
    return (response.body ?? {}) as DAPCapabilities;
  }

  async launch(filePath: string, adapterType: AdapterType): Promise<void> {
    const initializedPromise = this.waitForEvent('initialized');
    const stoppedPromise     = this.waitForEvent('stopped');
    // Don't await launch yet — debugpy responds to it only AFTER configurationDone
    const launchPromise = this.client.sendRequest('launch', buildLaunchArgs(filePath, adapterType));
    await initializedPromise;
    await this.client.sendRequest('configurationDone');
    await Promise.all([launchPromise, stoppedPromise]);
  }

  async stepIn(): Promise<StepOutcome> {
    const outcome = this.raceStoppedOrTerminated();
    await this.client.sendRequest('stepIn', { threadId: DAP_DEFAULT_THREAD_ID });
    return outcome;
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

  private raceStoppedOrTerminated(): Promise<StepOutcome> {
    return this.withEventTimeout<StepOutcome>((resolve, _reject) => {
      this.client.on('stopped', () => resolve('stopped'));
      this.client.on('terminated', () => resolve('terminated'));
    }, 'stopped or terminated');
  }

  private waitForEvent(eventName: DAPEventName): Promise<void> {
    return this.withEventTimeout<void>((resolve) => {
      this.client.on(eventName, () => resolve());
    }, eventName);
  }

  private withEventTimeout<T>(
    register: (resolve: (value: T) => void, reject: (err: Error) => void) => void,
    label: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for DAP event: ${label}`));
      }, config.DAP_REQUEST_TIMEOUT_MS);
      register(
        (value) => { clearTimeout(timer); resolve(value); },
        (err)   => { clearTimeout(timer); reject(err); },
      );
    });
  }
}

function buildLaunchArgs(filePath: string, adapterType: AdapterType): Record<string, unknown> {
  if (adapterType === 'python') {
    return { program: filePath, stopOnEntry: true };
  }
  return { program: filePath, stopOnEntry: true };
}

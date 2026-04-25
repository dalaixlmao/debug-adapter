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

const log = (msg: string, data?: unknown) =>
  console.error(`[DAPSession] ${msg}`, data !== undefined ? JSON.stringify(data) : '');

export class DAPSession implements IDAPSession {
  constructor(private readonly client: IDAPClient) {}

  async initialize(): Promise<DAPCapabilities> {
    log('sending initialize');
    const response = await this.client.sendRequest('initialize', {
      clientID: DAP_SESSION_CLIENT_ID,
      adapterID: DAP_SESSION_ADAPTER_ID,
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path',
    });
    log('initialize response received');
    return (response.body ?? {}) as DAPCapabilities;
  }

  async launch(filePath: string, adapterType: AdapterType): Promise<void> {
    log('sending launch', { filePath, adapterType });
    // debugpy sends 'initialized' event after launch (not after initialize)
    const initializedPromise = this.waitForEvent('initialized');
    const stoppedPromise     = this.waitForEvent('stopped');
    await this.client.sendRequest('launch', buildLaunchArgs(filePath, adapterType));
    log('launch response received, waiting for initialized event');
    await initializedPromise;
    log('initialized event received, sending configurationDone');
    await this.client.sendRequest('configurationDone');
    log('configurationDone response received, waiting for stopped event');
    await stoppedPromise;
    log('stopped event received — program paused at entry');
  }

  async stepIn(): Promise<StepOutcome> {
    log('sending stepIn');
    const outcome = this.raceStoppedOrTerminated();
    await this.client.sendRequest('stepIn', { threadId: DAP_DEFAULT_THREAD_ID });
    const result = await outcome;
    log('stepIn outcome', result);
    return result;
  }

  async getStackTrace(threadId: number): Promise<DAPStackFrame[]> {
    log('sending stackTrace', { threadId });
    const response = await this.client.sendRequest('stackTrace', { threadId });
    const frames = (response.body as { stackFrames: DAPStackFrame[] }).stackFrames;
    log('stackTrace response', { frameCount: frames.length });
    return frames;
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
    log('sending disconnect');
    await this.client.sendRequest('disconnect', { terminateDebuggee: true });
    this.client.dispose();
    log('disconnected');
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

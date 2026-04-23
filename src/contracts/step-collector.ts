import type { IDAPSession } from './dap';

export interface StepFrame {
  readonly line: number;
  readonly variables: Record<string, unknown>;
}

export interface IStepCollector {
  collect(session: IDAPSession, filePath: string): Promise<StepFrame[]>;
}

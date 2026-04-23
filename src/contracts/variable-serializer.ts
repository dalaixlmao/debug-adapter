import type { DAPVariable } from './dap';

export type JsonSafeValue = string | number | boolean | null;

export interface IVariableSerializer {
  serialize(variable: DAPVariable): JsonSafeValue;
}

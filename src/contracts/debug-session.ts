import type { StepFrame } from './step-collector';

export interface DebugResponse {
  readonly steps: StepFrame[];
  readonly truncated: boolean;
  readonly total_steps: number;
  readonly execution_time_ms: number;
}

export interface BuildResponseOptions {
  readonly steps: StepFrame[];
  readonly startTime: bigint;
  readonly truncated: boolean;
}

export interface IResponseBuilder {
  build(options: BuildResponseOptions): DebugResponse;
}

export interface StartSessionRequest {
  readonly language: 'node' | 'python'
  readonly programPath: string
  readonly args?: string[]
  readonly stopOnEntry?: boolean
}

export interface StartSessionResponse {
  readonly sessionId: string
  readonly status: 'started' | 'failed'
  readonly error?: string
}

export interface DebugRequestOptions {
  readonly timeout_ms?: number
  readonly max_steps?: number
}

export interface DebugRequest {
  readonly language: string
  readonly code: string
  readonly options?: DebugRequestOptions
}

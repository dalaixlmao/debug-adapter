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

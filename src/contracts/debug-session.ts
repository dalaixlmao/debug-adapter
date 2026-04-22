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

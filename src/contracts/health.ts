export interface HealthResponse {
  readonly status: string
  readonly active_sessions: number
  readonly version: string
}

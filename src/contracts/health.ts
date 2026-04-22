export interface HealthResponse {
  readonly status: string
  readonly activeSessions: number
  readonly version: string
}

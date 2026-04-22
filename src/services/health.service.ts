import type { HealthResponse } from '../contracts';

export interface IHealthService {
  getHealth(version: string): HealthResponse
}

export class HealthService implements IHealthService {
  getHealth(version: string): HealthResponse {
    return {
      status: 'ok',
      active_sessions: 0,
      version,
    }
  }
}

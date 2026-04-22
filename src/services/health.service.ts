import type { HealthResponse } from '../contracts';

export interface IHealthService {
  getHealth(version: string): HealthResponse
}

export class HealthService implements IHealthService {
  getHealth(version: string): HealthResponse {
    return {
      status: 'ok',
      activeSessions: 0,
      version,
    }
  }
}

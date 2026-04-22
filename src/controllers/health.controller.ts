import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IHealthService } from '../services/health.service';

export class HealthController {
  constructor(private readonly healthService: IHealthService, private readonly version: string) {}

  async getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = this.healthService.getHealth(this.version)
    await reply.status(200).send(result)
  }
}

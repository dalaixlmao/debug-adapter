import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '../contracts';
import { HealthController } from '../controllers/health.controller';
import { HealthService } from '../services/health.service';

export const healthRoutes: FastifyPluginAsync<{ version: string }> = async (app, options) => {
  const controller = new HealthController(new HealthService(), options.version)

  app.get<{ Reply: HealthResponse }>(
    '/v1/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              active_sessions: { type: 'number' },
              version: { type: 'string' },
            },
            required: ['status', 'active_sessions', 'version'],
            additionalProperties: false,
          },
        },
      },
    },
    controller.getHealth.bind(controller)
  );
};

import type { FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '../contracts';
import { healthController } from '../container';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>(
    '/v1/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              activeSessions: { type: 'number' },
              version: { type: 'string' },
            },
            required: ['status', 'activeSessions', 'version'],
            additionalProperties: false,
          },
        },
      },
    },
    healthController.getHealth.bind(healthController)
  );
};

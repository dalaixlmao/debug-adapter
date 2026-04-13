import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync<{ version: string }> = async (app, options) => {
  app.get(
    '/health',
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
    async () => ({
      status: 'ok',
      active_sessions: 0,
      version: options.version,
    })
  );
};

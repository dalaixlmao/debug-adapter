import type { FastifyPluginAsync } from 'fastify';

export const debugRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/debug',
    {
      schema: {
        response: {
          415: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
                required: ['code', 'message'],
                additionalProperties: false,
              },
            },
            required: ['error'],
            additionalProperties: false,
          },
          501: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
                required: ['code', 'message'],
                additionalProperties: false,
              },
            },
            required: ['error'],
            additionalProperties: false,
          },
        },
      },
      preValidation: async (request, reply) => {
        const contentType = request.headers['content-type'];

        if (!contentType || !contentType.includes('application/json')) {
          return reply.status(415).send({
            error: {
              code: 'UNSUPPORTED_MEDIA_TYPE',
              message: 'Unsupported Media Type',
            },
          });
        }
      },
    },
    async (request, reply) => {
      return reply.status(501).send({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Coming soon',
        },
      });
    }
  );
};

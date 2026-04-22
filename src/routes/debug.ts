import type { FastifyPluginAsync } from 'fastify';
import type { ErrorResponse } from '../contracts';

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
    requestId: { type: 'string' },
  },
  required: ['error', 'code'],
  additionalProperties: false,
} as const;

export const debugRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Reply: ErrorResponse }>(
    '/v1/debug',
    {
      schema: {
        response: {
          415: errorResponseSchema,
          501: errorResponseSchema,
        },
      },
      preValidation: async (request, reply) => {
        const contentType = request.headers['content-type'];

        if (!contentType || !contentType.includes('application/json')) {
          return reply.status(415).send({
            error: 'Unsupported Media Type',
            code: 'UNSUPPORTED_MEDIA_TYPE',
          });
        }
      },
    },
    async (_request, reply) => {
      return reply.status(501).send({
        error: 'Coming soon',
        code: 'NOT_IMPLEMENTED',
      });
    }
  );
};

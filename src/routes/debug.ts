import type { FastifyPluginAsync, FastifyError } from 'fastify';
import type { ErrorResponse, DebugRequest } from '../contracts';
import { debugController } from '../container';
import { ErrorCode } from '../errors';

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

const debugBodySchema = {
  type: 'object',
  properties: {
    language: { type: 'string' },
    code: { type: 'string' },
    options: {
      type: 'object',
      properties: {
        timeout_ms: { type: 'integer', minimum: 1000, maximum: 60000 },
        max_steps: { type: 'integer', minimum: 1, maximum: 50000 },
      },
      additionalProperties: false,
    },
  },
  required: ['language', 'code'],
  additionalProperties: true,
} as const;

export const debugRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: error.message,
        code: ErrorCode.INVALID_REQUEST,
      });
    }
    if (error.statusCode === 415) {
      return reply.status(415).send({
        error: 'Unsupported Media Type',
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }
    throw error;
  });

  app.post<{ Body: DebugRequest; Reply: ErrorResponse }>(
    '/v1/debug',
    {
      schema: {
        body: debugBodySchema,
        response: {
          400: errorResponseSchema,
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
    debugController.startSession.bind(debugController)
  );
};

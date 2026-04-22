import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DebugRequest } from '../contracts';
import { SUPPORTED_LANGUAGES } from '../config/config';
import { ErrorCode } from '../errors';

export class DebugController {
  async startSession(request: FastifyRequest<{ Body: DebugRequest }>, reply: FastifyReply): Promise<void> {
    const { language } = request.body;

    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
      return reply.status(400).send({
        error: `Unsupported language "${language}". Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
        code: ErrorCode.UNSUPPORTED_LANGUAGE,
      });
    }

    if (request.body.code.trim().length === 0) {
      return reply.status(400).send({
        error: 'Code must not be empty or whitespace-only',
        code: ErrorCode.EMPTY_CODE,
      });
    }

    await reply.status(501).send({
      error: 'Coming soon',
      code: 'NOT_IMPLEMENTED',
    });
  }
}

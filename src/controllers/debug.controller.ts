import type { FastifyReply, FastifyRequest } from 'fastify';

export class DebugController {
  async startSession(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply.status(501).send({
      error: 'Coming soon',
      code: 'NOT_IMPLEMENTED',
    })
  }
}

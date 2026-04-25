import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/server';
import { DebugController } from '../../src/controllers/debug.controller';
import { ResponseBuilder } from '../../src/services/response-builder';
import { StepCollector } from '../../src/services/step-collector';
import type { IDAPSession } from '../../src/contracts';
import type { StepOutcome } from '../../src/contracts/dap';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DebugRequest } from '../../src/contracts';
import {
  unsupportedMediaTypeContract,
  debugResponseContract,
  unsupportedLanguageContract,
  invalidRequestContract,
  emptyCodeContract,
} from './debug.contract';

function makeMockSession(): IDAPSession {
  return {
    initialize: vi.fn().mockResolvedValue({}),
    launch: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    stepIn: vi.fn().mockResolvedValue('terminated' satisfies StepOutcome),
    getStackTrace: vi.fn().mockResolvedValue([]),
    getScopes: vi.fn().mockResolvedValue([]),
    getVariables: vi.fn().mockResolvedValue([]),
  };
}

function buildReply(): { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  const reply = { status: vi.fn(), send: vi.fn() };
  reply.status.mockReturnValue(reply);
  reply.send.mockResolvedValue(undefined);
  return reply;
}

describe('POST /v1/debug contract', () => {
  beforeAll(async () => { await app.ready(); });
  afterAll(async () => { await app.close(); });

  describe('success response contract', () => {
    it('response matches debug response contract when valid code is processed', async () => {
      // Arrange — controller with mocked pipeline deps
      const session = makeMockSession();
      const controller = new DebugController(
        new StepCollector(),
        new ResponseBuilder(),
        () => ({ stdin: {} as never, stdout: {} as never, kill: vi.fn(), getStderr: () => '', process: {} as never }),
        () => session,
      );
      const request = { body: { language: 'python', code: 'x = 1' } } as FastifyRequest<{ Body: DebugRequest }>;
      const reply = buildReply();

      // Act
      await controller.startSession(request, reply as unknown as FastifyReply);

      // Assert
      expect(reply.status).toHaveBeenCalledWith(200);
      expect(reply.send.mock.calls[0]?.[0]).toMatchObject(debugResponseContract);
    });
  });

  describe('error response contracts (via HTTP)', () => {
    it('response matches unsupported media type contract when content-type is text/plain', async () => {
      // Arrange
      const request = {
        method: 'POST' as const,
        url: '/v1/debug',
        headers: { 'content-type': 'text/plain' },
        payload: 'plain text',
      };

      // Act
      const response = await app.inject(request);

      // Assert
      expect(response.statusCode).toBe(415);
      expect(JSON.parse(response.payload)).toEqual(unsupportedMediaTypeContract);
    });

    it('response matches unsupported language contract when language is not in supported set', async () => {
      // Arrange
      const request = {
        method: 'POST' as const,
        url: '/v1/debug',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ language: 'rust', code: 'fn main() {}' }),
      };

      // Act
      const response = await app.inject(request);

      // Assert
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toMatchObject(unsupportedLanguageContract);
    });

    it('response matches invalid request contract when required field is missing', async () => {
      // Arrange
      const request = {
        method: 'POST' as const,
        url: '/v1/debug',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ code: 'let x = 1' }),
      };

      // Act
      const response = await app.inject(request);

      // Assert
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toMatchObject(invalidRequestContract);
    });

    it('response matches empty code contract when code is whitespace-only', async () => {
      // Arrange
      const request = {
        method: 'POST' as const,
        url: '/v1/debug',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ language: 'python', code: '   ' }),
      };

      // Act
      const response = await app.inject(request);

      // Assert
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toMatchObject(emptyCodeContract);
    });
  });
});

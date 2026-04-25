import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebugController } from '../src/controllers/debug.controller';
import { ResponseBuilder } from '../src/services/response-builder';
import { AppError, ErrorCode } from '../src/errors';
import type { IStepCollector, IDAPSession, AdapterHandle } from '../src/contracts';
import type { StepOutcome } from '../src/contracts/dap';
import type { AdapterFactory, SessionFactory } from '../src/controllers/debug.controller';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DebugRequest } from '../src/contracts';

function makeMockSession(overrides: Partial<IDAPSession> = {}): IDAPSession {
  return {
    initialize: vi.fn().mockResolvedValue({}),
    launch: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    stepIn: vi.fn().mockResolvedValue('terminated' satisfies StepOutcome),
    getStackTrace: vi.fn().mockResolvedValue([]),
    getScopes: vi.fn().mockResolvedValue([]),
    getVariables: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeMockHandle(_session: IDAPSession): { handle: AdapterHandle; kill: ReturnType<typeof vi.fn> } {
  const kill = vi.fn();
  const handle = { stdin: {} as never, stdout: {} as never, kill, getStderr: () => '', process: {} as never };
  return { handle, kill };
}

function makeMockStepCollector(steps = []): IStepCollector {
  return { collect: vi.fn().mockResolvedValue(steps) };
}

function buildReply(): { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  const reply = { status: vi.fn(), send: vi.fn() };
  reply.status.mockReturnValue(reply);
  reply.send.mockResolvedValue(undefined);
  return reply;
}

function buildRequest(body: Partial<DebugRequest>): FastifyRequest<{ Body: DebugRequest }> {
  return { body } as FastifyRequest<{ Body: DebugRequest }>;
}

describe('DebugController.startSession', () => {
  let session: IDAPSession;
  let handle: AdapterHandle;
  let kill: ReturnType<typeof vi.fn>;
  let stepCollector: IStepCollector;
  let responseBuilder: ResponseBuilder;
  let adapterFactory: AdapterFactory & ReturnType<typeof vi.fn>;
  let sessionFactory: SessionFactory & ReturnType<typeof vi.fn>;
  let controller: DebugController;

  beforeEach(() => {
    session = makeMockSession();
    const mock = makeMockHandle(session);
    handle = mock.handle;
    kill = mock.kill;
    stepCollector = makeMockStepCollector();
    responseBuilder = new ResponseBuilder();
    adapterFactory = vi.fn<AdapterFactory>().mockReturnValue(handle);
    sessionFactory = vi.fn<SessionFactory>().mockReturnValue(session);
    controller = new DebugController(stepCollector, responseBuilder, adapterFactory, sessionFactory);
  });

  describe('language validation', () => {
    it('returns 400 with UNSUPPORTED_LANGUAGE when language is "rust"', async () => {
      // Arrange
      const req = buildRequest({ language: 'rust', code: 'fn main() {}' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCode.UNSUPPORTED_LANGUAGE }));
    });

    it('does not call adapter when language is unsupported', async () => {
      // Arrange
      const req = buildRequest({ language: 'rust', code: 'fn main() {}' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(adapterFactory).not.toHaveBeenCalled();
    });
  });

  describe('empty code validation', () => {
    it('returns 400 with EMPTY_CODE when code is whitespace-only', async () => {
      // Arrange
      const req = buildRequest({ language: 'python', code: '   ' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCode.EMPTY_CODE }));
    });
  });

  describe('code size validation', () => {
    it('returns 400 with CODE_TOO_LARGE when code exceeds 64KB', async () => {
      // Arrange
      const req = buildRequest({ language: 'python', code: 'x'.repeat(65537) });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCode.CODE_TOO_LARGE }));
    });
  });

  describe('happy path', () => {
    it('returns 200 with correct response shape when valid Python code is provided', async () => {
      // Arrange
      const req = buildRequest({ language: 'python', code: 'x = 1' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(reply.status).toHaveBeenCalledWith(200);
      const sent = reply.send.mock.calls[0]?.[0];
      expect(Array.isArray(sent.steps)).toBe(true);
      expect(sent.truncated).toBe(false);
      expect(typeof sent.total_steps).toBe('number');
      expect(typeof sent.execution_time_ms).toBe('number');
    });

    it('sets truncated to false on the response', async () => {
      // Arrange
      const req = buildRequest({ language: 'python', code: 'x = 1' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      const sent = reply.send.mock.calls[0]?.[0];
      expect(sent.truncated).toBe(false);
    });

    it('total_steps equals steps array length', async () => {
      // Arrange
      vi.mocked(stepCollector.collect).mockResolvedValueOnce([
        { line: 1, variables: {} },
        { line: 2, variables: {} },
      ]);
      const req = buildRequest({ language: 'python', code: 'x = 1\ny = 2' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      const sent = reply.send.mock.calls[0]?.[0];
      expect(sent.total_steps).toBe(2);
      expect(sent.steps).toHaveLength(2);
    });

    it('calls initialize then launch then collect then disconnect in order', async () => {
      // Arrange
      const order: string[] = [];
      vi.mocked(session.initialize).mockImplementation(async () => { order.push('initialize'); return {}; });
      vi.mocked(session.launch).mockImplementation(async () => { order.push('launch'); });
      vi.mocked(stepCollector.collect).mockImplementation(async () => { order.push('collect'); return []; });
      vi.mocked(session.disconnect).mockImplementation(async () => { order.push('disconnect'); });
      const req = buildRequest({ language: 'python', code: 'x = 1' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(order).toEqual(['initialize', 'launch', 'collect', 'disconnect']);
    });

    it('kills the adapter handle after successful run', async () => {
      // Arrange
      const req = buildRequest({ language: 'python', code: 'x = 1' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(kill).toHaveBeenCalledOnce();
    });
  });

  describe('pipeline error handling', () => {
    it('returns 500 with ADAPTER_CRASH when adapter throws AppError', async () => {
      // Arrange
      adapterFactory.mockImplementation(() => {
        throw new AppError('adapter failed', ErrorCode.ADAPTER_CRASH);
      });
      const req = buildRequest({ language: 'python', code: 'x = 1' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCode.ADAPTER_CRASH }));
    });

    it('returns 500 with INTERNAL_ERROR when an unknown error is thrown', async () => {
      // Arrange
      vi.mocked(session.initialize).mockRejectedValueOnce(new Error('unexpected'));
      const req = buildRequest({ language: 'python', code: 'x = 1' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ code: ErrorCode.INTERNAL_ERROR }));
    });

    it('kills the adapter handle even when the pipeline throws', async () => {
      // Arrange
      vi.mocked(session.initialize).mockRejectedValueOnce(new Error('crash'));
      const req = buildRequest({ language: 'python', code: 'x = 1' });
      const reply = buildReply();

      // Act
      await controller.startSession(req, reply as unknown as FastifyReply);

      // Assert
      expect(kill).toHaveBeenCalledOnce();
    });
  });
});

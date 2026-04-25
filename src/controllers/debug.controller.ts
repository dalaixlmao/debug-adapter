import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DebugRequest, DebugResponse, IResponseBuilder } from '../contracts';
import type { IStepCollector } from '../contracts';
import type { IDAPSession } from '../contracts';
import type { AdapterHandle } from '../contracts';
import { MAX_CODE_SIZE_BYTES, SUPPORTED_LANGUAGES } from '../config/config';
import { AppError, ErrorCode } from '../errors';
import { createTempFile } from '../services/temp-file';

export type AdapterFactory = (filePath: string) => AdapterHandle;
export type SessionFactory = (handle: AdapterHandle) => IDAPSession;

export class DebugController {
  constructor(
    private readonly stepCollector: IStepCollector,
    private readonly responseBuilder: IResponseBuilder,
    private readonly adapterFactory: AdapterFactory,
    private readonly sessionFactory: SessionFactory,
  ) {}

  async startSession(request: FastifyRequest<{ Body: DebugRequest }>, reply: FastifyReply): Promise<void> {
    const { language, code } = request.body;

    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
      return reply.status(400).send({
        error: `Unsupported language "${language}". Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
        code: ErrorCode.UNSUPPORTED_LANGUAGE,
      });
    }

    if (code.trim().length === 0) {
      return reply.status(400).send({
        error: 'Code must not be empty or whitespace-only',
        code: ErrorCode.EMPTY_CODE,
      });
    }

    const byteLength = Buffer.byteLength(code, 'utf8');
    if (byteLength > MAX_CODE_SIZE_BYTES) {
      return reply.status(400).send({
        error: `Code exceeds 64KB limit (received: ${byteLength} bytes)`,
        code: ErrorCode.CODE_TOO_LARGE,
      });
    }

    const startTime = process.hrtime.bigint();
    const { filePath, cleanup } = await createTempFile(code, language);

    try {
      const response = await this.runDebugPipeline(filePath, startTime);
      return reply.status(200).send(response);
    } catch (err) {
      const appErr = err instanceof AppError ? err : null;
      return reply.status(500).send({
        error: appErr?.message ?? 'Internal error',
        code: appErr?.code ?? ErrorCode.INTERNAL_ERROR,
      });
    } finally {
      await cleanup();
    }
  }

  private async runDebugPipeline(filePath: string, startTime: bigint): Promise<DebugResponse> {
    const handle = this.adapterFactory(filePath);
    try {
      const session = this.sessionFactory(handle);
      await session.initialize();
      await session.launch(filePath, 'python');
      const steps = await this.stepCollector.collect(session, filePath);
      await session.disconnect();
      return this.responseBuilder.build({ steps, startTime, truncated: false });
    } finally {
      handle.kill();
    }
  }
}

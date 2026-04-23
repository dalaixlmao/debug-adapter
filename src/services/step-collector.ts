import type { IDAPSession, DAPStackFrame, DAPScope, DAPVariable } from '../contracts/dap';
import type { StepFrame, IStepCollector } from '../contracts/step-collector';
import { DAP_DEFAULT_THREAD_ID, DAP_LOCAL_SCOPE_NAME, config } from '../config/config';
import { AppError, ErrorCode } from '../errors';

export class StepCollector implements IStepCollector {
  async collect(session: IDAPSession, filePath: string): Promise<StepFrame[]> {
    const steps: StepFrame[] = [];
    let lastLine = -1;
    let stepCount = 0;

    while (stepCount < config.MAX_STEPS) {
      const frame = await extractSourceFrame(session, filePath);

      if (frame !== null && frame.line !== lastLine) {
        const variables = await collectVariables(session, frame.id);
        steps.push({ line: frame.line, variables });
        lastLine = frame.line;
      }

      const outcome = await session.stepIn();
      stepCount++;

      if (outcome === 'terminated') break;
    }

    if (stepCount >= config.MAX_STEPS) {
      throw new AppError('Execution exceeded maximum step limit', ErrorCode.MAX_STEPS_EXCEEDED);
    }

    return steps;
  }
}

async function extractSourceFrame(
  session: IDAPSession,
  filePath: string,
): Promise<DAPStackFrame | null> {
  const frames = await session.getStackTrace(DAP_DEFAULT_THREAD_ID);
  return frames.find(f => f.source?.path === filePath) ?? null;
}

async function collectVariables(
  session: IDAPSession,
  frameId: number,
): Promise<Record<string, unknown>> {
  const scopes = await session.getScopes(frameId);
  const localScope = findLocalScope(scopes);
  if (localScope === null) return {};
  const variables = await session.getVariables(localScope.variablesReference);
  return buildVariableMap(variables);
}

function findLocalScope(scopes: DAPScope[]): DAPScope | null {
  return scopes.find(s => s.name === DAP_LOCAL_SCOPE_NAME) ?? null;
}

function buildVariableMap(variables: DAPVariable[]): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const v of variables) {
    map[v.name] = v.value;
  }
  return map;
}

import type { IResponseBuilder, DebugResponse, BuildResponseOptions } from '../contracts/debug-session';
import { HRTIME_NS_PER_MS } from '../config/config';

export class ResponseBuilder implements IResponseBuilder {
  build({ steps, startTime, truncated }: BuildResponseOptions): DebugResponse {
    return {
      steps,
      truncated,
      total_steps: steps.length,
      execution_time_ms: computeElapsedMs(startTime),
    };
  }
}

function computeElapsedMs(startTime: bigint): number {
  return Number((process.hrtime.bigint() - startTime) / BigInt(HRTIME_NS_PER_MS));
}

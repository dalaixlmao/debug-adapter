export enum ErrorCode {
  INVALID_REQUEST      = 'INVALID_REQUEST',
  UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
  EMPTY_CODE           = 'EMPTY_CODE',
  CODE_TOO_LARGE       = 'CODE_TOO_LARGE',
  SYNTAX_ERROR         = 'SYNTAX_ERROR',
  RUNTIME_ERROR        = 'RUNTIME_ERROR',
  EXECUTION_TIMEOUT    = 'EXECUTION_TIMEOUT',
  MAX_STEPS_EXCEEDED   = 'MAX_STEPS_EXCEEDED',
  TOO_MANY_REQUESTS    = 'TOO_MANY_REQUESTS',
  ADAPTER_CRASH        = 'ADAPTER_CRASH',
  ADAPTER_INIT_TIMEOUT = 'ADAPTER_INIT_TIMEOUT',
  INTERNAL_ERROR       = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(message: string, readonly code: ErrorCode) {
    super(message);
    this.name = 'AppError';
  }
}

import { expect } from 'vitest';

export const unsupportedMediaTypeContract = {
  error: 'Unsupported Media Type',
  code: 'UNSUPPORTED_MEDIA_TYPE',
};

export const notImplementedContract = {
  error: 'Coming soon',
  code: 'NOT_IMPLEMENTED',
};

export const invalidRequestContract = {
  error: expect.any(String),
  code: 'INVALID_REQUEST',
};

export const unsupportedLanguageContract = {
  error: expect.stringMatching(/python.*javascript|javascript.*python/),
  code: 'UNSUPPORTED_LANGUAGE',
};

export const emptyCodeContract = {
  error: expect.any(String),
  code: 'EMPTY_CODE',
};

export const errorResponseContract = {
  error: expect.any(String),
  code: expect.stringMatching(/^[A-Z_]+$/),
};

export const debugResponseContract = {
  steps: expect.any(Array),
  truncated: expect.any(Boolean),
  total_steps: expect.any(Number),
  execution_time_ms: expect.any(Number),
};

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

export const errorResponseContract = {
  error: expect.any(String),
  code: expect.stringMatching(/^[A-Z_]+$/),
};

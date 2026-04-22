import { expect } from 'vitest';

export const healthResponseContract = {
  status: 'ok',
  activeSessions: 0,
  version: expect.any(String),
};

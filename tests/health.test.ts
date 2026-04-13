import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/server';

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Health API', () => {
  it('returns 200 and the expected JSON payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const payload = JSON.parse(response.payload);
    expect(payload).toEqual(
      expect.objectContaining({
        status: 'ok',
      })
    );
    expect(typeof payload.timestamp).toBe('string');
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/server';

describe('Debug API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 501 for POST /v1/debug with JSON body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/debug',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ foo: 'bar' }),
    });

    expect(response.statusCode).toBe(501);
    expect(response.headers['content-type']).toContain('application/json');
    expect(JSON.parse(response.payload)).toEqual({
      error: 'Coming soon',
      code: 'NOT_IMPLEMENTED',
    });
  });

  it('returns 415 for POST /v1/debug with text/plain body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/debug',
      headers: {
        'content-type': 'text/plain',
      },
      payload: 'plain text body',
    });

    expect(response.statusCode).toBe(415);
    expect(JSON.parse(response.payload)).toEqual({
      error: 'Unsupported Media Type',
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('returns 404 for GET /v1/debug', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/debug',
    });

    expect(response.statusCode).toBe(404);
  });
});

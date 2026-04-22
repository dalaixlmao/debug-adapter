import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/server';

describe('Debug API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 501 with NOT_IMPLEMENTED error when POST /v1/debug receives JSON body', async () => {
    // Arrange
    const request = {
      method: 'POST' as const,
      url: '/v1/debug',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ foo: 'bar' }),
    };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(501);
    expect(JSON.parse(response.payload)).toEqual({
      error: 'Coming soon',
      code: 'NOT_IMPLEMENTED',
    });
  });

  it('returns JSON content-type when POST /v1/debug receives JSON body', async () => {
    // Arrange
    const request = {
      method: 'POST' as const,
      url: '/v1/debug',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ foo: 'bar' }),
    };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('returns 415 with UNSUPPORTED_MEDIA_TYPE error when POST /v1/debug receives text/plain body', async () => {
    // Arrange
    const request = {
      method: 'POST' as const,
      url: '/v1/debug',
      headers: { 'content-type': 'text/plain' },
      payload: 'plain text body',
    };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(415);
    expect(JSON.parse(response.payload)).toEqual({
      error: 'Unsupported Media Type',
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('returns 404 when GET /v1/debug is called', async () => {
    // Arrange
    const request = { method: 'GET' as const, url: '/v1/debug' };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(404);
  });
});

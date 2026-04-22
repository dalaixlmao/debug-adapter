import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/server';

describe('Debug API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/debug', () => {
    describe('happy path', () => {
      it('returns 501 with NOT_IMPLEMENTED error when JSON body is sent', async () => {
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

      it('returns JSON content-type when JSON body is sent', async () => {
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
    });

    describe('content-type validation', () => {
      it('returns 415 with UNSUPPORTED_MEDIA_TYPE error when content-type is text/plain', async () => {
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

      it('returns 415 with UNSUPPORTED_MEDIA_TYPE error when content-type header is absent', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          payload: JSON.stringify({ foo: 'bar' }),
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
    });

    describe('edge cases', () => {
      it('returns 415 with UNSUPPORTED_MEDIA_TYPE error when body is empty and content-type is absent', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
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

      it('returns 400 when body is malformed JSON', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: '{bad',
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('GET /v1/debug', () => {
    it('returns 404 when GET /v1/debug is called', async () => {
      // Arrange
      const request = { method: 'GET' as const, url: '/v1/debug' };

      // Act
      const response = await app.inject(request);

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });
});

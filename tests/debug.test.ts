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
      it('returns 501 with NOT_IMPLEMENTED error when valid JSON body is sent', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'python', code: 'print("hi")' }),
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

      it('returns JSON content-type when valid JSON body is sent', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'python', code: 'print("hi")' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.headers['content-type']).toContain('application/json');
      });

      it('ignores extra unknown fields and passes through when body is valid', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'python', code: 'print("hi")', unknown: 'field' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(501);
      });
    });

    describe('body schema validation', () => {
      it('returns 400 with INVALID_REQUEST when language field is missing', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ code: 'let x = 1' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.payload).code).toBe('INVALID_REQUEST');
      });

      it('returns 400 with INVALID_REQUEST when code field is missing', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'typescript' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.payload).code).toBe('INVALID_REQUEST');
      });

      it('returns 400 with INVALID_REQUEST when language is an integer', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 42, code: 'let x = 1' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.payload).code).toBe('INVALID_REQUEST');
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
          payload: JSON.stringify({ language: 'python', code: 'print("hi")' }),
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

    describe('language validation', () => {
      it('returns 400 with UNSUPPORTED_LANGUAGE when language is "rust"', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'rust', code: 'fn main() {}' }),
        };

        // Act
        const response = await app.inject(request);
        const body = JSON.parse(response.payload);

        // Assert
        expect(response.statusCode).toBe(400);
        expect(body.code).toBe('UNSUPPORTED_LANGUAGE');
        expect(body.error).toContain('python');
        expect(body.error).toContain('javascript');
      });

      it('passes language validation when language is "python"', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'python', code: 'print("hi")' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(501);
      });

      it('returns 400 with UNSUPPORTED_LANGUAGE when language is "Python" (case-sensitive)', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'Python', code: 'print("hi")' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.payload).code).toBe('UNSUPPORTED_LANGUAGE');
      });

      it('passes language validation when language is "javascript"', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'javascript', code: 'console.log(1)' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(501);
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

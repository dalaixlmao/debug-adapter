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
      it('returns JSON content-type for error responses', async () => {
        // Arrange — use an unsupported language so the response is immediate (no pipeline)
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'rust', code: 'fn main() {}' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.headers['content-type']).toContain('application/json');
      });

      it('ignores extra unknown fields and does not return 400 when body is valid', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'rust', code: 'fn main() {}', unknown: 'field' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert — schema allows extra fields; rejection is from language validation not schema
        expect(JSON.parse(response.payload).code).not.toBe('INVALID_REQUEST');
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

    });

    describe('empty code validation', () => {
      it('returns 400 with EMPTY_CODE when code is empty string', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'python', code: '' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.payload).code).toBe('EMPTY_CODE');
      });

      it('returns 400 with EMPTY_CODE when code is whitespace-only', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'python', code: ' \n\t ' }),
        };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.payload).code).toBe('EMPTY_CODE');
      });

    });

    describe('code size validation', () => {
      it('returns 400 with CODE_TOO_LARGE when code is 65537 bytes', async () => {
        // Arrange
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'python', code: 'x'.repeat(65537) }),
        };

        // Act
        const response = await app.inject(request);
        const body = JSON.parse(response.payload);

        // Assert
        expect(response.statusCode).toBe(400);
        expect(body.code).toBe('CODE_TOO_LARGE');
        expect(body.error).toContain('65537');
      });

      it('includes actual byte count in error message when code exceeds limit', async () => {
        // Arrange
        const overLimit = 'x'.repeat(70000);
        const request = {
          method: 'POST' as const,
          url: '/v1/debug',
          headers: { 'content-type': 'application/json' },
          payload: JSON.stringify({ language: 'python', code: overLimit }),
        };

        // Act
        const response = await app.inject(request);
        const body = JSON.parse(response.payload);

        // Assert
        expect(body.error).toContain('70000');
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

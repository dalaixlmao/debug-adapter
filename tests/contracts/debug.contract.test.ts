import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/server';
import { unsupportedMediaTypeContract, notImplementedContract, invalidRequestContract, unsupportedLanguageContract } from './debug.contract';

describe('POST /v1/debug contract', () => {
  beforeAll(async () => { await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('response matches not implemented contract when valid JSON body is sent', async () => {
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
    expect(JSON.parse(response.payload)).toEqual(notImplementedContract);
  });

  it('response matches unsupported media type contract when content-type is text/plain', async () => {
    // Arrange
    const request = {
      method: 'POST' as const,
      url: '/v1/debug',
      headers: { 'content-type': 'text/plain' },
      payload: 'plain text',
    };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(415);
    expect(JSON.parse(response.payload)).toEqual(unsupportedMediaTypeContract);
  });

  it('response matches unsupported language contract when language is not in supported set', async () => {
    // Arrange
    const request = {
      method: 'POST' as const,
      url: '/v1/debug',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ language: 'rust', code: 'fn main() {}' }),
    };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toMatchObject(unsupportedLanguageContract);
  });

  it('response matches invalid request contract when required field is missing', async () => {
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
    expect(JSON.parse(response.payload)).toMatchObject(invalidRequestContract);
  });
});

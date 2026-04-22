import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/server';
import { healthResponseContract } from './health.contract';

describe('GET /health contract', () => {
  beforeAll(async () => { await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('response matches health response contract when GET /health is called', async () => {
    // Arrange
    const request = { method: 'GET' as const, url: '/v1/health' };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual(healthResponseContract);
  });
});

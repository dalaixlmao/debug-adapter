import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { app } from '../src/server';

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

describe('Health API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with JSON payload when GET /health is called', async () => {
    // Arrange
    const request = { method: 'GET' as const, url: '/health' };

    // Act
    const response = await app.inject(request);

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const payload = JSON.parse(response.payload);
    expect(payload).toEqual({
      status: 'ok',
      activeSessions: 0,
      version: packageJson.version,
    });
  });
});

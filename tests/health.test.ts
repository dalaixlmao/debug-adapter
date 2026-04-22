import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { app } from '../src/server';

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJsonRaw: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
if (typeof packageJsonRaw !== 'object' || packageJsonRaw === null || !('version' in packageJsonRaw) || typeof (packageJsonRaw as Record<string, unknown>)['version'] !== 'string') {
  throw new Error('package.json is missing a valid version field');
}
const packageJson = packageJsonRaw as { version: string };

describe('Health API', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    describe('happy path', () => {
      it('returns 200 with expected payload when GET /health is called', async () => {
        // Arrange
        const request = { method: 'GET' as const, url: '/v1/health' };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual({
          status: 'ok',
          activeSessions: 0,
          version: packageJson.version,
        });
      });

      it('returns JSON content-type when GET /health is called', async () => {
        // Arrange
        const request = { method: 'GET' as const, url: '/v1/health' };

        // Act
        const response = await app.inject(request);

        // Assert
        expect(response.headers['content-type']).toContain('application/json');
      });
    });
  });
});

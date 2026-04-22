import { readFileSync } from 'fs';
import path from 'path';
import { HealthService } from './services/health.service';
import { HealthController } from './controllers/health.controller';
import { DebugController } from './controllers/debug.controller';

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJsonRaw: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
if (
  typeof packageJsonRaw !== 'object' ||
  packageJsonRaw === null ||
  !('version' in packageJsonRaw) ||
  typeof (packageJsonRaw as Record<string, unknown>)['version'] !== 'string'
) {
  throw new Error('package.json is missing a valid version field')
}
const { version } = packageJsonRaw as { version: string };

const healthService = new HealthService();

export const healthController = new HealthController(healthService, version);
export const debugController = new DebugController();

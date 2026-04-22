import { readFileSync } from 'fs';
import path from 'path';
import Fastify from 'fastify';
import { config } from './config';
import { healthRoutes } from './routes/health';
import { debugRoutes } from './routes/debug';

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJsonRaw: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
if (typeof packageJsonRaw !== 'object' || packageJsonRaw === null || !('version' in packageJsonRaw) || typeof (packageJsonRaw as Record<string, unknown>)['version'] !== 'string') {
  throw new Error('package.json is missing a valid version field')
}
const packageJson = packageJsonRaw as { version: string };

export const app = Fastify({ logger: true });
app.register(healthRoutes, { version: packageJson.version });
app.register(debugRoutes);

export const start = async () => {
  try {
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

import { readFileSync } from 'fs';
import path from 'path';
import Fastify from 'fastify';
import { config } from './config';
import { healthRoutes } from './routes/health';

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

export const app = Fastify({ logger: true });
app.register(healthRoutes, { version: packageJson.version });

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

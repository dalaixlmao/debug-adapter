import Fastify from 'fastify';
import { config } from './config';
import { healthRoutes } from './routes/health';
import { debugRoutes } from './routes/debug';

export const app = Fastify({
  logger: true,
  ajv: { customOptions: { coerceTypes: false } },
});
app.register(healthRoutes);
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

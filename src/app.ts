import Fastify from 'fastify';
import { config } from './config';

const app = Fastify({ logger: true });

app.get('/health', async (_request, reply) => {
  return reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
});

const start = async () => {
  try {
    await app.listen(
      { 
        port: config.PORT, 
        host: config.HOST
      }
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

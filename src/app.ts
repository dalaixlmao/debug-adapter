import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async (_request, reply) => {
  return reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
});

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

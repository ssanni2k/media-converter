import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from '../config/index.js';
import convertRoute from './routes/convert.js';
import statusRoute from './routes/status.js';
import cancelRoute from './routes/cancel.js';
import eventsRoute from './routes/events.js';
import statsRoute from './routes/stats.js';
import statsEventsRoute from './routes/stats-events.js';
import path from 'path';

const fastify = Fastify({
  logger: { level: 'info' },
});

await fastify.register(sensible);
await fastify.register(cors, {
  origin: true,
  credentials: true,
});
await fastify.register(rateLimit, config.limits.rateLimit);
await fastify.register(multipart, {
  limits: {
    fileSize: config.limits.maxFileSize,
    fieldSize: 1024 * 1024,
    fields: 5,
    files: 1,
  },
});

// Serve converted files
await fastify.register(fastifyStatic, {
  root: path.resolve('./data/outputs'),
  prefix: '/outputs/',
  decorateReply: false,
});

await fastify.register(convertRoute);
await fastify.register(statusRoute);
await fastify.register(cancelRoute);
await fastify.register(eventsRoute);
await fastify.register(statsRoute);
await fastify.register(statsEventsRoute);

const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

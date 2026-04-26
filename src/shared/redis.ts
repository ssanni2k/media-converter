import { Redis } from 'ioredis';
import { config } from '../config/index.js';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export default redis;

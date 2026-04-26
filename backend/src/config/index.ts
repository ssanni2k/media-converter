import 'dotenv/config';

const env = (key: string, defaultValue: string): string => process.env[key] || defaultValue;

export const config = {
  port: parseInt(env('PORT', '3000')),
  redis: {
    host: env('REDIS_HOST', 'localhost'),
    port: parseInt(env('REDIS_PORT', '6379')),
  },
  priority: {
    highMaxMb: parseInt(env('PRIORITY_HIGH_MAX_MB', '10')),
    mediumMaxMb: parseInt(env('PRIORITY_MEDIUM_MAX_MB', '50')),
  },
  workers: {
    high: parseInt(env('PRIORITY_HIGH_WORKERS', '2')),
    medium: parseInt(env('PRIORITY_MEDIUM_WORKERS', '1')),
    low: parseInt(env('PRIORITY_LOW_WORKERS', '1')),
  },
  cleanup: {
    interval: '*/5 * * * *',
    maxAgeHours: parseInt(env('FILE_MAX_AGE_HOURS', '24')),
  },
  redisTtlSeconds: 26 * 3600,
  webhook: {
    maxRetries: parseInt(env('WEBHOOK_MAX_RETRIES', '3')),
    baseDelayMs: parseInt(env('WEBHOOK_BASE_DELAY_MS', '1000')),
    timeoutMs: parseInt(env('WEBHOOK_TIMEOUT_MS', '10000')),
  },
  limits: {
    maxFileSizeMb: parseInt(env('MAX_FILE_SIZE_MB', '200')),
    maxFileSize: parseInt(env('MAX_FILE_SIZE_MB', '200')) * 1024 * 1024,
    rateLimit: {
      max: parseInt(env('RATE_LIMIT_MAX', '100')),
      timeWindow: env('RATE_LIMIT_WINDOW', '1 minute'),
    },
  },
};

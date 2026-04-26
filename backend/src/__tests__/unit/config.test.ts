import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('has correct defaults when no env vars are set', async () => {
    delete process.env.PORT;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    const { config } = await import('../../config/index.js');
    expect(config.port).toBe(3000);
    expect(config.redis.host).toBe('localhost');
    expect(config.redis.port).toBe(6379);
  });

  it('reads PORT from env', async () => {
    process.env.PORT = '4000';
    const { config } = await import('../../config/index.js');
    expect(config.port).toBe(4000);
  });

  it('reads REDIS_HOST and REDIS_PORT from env', async () => {
    process.env.REDIS_HOST = 'redis-host';
    process.env.REDIS_PORT = '6380';
    const { config } = await import('../../config/index.js');
    expect(config.redis.host).toBe('redis-host');
    expect(config.redis.port).toBe(6380);
  });

  it('has correct priority defaults', async () => {
    const { config } = await import('../../config/index.js');
    expect(config.priority.highMaxMb).toBe(10);
    expect(config.priority.mediumMaxMb).toBe(50);
  });

  it('computes maxFileSize from maxFileSizeMb', async () => {
    process.env.MAX_FILE_SIZE_MB = '100';
    const { config } = await import('../../config/index.js');
    expect(config.limits.maxFileSizeMb).toBe(100);
    expect(config.limits.maxFileSize).toBe(100 * 1024 * 1024);
  });

  it('has correct webhook defaults', async () => {
    const { config } = await import('../../config/index.js');
    expect(config.webhook.maxRetries).toBe(3);
    expect(config.webhook.baseDelayMs).toBe(1000);
    expect(config.webhook.timeoutMs).toBe(10000);
  });

  it('has correct worker defaults', async () => {
    const { config } = await import('../../config/index.js');
    expect(config.workers.high).toBe(2);
    expect(config.workers.medium).toBe(1);
    expect(config.workers.low).toBe(1);
  });
});

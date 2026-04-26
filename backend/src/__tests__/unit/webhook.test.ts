import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: (() => {
    const store = new Map<string, Record<string, string>>();
    return {
      hset: vi.fn(async (key: string, field: string, value: string) => {
        if (!store.has(key)) store.set(key, {});
        store.get(key)![field] = String(value);
        return 1;
      }),
    };
  })(),
}));

vi.mock('../../shared/redis.js', () => ({
  default: mockRedis,
}));

vi.mock('../../config/index.js', () => ({
  config: {
    webhook: { maxRetries: 3, baseDelayMs: 100, timeoutMs: 5000 },
  },
}));

import { sendWebhook } from '../../worker/webhook.js';

describe('sendWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends POST with correct payload on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await sendWebhook('https://example.com/hook', 'job-1', 'mp3', '/outputs/job-1.mp3');

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/hook', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));

    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.jobId).toBe('job-1');
    expect(body.format).toBe('mp3');
    expect(body.outputUrl).toBe('/outputs/job-1.mp3');
    expect(body.status).toBe('completed');
  });

  it('retries on HTTP error', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const promise = sendWebhook('https://example.com/hook', 'job-1');

    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after max retries and logs error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', mockFetch);

    const promise = sendWebhook('https://example.com/hook', 'job-1');

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(400);
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries (maxRetries=3 means attempts 1,2,3; retries after 1 and 2)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Webhook failed'),
    );
    consoleSpy.mockRestore();
  });

  it('records attempt count to redis on final failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', mockFetch);

    const promise = sendWebhook('https://example.com/hook', 'job-1');

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(400);
    await promise;

    expect(mockRedis.hset).toHaveBeenCalledWith('job:job-1', 'webhookAttempts', expect.any(Number));
    consoleSpy.mockRestore();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getStats, subscribeStatsChanges } from '../../api/statsApi';
import { getLastEventSource, clearEventSources } from '../setup';

describe('getStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns parsed stats', async () => {
    const statsData = {
      total: 10,
      byStatus: { completed: 8, failed: 2 },
      byFormat: { mp3: 5, mp4: 5 },
      queueCount: 0,
      avgProcessingTimeMs: 5000,
      recentJobs: [],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(statsData),
    });

    const result = await getStats();
    expect(result).toEqual(statsData);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/stats');
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    });

    await expect(getStats()).rejects.toThrow('Failed to get stats');
  });
});

describe('subscribeStatsChanges', () => {
  beforeEach(() => {
    clearEventSources();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates EventSource and returns cleanup function', () => {
    const onChange = vi.fn();
    const cleanup = subscribeStatsChanges(onChange);

    const es = getLastEventSource();
    expect(es).toBeDefined();
    expect(es!.url).toContain('/stats/stream');

    cleanup();
    expect(es!.readyState).toBe(2); // CLOSED
  });

  it('calls onChange when message is received', () => {
    const onChange = vi.fn();
    subscribeStatsChanges(onChange);

    const es = getLastEventSource()!;
    es._simulateMessage({});

    expect(onChange).toHaveBeenCalled();
  });
});

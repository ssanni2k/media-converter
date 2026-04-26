import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSchedule } = vi.hoisted(() => ({
  mockSchedule: vi.fn(),
}));

vi.mock('node-cron', () => ({
  default: { schedule: mockSchedule },
}));

vi.mock('../../shared/redis.js', () => ({
  default: {
    hget: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue(['job-1', 'job-2']),
  stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() - 48 * 60 * 60 * 1000 }),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/index.js', () => ({
  config: {
    cleanup: { interval: '*/5 * * * *', maxAgeHours: 24 },
  },
}));

import { startCleanupCron } from '../../cleanup/cron.js';

describe('startCleanupCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a cron schedule with the correct interval', () => {
    startCleanupCron();
    expect(mockSchedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
  });

  it('cleanup callback processes upload and output directories', async () => {
    startCleanupCron();

    const callback = mockSchedule.mock.calls[0][1];
    await callback();

    const { readdir } = await import('fs/promises');
    expect(readdir).toHaveBeenCalledWith('./data/uploads');
    expect(readdir).toHaveBeenCalledWith('./data/outputs');
  });
});

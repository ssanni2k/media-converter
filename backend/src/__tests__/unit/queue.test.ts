import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => {
  const store = new Map<string, Record<string, string>>();
  const lists = new Map<string, string[]>();

  return {
    mockRedis: {
      hset: vi.fn(async (key: string, field: string, value: string) => {
        if (!store.has(key)) store.set(key, {});
        store.get(key)![field] = String(value);
        return 1;
      }),
      hget: vi.fn(async (key: string, field: string) => store.get(key)?.[field] ?? null),
      hgetall: vi.fn(async (key: string) => store.get(key) ?? {}),
      expire: vi.fn(async () => {}),
      keys: vi.fn(async (pattern: string) => {
        const prefix = pattern.replace(/\*/g, '');
        return [...store.keys()].filter(k => k.startsWith(prefix));
      }),
      rpush: vi.fn(async (key: string, value: string) => {
        const list = lists.get(key) ?? [];
        list.push(value);
        lists.set(key, list);
        return list.length;
      }),
      lrange: vi.fn(async (key: string, start: number, stop: number) => {
        const list = lists.get(key) ?? [];
        const end = stop === -1 ? list.length : stop + 1;
        return list.slice(start, end);
      }),
      eval: vi.fn(async () => false),
      publish: vi.fn(async () => 1),
      subscribe: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      on: vi.fn(),
    },
  };
});

vi.mock('../../shared/redis.js', () => ({
  default: mockRedis,
}));

vi.mock('../../shared/pubsub.js', () => ({
  publisher: { publish: vi.fn().mockResolvedValue(1) },
  QUEUE_CHANNELS: {
    high: 'queue:new-job:high',
    medium: 'queue:new-job:medium',
    low: 'queue:new-job:low',
  },
}));

import { addJob, getNextJob, releaseWorkerJobs, removeJob } from '../../shared/queue.js';
import type { JobData } from '../../shared/types.js';

describe('addJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushes serialized QueueItem to Redis list', async () => {
    const data: JobData = {
      jobId: 'job-1',
      inputPath: './data/uploads/job-1/video.mp4',
      outputPath: './data/outputs/job-1/job-1.mp3',
      format: 'mp3',
    };

    await addJob(data, 'high');

    expect(mockRedis.rpush).toHaveBeenCalledWith(
      'queue:jobs',
      expect.stringContaining('"jobId":"job-1"'),
    );
  });

  it('publishes to the correct priority channel', async () => {
    const data: JobData = {
      jobId: 'job-1',
      inputPath: './data/uploads/job-1/video.mp4',
      outputPath: './data/outputs/job-1/job-1.mp3',
      format: 'mp3',
    };

    const { publisher } = await import('../../shared/pubsub.js');
    await addJob(data, 'high');

    expect(publisher.publish).toHaveBeenCalledWith('queue:new-job:high', '1');
  });

  it('sets item status to waiting and assignedWorker to null', async () => {
    const data: JobData = {
      jobId: 'job-1',
      inputPath: './data/uploads/job-1/video.mp4',
      outputPath: './data/outputs/job-1/job-1.mp3',
      format: 'mp3',
    };

    await addJob(data, 'high');

    const pushCall = mockRedis.rpush.mock.calls[0];
    const item = JSON.parse(pushCall[1]);
    expect(item.status).toBe('waiting');
    expect(item.assignedWorker).toBeNull();
  });
});

describe('getNextJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls redis.eval with the correct script', async () => {
    mockRedis.eval.mockResolvedValue(false);

    await getNextJob('high', 'worker-1');

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('LSET'),
      1,
      'queue:jobs',
      'high',
      'worker-1',
    );
  });

  it('returns null when no matching job exists', async () => {
    mockRedis.eval.mockResolvedValue(false);

    const result = await getNextJob('high', 'worker-1');
    expect(result).toBeNull();
  });
});

describe('removeJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls redis.eval with job id', async () => {
    mockRedis.eval.mockResolvedValue(false);

    await removeJob('job-1');

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'queue:jobs',
      'job-1',
    );
  });
});

describe('releaseWorkerJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls redis.eval with worker id', async () => {
    mockRedis.eval.mockResolvedValue(0);

    await releaseWorkerJobs('worker-1');

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'queue:jobs',
      'worker-1',
    );
  });
});

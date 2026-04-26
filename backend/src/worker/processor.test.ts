import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: createMockRedis(),
}));

function createMockRedis() {
  const store = new Map<string, Record<string, string>>();
  return {
    hset: vi.fn(async (key: string, field: string, value: string) => {
      if (!store.has(key)) store.set(key, {});
      store.get(key)![field] = String(value);
      return 1;
    }),
    hgetall: vi.fn(async (key: string) => store.get(key) ?? {}),
    expire: vi.fn(async () => {}),
  };
}

vi.mock('../shared/redis.js', () => ({
  default: mockRedis,
}));

vi.mock('../shared/pubsub.js', () => ({
  publisher: { publish: vi.fn().mockResolvedValue(1) },
  PROGRESS_CHANNEL: 'job-progress',
  STATS_CHANNEL: 'stats-changed',
}));

const mockConvert = vi.fn();
vi.mock('./ffmpeg.js', () => ({
  convert: (...args: any[]) => mockConvert(...args),
}));

const mockSendWebhook = vi.fn();
vi.mock('./webhook.js', () => ({
  sendWebhook: (...args: any[]) => mockSendWebhook(...args),
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
}));

vi.mock('../config/index.js', () => ({
  config: { redisTtlSeconds: 93600 },
}));

import { processJob, setJobStatus, getJobStatus } from './processor.js';
import type { JobData } from '../shared/types.js';

describe('setJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls redis.hset with correct key and fields', async () => {
    await setJobStatus('job-1', { status: 'active', progress: 50 });
    expect(mockRedis.hset).toHaveBeenCalledWith('job:job-1', {
      status: 'active',
      progress: 50,
    });
  });

  it('calls redis.expire with TTL', async () => {
    await setJobStatus('job-1', { status: 'waiting' });
    expect(mockRedis.expire).toHaveBeenCalledWith('job:job-1', 93600);
  });
});

describe('getJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when job not found', async () => {
    mockRedis.hgetall.mockResolvedValue({});
    const result = await getJobStatus('nonexistent');
    expect(result).toBeNull();
  });

  it('returns populated JobStatus when job exists', async () => {
    mockRedis.hgetall.mockResolvedValue({
      status: 'completed',
      progress: '100',
      outputUrl: '/outputs/job-1/job-1.mp3',
      fileName: 'video.mp4',
      targetFormat: 'mp3',
    });

    const result = await getJobStatus('job-1');
    expect(result).toEqual({
      status: 'completed',
      progress: 100,
      outputUrl: '/outputs/job-1/job-1.mp3',
      fileName: 'video.mp4',
      targetFormat: 'mp3',
    });
  });

  it('handles missing optional fields gracefully', async () => {
    mockRedis.hgetall.mockResolvedValue({
      status: 'waiting',
      progress: '0',
    });

    const result = await getJobStatus('job-1');
    expect(result).toEqual({
      status: 'waiting',
      progress: 0,
    });
  });
});

describe('processJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const jobData: JobData = {
    jobId: 'test-job',
    inputPath: './data/uploads/test-job/video.mp4',
    outputPath: './data/outputs/test-job/test-job.mp3',
    format: 'mp3',
  };

  it('sets status to active at start', async () => {
    mockConvert.mockResolvedValue(undefined);

    const promise = processJob(jobData);
    await vi.advanceTimersByTimeAsync(100);

    expect(mockRedis.hset).toHaveBeenCalledWith('job:test-job', expect.objectContaining({
      status: 'active',
    }));

    await vi.runAllTimersAsync();
    await promise;
  });

  it('sets status to completed on successful convert', async () => {
    mockConvert.mockImplementation((_input, _output, _format, onProgress) => {
      onProgress({ jobId: 'test-job', progress: 100, timestamp: Date.now() });
      return Promise.resolve();
    });

    await processJob(jobData);

    expect(mockRedis.hset).toHaveBeenCalledWith('job:test-job', expect.objectContaining({
      status: 'completed',
      progress: 100,
    }));
  });

  it('sets status to failed on convert error', async () => {
    mockConvert.mockRejectedValue(new Error('FFmpeg error'));

    await processJob(jobData);

    expect(mockRedis.hset).toHaveBeenCalledWith('job:test-job', expect.objectContaining({
      status: 'failed',
    }));
  });

  it('calls webhook if webhookUrl is provided', async () => {
    mockConvert.mockResolvedValue(undefined);

    const jobWithWebhook: JobData = { ...jobData, webhookUrl: 'https://example.com/hook' };
    await processJob(jobWithWebhook);

    expect(mockSendWebhook).toHaveBeenCalledWith(
      'https://example.com/hook',
      'test-job',
      'mp3',
      expect.stringContaining('/outputs/'),
    );
  });

  it('does not call webhook if webhookUrl is not provided', async () => {
    mockConvert.mockResolvedValue(undefined);
    await processJob(jobData);
    expect(mockSendWebhook).not.toHaveBeenCalled();
  });
});

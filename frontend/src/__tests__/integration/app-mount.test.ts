import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock conversionApi
vi.mock('../../api/conversionApi', () => ({
  startConversion: vi.fn().mockResolvedValue({ jobId: 'test' }),
  getJobStatus: vi.fn().mockResolvedValue({ status: 'completed', progress: 100 }),
  createSSEConnection: vi.fn().mockReturnValue({ close: vi.fn(), onopen: null }),
  cancelJob: vi.fn().mockResolvedValue(undefined),
  abortUpload: vi.fn(),
}));

// Mock statsApi
vi.mock('../../api/statsApi', () => ({
  getStats: vi.fn().mockResolvedValue({
    total: 0,
    byStatus: {},
    byFormat: {},
    queueCount: 0,
    avgProcessingTimeMs: 0,
    recentJobs: [],
  }),
  subscribeStatsChanges: vi.fn().mockReturnValue(() => {}),
}));

import { AppStore } from '../../store/AppStore';

describe('AppStore integration', () => {
  let store: AppStore;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    store = new AppStore();
  });

  afterEach(() => {
    store.reset();
    vi.useRealTimers();
  });

  it('full conversion lifecycle: idle -> uploading -> waiting -> completed', async () => {
    const { startConversion } = await import('../../api/conversionApi');
    const mockStart = startConversion as vi.Mock;
    mockStart.mockResolvedValue({ jobId: 'job-1' });

    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });

    // Step 1: Select file
    store.setSelectedFile(file);
    expect(store.sourceFormat).toBe('mp4');

    // Step 2: Select format
    store.setSelectedFormat('mp3');
    expect(store.selectedFormat).toBe('mp3');

    // Step 3: Start conversion
    const promise = store.startConversion(file, 'mp3');
    expect(store.conversion.status).toBe('uploading');

    await promise;
    expect(store.conversion.status).toBe('waiting');
    expect(store.history).toHaveLength(1);

    // Step 4: Simulate SSE progress
    const { createSSEConnection } = await import('../../api/conversionApi');
    const sseOnProgress = (createSSEConnection as vi.Mock).mock.calls[0][1];
    sseOnProgress({ status: 'active', progress: 50 });

    expect(store.conversion.status).toBe('active');
    expect(store.conversion.progress).toBe(50);

    // Step 5: Simulate completion
    sseOnProgress({ status: 'completed', progress: 100, outputUrl: '/outputs/job-1/job-1.mp3' });

    expect(store.conversion.status).toBe('completed');
    expect(store.conversion.progress).toBe(100);
    expect(store.conversion.outputUrl).toBe('/outputs/job-1/job-1.mp3');
  });

  it('error during upload transitions to failed', async () => {
    const { startConversion } = await import('../../api/conversionApi');
    const mockStart = startConversion as vi.Mock;
    mockStart.mockRejectedValue(new Error('Network error'));

    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    await store.startConversion(file, 'mp3');

    expect(store.conversion.status).toBe('failed');
    expect(store.conversion.error).toBe('Network error');
  });

  it('reset clears all state after conversion', async () => {
    const { startConversion } = await import('../../api/conversionApi');
    (startConversion as vi.Mock).mockResolvedValue({ jobId: 'job-1' });

    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    await store.startConversion(file, 'mp3');

    store.reset();

    expect(store.conversion.status).toBe('idle');
    expect(store.conversion.progress).toBe(0);
    expect(store.selectedFile).toBeNull();
  });
});

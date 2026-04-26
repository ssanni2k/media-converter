import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockApiStartConversion,
  mockGetJobStatus,
  mockCreateSSEConnection,
  mockCancelJob,
  mockAbortUpload,
} = vi.hoisted(() => ({
  mockApiStartConversion: vi.fn(),
  mockGetJobStatus: vi.fn(),
  mockCreateSSEConnection: vi.fn().mockReturnValue({ close: vi.fn(), onopen: null }),
  mockCancelJob: vi.fn(),
  mockAbortUpload: vi.fn(),
}));

vi.mock('../../api/conversionApi', () => ({
  startConversion: (...args: any[]) => mockApiStartConversion(...args),
  getJobStatus: (...args: any[]) => mockGetJobStatus(...args),
  createSSEConnection: (...args: any[]) => mockCreateSSEConnection(...args),
  cancelJob: (...args: any[]) => mockCancelJob(...args),
  abortUpload: () => mockAbortUpload(),
}));

vi.mock('../../api/statsApi', () => ({
  getStats: vi.fn().mockResolvedValue({
    total: 0,
    byStatus: {},
    byFormat: {},
    queueCount: 0,
    avgProcessingTimeMs: 0,
    recentJobs: [],
  }),
}));

import { AppStore } from '../../store/AppStore';

describe('AppStore', () => {
  let store: AppStore;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockCreateSSEConnection.mockReturnValue({ close: vi.fn(), onopen: null });
    mockGetJobStatus.mockResolvedValue({ status: 'waiting', progress: 0 });
    vi.useFakeTimers();
    store = new AppStore();
  });

  afterEach(() => {
    store.reset();
    vi.useRealTimers();
  });

  it('has correct initial state', () => {
    expect(store.conversion.status).toBe('idle');
    expect(store.conversion.progress).toBe(0);
    expect(store.selectedFile).toBeNull();
    expect(store.selectedFormat).toBe('mp3');
    expect(store.sourceFormat).toBeNull();
    expect(store.isConnected).toBe(false);
  });

  it('setSelectedFile sets file and extracts source format', () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    store.setSelectedFile(file);

    expect(store.selectedFile).toBe(file);
    expect(store.sourceFormat).toBe('mp4');
  });

  it('setSelectedFile clears source format when null', () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    store.setSelectedFile(file);
    store.setSelectedFile(null);

    expect(store.selectedFile).toBeNull();
    expect(store.sourceFormat).toBeNull();
  });

  it('setSelectedFormat updates format', () => {
    store.setSelectedFormat('wav');
    expect(store.selectedFormat).toBe('wav');
  });

  it('emits file:change event on setSelectedFile', () => {
    const listener = vi.fn();
    store.on('file:change', listener);

    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    store.setSelectedFile(file);

    expect(listener).toHaveBeenCalledWith(file);
  });

  it('emits format:change event on setSelectedFormat', () => {
    const listener = vi.fn();
    store.on('format:change', listener);

    store.setSelectedFormat('wav');
    expect(listener).toHaveBeenCalledWith('wav');
  });

  it('startConversion transitions to uploading then waiting', async () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    mockApiStartConversion.mockResolvedValue({ jobId: 'job-1' });

    const conversionListener = vi.fn();
    store.on('conversion:change', conversionListener);

    const promise = store.startConversion(file, 'mp3');

    expect(store.conversion.status).toBe('uploading');
    expect(conversionListener).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'uploading' }),
    );

    await promise;

    expect(store.conversion.status).toBe('waiting');
  });

  it('startConversion sets currentJob on success', async () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    mockApiStartConversion.mockResolvedValue({ jobId: 'job-1' });

    await store.startConversion(file, 'mp3');

    expect(store.history).toHaveLength(1);
    expect(store.history[0].jobId).toBe('job-1');
    expect(store.history[0].fileName).toBe('video.mp4');
  });

  it('startConversion transitions to failed on error', async () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    mockApiStartConversion.mockRejectedValue(new Error('Upload failed'));

    await store.startConversion(file, 'mp3');

    expect(store.conversion.status).toBe('failed');
    expect(store.conversion.error).toBe('Upload failed');
  });

  it('cancelConversion transitions to cancelled', async () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    mockApiStartConversion.mockResolvedValue({ jobId: 'job-1' });
    await store.startConversion(file, 'mp3');

    await store.cancelConversion();

    expect(store.conversion.status).toBe('cancelled');
    expect(store.conversion.error).toBe('Отменено пользователем');
    expect(mockAbortUpload).toHaveBeenCalled();
  });

  it('reset returns to idle state', async () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    mockApiStartConversion.mockResolvedValue({ jobId: 'job-1' });
    await store.startConversion(file, 'mp3');

    store.reset();

    expect(store.conversion.status).toBe('idle');
    expect(store.conversion.progress).toBe(0);
  });

  it('removeJob removes from history', async () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    mockApiStartConversion.mockResolvedValue({ jobId: 'job-1' });
    await store.startConversion(file, 'mp3');

    store.removeJob('job-1');
    expect(store.history).toHaveLength(0);
  });

  it('clearHistory empties all history', async () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    mockApiStartConversion.mockResolvedValue({ jobId: 'job-1' });
    await store.startConversion(file, 'mp3');

    store.clearHistory();
    expect(store.history).toHaveLength(0);
  });

  it('syncFromStorage reloads from localStorage', async () => {
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    mockApiStartConversion.mockResolvedValue({ jobId: 'job-1' });
    await store.startConversion(file, 'mp3');

    const historyListener = vi.fn();
    store.on('history:change', historyListener);

    store.syncFromStorage();
    expect(historyListener).toHaveBeenCalled();
  });
});

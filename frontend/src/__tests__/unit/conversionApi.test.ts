import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getLastEventSource, clearEventSources } from '../setup';
import { getJobStatus, createSSEConnection, cancelJob, getDownloadUrl } from '../../api/conversionApi';

describe('getJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns parsed JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'completed', progress: 100 }),
    });

    const result = await getJobStatus('job-1');
    expect(result).toEqual({ status: 'completed', progress: 100 });
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/jobs/job-1');
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    await expect(getJobStatus('job-1')).rejects.toThrow('Failed to get status');
  });
});

describe('createSSEConnection', () => {
  beforeEach(() => {
    clearEventSources();
  });

  it('creates EventSource with correct URL', () => {
    createSSEConnection('job-1', vi.fn(), vi.fn());
    const es = getLastEventSource();
    expect(es).toBeDefined();
    expect(es!.url).toContain('/events/job-1');
  });

  it('calls onProgress when message is received', () => {
    const onProgress = vi.fn();
    createSSEConnection('job-1', onProgress, vi.fn());

    const es = getLastEventSource()!;
    es._simulateMessage({ status: 'active', progress: 50 });

    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
      progress: 50,
    }));
  });

  it('calls onError when EventSource errors', () => {
    const onError = vi.fn();
    createSSEConnection('job-1', vi.fn(), onError);

    const es = getLastEventSource()!;
    es._simulateError();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('cancelJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST request', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await cancelJob('job-1');
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/jobs/job-1/cancel', {
      method: 'POST',
    });
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, statusText: 'Error' });
    await expect(cancelJob('job-1')).rejects.toThrow();
  });
});

describe('getDownloadUrl', () => {
  it('prepends API_BASE for relative paths', () => {
    expect(getDownloadUrl('/outputs/job-1/job-1.mp3')).toBe(
      'http://localhost:3000/outputs/job-1/job-1.mp3',
    );
  });

  it('returns absolute URLs as-is', () => {
    expect(getDownloadUrl('https://cdn.example.com/file.mp3')).toBe(
      'https://cdn.example.com/file.mp3',
    );
  });
});

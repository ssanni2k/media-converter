import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

const mockGetJobStatus = vi.fn();
const mockSetJobStatus = vi.fn();

vi.mock('../../worker/processor.js', () => ({
  getJobStatus: (...args: any[]) => mockGetJobStatus(...args),
  setJobStatus: (...args: any[]) => mockSetJobStatus(...args),
}));

import cancelRoute from '../../api/routes/cancel.js';

describe('POST /jobs/:id/cancel', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(cancelRoute);
  });

  it('cancels a waiting job', async () => {
    mockGetJobStatus.mockResolvedValue({ status: 'waiting', progress: 0 });
    mockSetJobStatus.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/jobs/job-1/cancel',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.cancelled).toBe(true);
    expect(mockSetJobStatus).toHaveBeenCalledWith('job-1', expect.objectContaining({
      status: 'cancelled',
    }));
  });

  it('cancels an active job', async () => {
    mockGetJobStatus.mockResolvedValue({ status: 'active', progress: 50 });
    mockSetJobStatus.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/jobs/job-1/cancel',
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 404 for non-existent job', async () => {
    mockGetJobStatus.mockResolvedValue(null);

    const response = await app.inject({
      method: 'POST',
      url: '/jobs/nonexistent/cancel',
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400 for already completed job', async () => {
    mockGetJobStatus.mockResolvedValue({ status: 'completed', progress: 100 });

    const response = await app.inject({
      method: 'POST',
      url: '/jobs/job-1/cancel',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Job already finished');
  });

  it('returns 400 for already failed job', async () => {
    mockGetJobStatus.mockResolvedValue({ status: 'failed', progress: 0 });

    const response = await app.inject({
      method: 'POST',
      url: '/jobs/job-1/cancel',
    });

    expect(response.statusCode).toBe(400);
  });
});

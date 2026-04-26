import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

const mockGetJobStatus = vi.fn();
vi.mock('../../worker/processor.js', () => ({
  getJobStatus: (...args: any[]) => mockGetJobStatus(...args),
}));

import statusRoute from '../../api/routes/status.js';

describe('GET /jobs/:id', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(statusRoute);
  });

  it('returns job status when found', async () => {
    mockGetJobStatus.mockResolvedValue({
      status: 'completed',
      progress: 100,
      outputUrl: '/outputs/job-1/job-1.mp3',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/jobs/job-1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('completed');
    expect(body.progress).toBe(100);
  });

  it('returns 404 when job not found', async () => {
    mockGetJobStatus.mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/jobs/nonexistent',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Job not found');
  });
});

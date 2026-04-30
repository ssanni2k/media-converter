import { getJobStatus, setJobStatus } from '../../worker/processor.js';
import { removeJob } from '../../shared/queue.js';
import { publisher, PROGRESS_CHANNEL, STATS_CHANNEL } from '../../shared/pubsub.js';

export default async function cancelRoute(fastify: any) {
  fastify.post('/jobs/:id/cancel', async (request: any, reply: any) => {
    const { id: jobId } = request.params;
    const status = await getJobStatus(jobId);

    if (!status) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
      return reply.status(400).send({ error: 'Job already finished' });
    }

    await setJobStatus(jobId, { status: 'cancelled', error: 'Cancelled by user' });
    await removeJob(jobId);

    publisher.publish(PROGRESS_CHANNEL, JSON.stringify({
      jobId, progress: 0, status: 'cancelled', timestamp: Date.now(),
    })).catch(() => {});
    publisher.publish(STATS_CHANNEL, '1').catch(() => {});

    return { cancelled: true };
  });
}

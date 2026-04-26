import { getJobStatus, setJobStatus } from '../../worker/processor.js';

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

    await setJobStatus(jobId, { status: 'cancelled', error: 'Отменено пользователем' });
    return { cancelled: true };
  });
}

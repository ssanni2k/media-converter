import { getJobStatus } from '../../worker/processor.js';

export default async function statusRoute(fastify: any) {
  fastify.get('/jobs/:id', async (request: any, reply: any) => {
    const { id } = request.params;
    const status = await getJobStatus(id);

    if (!status) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return status;
  });
}

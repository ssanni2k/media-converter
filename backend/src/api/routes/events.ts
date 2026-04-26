import { createSubscriber, PROGRESS_CHANNEL } from '../../shared/pubsub.js';
import { getJobStatus } from '../../worker/processor.js';

export default async function eventsRoute(fastify: any) {
  fastify.get('/events/:id', async (request: any, reply: any) => {
    const { id: jobId } = request.params;

    const status = await getJobStatus(jobId);
    if (!status) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    // Subscribe to Redis FIRST to avoid race condition:
    // if the job completes between our status check and subscription,
    // the completion event would be lost.
    const sub = createSubscriber();
    await sub.subscribe(PROGRESS_CHANNEL);

    // Now check status — if already done, send final event and close
    if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
      const finalEvent = {
        jobId,
        progress: status.progress,
        status: status.status,
        ...(status.outputUrl && { outputUrl: status.outputUrl }),
        ...(status.error && { error: status.error }),
        timestamp: Date.now(),
      };
      reply.raw.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
      sub.unsubscribe().catch(() => {});
      sub.quit().catch(() => {});
      return reply;
    }

    // Send initial progress state
    reply.raw.write(`data: ${JSON.stringify({ jobId, progress: status.progress, status: status.status, timestamp: Date.now() })}\n\n`);

    let heartbeat: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (heartbeat) clearInterval(heartbeat);
      sub.unsubscribe().catch(() => {});
      sub.quit().catch(() => {});
    };

    try {
      heartbeat = setInterval(() => {
        if (reply.raw.writable) {
          reply.raw.write(': ping\n\n');
        }
      }, 15000);

      sub.on('message', (channel: string, message: string) => {
        if (channel === PROGRESS_CHANNEL) {
          try {
            const event = JSON.parse(message);
            if (event.jobId === jobId && reply.raw.writable) {
              reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
              if (event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') {
                cleanup();
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      });
    } catch {
      cleanup();
      return;
    }

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);

    return reply;
  });
}

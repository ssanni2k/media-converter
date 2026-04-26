import { createSubscriber, STATS_CHANNEL } from '../../shared/pubsub.js';

export default async function statsEventsRoute(fastify: any) {
  fastify.get('/stats/events', async (request: any, reply: any) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });

    const sub = createSubscriber();
    await sub.subscribe(STATS_CHANNEL);

    let heartbeat: NodeJS.Timeout | undefined;
    const cleanup = () => {
      if (heartbeat) clearInterval(heartbeat);
      sub.unsubscribe().catch(() => {});
      sub.quit().catch(() => {});
    };

    heartbeat = setInterval(() => {
      if (reply.raw.writable) reply.raw.write(': ping\n\n');
    }, 15000);

    sub.on('message', (channel: string) => {
      if (channel === STATS_CHANNEL && reply.raw.writable) {
        reply.raw.write('data: {"changed":true}\n\n');
      }
    });

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);

    return reply;
  });
}

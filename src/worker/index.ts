import { createSubscriber, QUEUE_CHANNELS, publisher } from '../shared/pubsub.js';
import { getNextJob, releaseWorkerJobs, removeJob } from '../shared/queue.js';
import { processJob } from './processor.js';
import { config } from '../config/index.js';
import pino from 'pino';
import type { Priority } from '../shared/types.js';

const logger = pino({ level: 'info' });

async function startWorker(workerId: string, priority: Priority): Promise<() => void> {
  logger.info({ workerId, priority }, 'Worker starting');

  const released = await releaseWorkerJobs(workerId);
  if (released > 0) {
    logger.info({ workerId, released }, 'Released stale jobs on startup');
    publisher.publish(QUEUE_CHANNELS[priority], '1').catch(() => {});
  }

  let busy = false;
  let running = true;

  const tryGetJob = async () => {
    if (!running || busy) return;
    const job = await getNextJob(priority, workerId);
    if (!job) return;

    busy = true;
    try {
      await processJob(job.data);
    } catch (err) {
      logger.error({ err, jobId: job.jobId }, 'Job processing failed');
    } finally {
      await removeJob(job.jobId);
      busy = false;
      if (running) {
        tryGetJob().catch(err => logger.error({ err, workerId }, 'Error polling for next job'));
      }
    }
  };

  const subscriber = createSubscriber();
  const channel = QUEUE_CHANNELS[priority];
  await subscriber.subscribe(channel);

  subscriber.on('message', (ch: string) => {
    if (ch === channel) {
      tryGetJob().catch(err => logger.error({ err, workerId }, 'Error handling queue event'));
    }
  });

  // Poll for existing jobs on startup
  tryGetJob().catch(err => logger.error({ err, workerId }, 'Error during initial poll'));

  return () => {
    running = false;
    subscriber.unsubscribe(channel).catch(() => {});
    subscriber.disconnect();
  };
}

async function main() {
  const priorities: Priority[] = ['high', 'medium', 'low'];
  const counts: Record<Priority, number> = {
    high: config.workers.high,
    medium: config.workers.medium,
    low: config.workers.low,
  };

  const shutdowns: Array<() => void> = [];

  for (const priority of priorities) {
    for (let i = 0; i < counts[priority]; i++) {
      const workerId = `${priority}-${i}`;
      const shutdown = await startWorker(workerId, priority);
      shutdowns.push(shutdown);
    }
  }

  const totalWorkers = shutdowns.length;
  logger.info({ workers: totalWorkers }, 'All workers started');

  const shutdown = async () => {
    logger.info('Shutting down workers...');
    for (const fn of shutdowns) fn();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(err => {
  logger.error(err);
  process.exit(1);
});

import { Redis } from 'ioredis';
import { config } from '../config/index.js';

export const publisher = new Redis({
  ...config.redis,
  maxRetriesPerRequest: null,
});

export const createSubscriber = () => new Redis({
  ...config.redis,
  maxRetriesPerRequest: null,
});

export const PROGRESS_CHANNEL = 'job-progress';
export const STATS_CHANNEL = 'stats-changed';

export const QUEUE_CHANNEL_HIGH = 'queue:new-job:high';
export const QUEUE_CHANNEL_MEDIUM = 'queue:new-job:medium';
export const QUEUE_CHANNEL_LOW = 'queue:new-job:low';

export const QUEUE_CHANNELS: Record<string, string> = {
  high: QUEUE_CHANNEL_HIGH,
  medium: QUEUE_CHANNEL_MEDIUM,
  low: QUEUE_CHANNEL_LOW,
};

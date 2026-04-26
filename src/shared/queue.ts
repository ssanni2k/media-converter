import redis from './redis.js';
import { publisher, QUEUE_CHANNELS } from './pubsub.js';
import type { JobData, Priority } from './types.js';

const QUEUE_KEY = 'queue:jobs';

interface QueueItem {
  jobId: string;
  data: JobData;
  priority: Priority;
  assignedWorker: string | null;
  status: 'waiting' | 'assigned';
}

const GET_NEXT_JOB_SCRIPT = `
  local queueKey = KEYS[1]
  local targetPriority = ARGV[1]
  local workerId = ARGV[2]

  local items = redis.call('LRANGE', queueKey, 0, -1)
  for i, itemJson in ipairs(items) do
    local item = cjson.decode(itemJson)
    if item.status == 'waiting' and item.priority == targetPriority then
      item.status = 'assigned'
      item.assignedWorker = workerId
      redis.call('LSET', queueKey, i - 1, cjson.encode(item))
      return itemJson
    end
  end
  return false
`;

const RELEASE_WORKER_SCRIPT = `
  local queueKey = KEYS[1]
  local targetWorkerId = ARGV[1]

  local items = redis.call('LRANGE', queueKey, 0, -1)
  local released = 0
  for i, itemJson in ipairs(items) do
    local item = cjson.decode(itemJson)
    if item.assignedWorker == targetWorkerId and item.status == 'assigned' then
      item.assignedWorker = cjson.null
      item.status = 'waiting'
      redis.call('LSET', queueKey, i - 1, cjson.encode(item))
      released = released + 1
    end
  end
  return released
`;

const REMOVE_JOB_SCRIPT = `
  local queueKey = KEYS[1]
  local targetJobId = ARGV[1]

  local items = redis.call('LRANGE', queueKey, 0, -1)
  for i, itemJson in ipairs(items) do
    local item = cjson.decode(itemJson)
    if item.jobId == targetJobId then
      redis.call('LREM', queueKey, 1, itemJson)
      return true
    end
  end
  return false
`;

export async function addJob(data: JobData, priority: Priority): Promise<void> {
  const item: QueueItem = {
    jobId: data.jobId,
    data,
    priority,
    assignedWorker: null,
    status: 'waiting',
  };

  await redis.rpush(QUEUE_KEY, JSON.stringify(item));
  await publisher.publish(QUEUE_CHANNELS[priority], '1').catch(() => {});
}

export async function getNextJob(workerPriority: Priority, workerId: string): Promise<QueueItem | null> {
  const result = await redis.eval(GET_NEXT_JOB_SCRIPT, 1, QUEUE_KEY, workerPriority, workerId);
  if (!result) return null;
  return JSON.parse(result as string);
}

export async function releaseWorkerJobs(workerId: string): Promise<number> {
  const released = await redis.eval(RELEASE_WORKER_SCRIPT, 1, QUEUE_KEY, workerId) as number;
  return released;
}

export async function removeJob(jobId: string): Promise<boolean> {
  const removed = await redis.eval(REMOVE_JOB_SCRIPT, 1, QUEUE_KEY, jobId) as boolean;
  return removed;
}

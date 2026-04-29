import { publisher, PROGRESS_CHANNEL, STATS_CHANNEL } from '../shared/pubsub.js';
import redis from '../shared/redis.js';
import { JobData, JobStatus, ProgressEvent } from '../shared/types.js';
import { convert } from './ffmpeg.js';
import { sendWebhook } from './webhook.js';
import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

export async function processJob(jobData: JobData): Promise<void> {
  const { jobId, inputPath, outputPath, format, webhookUrl } = jobData;

  try {
    const fileStat = await stat(inputPath);
    if (fileStat.size === 0) {
      throw new Error('Загруженный файл пуст');
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Загруженный файл пуст') throw err;
    throw new Error('Входной файл не найден или повреждён');
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  // Check if cancelled while waiting in queue
  const preStatus = await getJobStatus(jobId);
  if (preStatus?.status === 'cancelled') {
    return;
  }

  await setJobStatus(jobId, { status: 'active', progress: 0 });
  publisher.publish(STATS_CHANNEL, '1').catch(() => {});

  let cancelled = false;
  const cancelSignal = { aborted: false };
  const cancelCheck = setInterval(async () => {
    const s = await getJobStatus(jobId);
    if (s?.status === 'cancelled') {
      cancelled = true;
      cancelSignal.aborted = true;
    }
  }, 200);

  try {
    await convert(inputPath, outputPath, format, (event: ProgressEvent) => {
      if (cancelled) throw new Error('CANCELLED');

      const progressEvent = { ...event, jobId, status: 'active' };
      publisher.publish(PROGRESS_CHANNEL, JSON.stringify(progressEvent)).catch(() => {});
      if (!cancelled) {
        setJobStatus(jobId, { status: 'active', progress: progressEvent.progress }).catch(() => {});
      }
    });

    // Re-check after convert returns (may have been cancelled during final frames)
    if (cancelled) throw new Error('CANCELLED');

    const outputUrl = `/outputs/${jobId}/${jobId}.${format}`;

    await setJobStatus(jobId, {
      status: 'completed',
      progress: 100,
      outputUrl,
      completedAt: String(Date.now()),
    });

    await publisher.publish(PROGRESS_CHANNEL, JSON.stringify({
      jobId, progress: 100, status: 'completed', outputUrl, timestamp: Date.now(),
    }));
    publisher.publish(STATS_CHANNEL, '1').catch(() => {});

    if (webhookUrl) {
      sendWebhook(webhookUrl, jobId, format, outputUrl).catch(() => {});
    }
  } catch (error) {
    clearInterval(cancelCheck);
    if (error instanceof Error && error.message === 'CANCELLED') {
      await setJobStatus(jobId, { status: 'cancelled', error: 'Отменено пользователем' });
      await publisher.publish(PROGRESS_CHANNEL, JSON.stringify({
        jobId, progress: 0, status: 'cancelled', timestamp: Date.now(),
      }));
      publisher.publish(STATS_CHANNEL, '1').catch(() => {});
      return;
    }
    await setJobStatus(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    await publisher.publish(PROGRESS_CHANNEL, JSON.stringify({
      jobId, progress: 0, status: 'failed', timestamp: Date.now(),
    }));
    publisher.publish(STATS_CHANNEL, '1').catch(() => {});
  }

  clearInterval(cancelCheck);
}

export async function setJobStatus(jobId: string, status: Partial<JobStatus>): Promise<void> {
  await redis.hset(`job:${jobId}`, status as Record<string, string | number>);
  await redis.expire(`job:${jobId}`, config.redisTtlSeconds);
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  const data = await redis.hgetall(`job:${jobId}`);
  if (!data || Object.keys(data).length === 0) return null;

  return {
    status: data.status as JobStatus['status'],
    progress: parseInt(data.progress) || 0,
    outputUrl: data.outputUrl,
    error: data.error,
    webhookAttempts: data.webhookAttempts ? parseInt(data.webhookAttempts) : undefined,
    fileName: data.fileName,
    targetFormat: data.targetFormat,
    createdAt: data.createdAt,
    completedAt: data.completedAt,
    fileSize: data.fileSize ? parseInt(data.fileSize) : undefined,
    priorityName: data.priorityName as JobStatus['priorityName'],
  };
}

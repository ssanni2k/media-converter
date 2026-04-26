import { config } from '../config/index.js';
import redis from '../shared/redis.js';

export async function sendWebhook(
  url: string,
  jobId: string,
  format?: string,
  outputUrl?: string,
  attempt = 1
): Promise<void> {
  const payload = {
    jobId,
    status: 'completed',
    timestamp: Date.now(),
    ...(format && { format }),
    ...(outputUrl && { outputUrl }),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.webhook.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    if (attempt < config.webhook.maxRetries) {
      const delay = config.webhook.baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
      return sendWebhook(url, jobId, format, outputUrl, attempt + 1);
    }

    console.error(`Webhook failed for job ${jobId} after ${attempt} attempts`);
    await redis.hset(`job:${jobId}`, 'webhookAttempts', attempt);
  }
}

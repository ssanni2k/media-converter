import redis from '../../shared/redis.js';

interface StatsResponse {
  total: number;
  byStatus: Record<string, number>;
  byFormat: Record<string, number>;
  queueCount: number;
  avgProcessingTimeMs: number;
  recentJobs: Array<{
    fileName: string;
    targetFormat: string;
    status: string;
    progress: number;
    createdAt: string;
  }>;
}

let cachedStats: StatsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5_000;

export default async function statsRoute(fastify: any) {
  fastify.get('/stats', async () => {
    const now = Date.now();
    if (cachedStats && now - cacheTimestamp < CACHE_TTL) {
      return cachedStats;
    }

    const keys = await redis.keys('job:*');
    const stats: StatsResponse = {
      total: keys.length,
      byStatus: { completed: 0, failed: 0, active: 0, waiting: 0 },
      byFormat: {},
      queueCount: 0,
      avgProcessingTimeMs: 0,
      recentJobs: [],
    };

    if (keys.length === 0) {
      cachedStats = stats;
      cacheTimestamp = now;
      return stats;
    }

    const pipeline = redis.pipeline();
    for (const key of keys) {
      pipeline.hgetall(key);
    }
    const results = await pipeline.exec();

    const jobs: Array<{
      jobId: string;
      fileName: string;
      targetFormat: string;
      status: string;
      progress: number;
      createdAt: string;
      completedAt: string;
      timestamp: number;
    }> = [];

    for (let i = 0; i < (results ?? []).length; i++) {
      const [err, data] = (results ?? [])[i];
      if (err || !data) continue;
      const d = data as Record<string, string>;
      const status = d.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      if (d.targetFormat) {
        stats.byFormat[d.targetFormat] = (stats.byFormat[d.targetFormat] || 0) + 1;
      }

      const createdAt = d.createdAt || '0';
      const completedAt = d.completedAt || '0';
      const jobId = keys[i].replace('job:', '');
      jobs.push({
        jobId,
        fileName: d.fileName || '?',
        targetFormat: d.targetFormat || '?',
        status,
        progress: parseInt(d.progress) || 0,
        createdAt,
        completedAt,
        timestamp: parseInt(createdAt) || 0,
      });
    }

    jobs.sort((a, b) => b.timestamp - a.timestamp);
    stats.recentJobs = jobs.slice(0, 50);

    stats.queueCount = (stats.byStatus.waiting || 0) + (stats.byStatus.active || 0);
    stats.byStatus.cancelled = stats.byStatus.cancelled || 0;

    const completedJobs = jobs
      .filter(j => j.status === 'completed' && j.completedAt && j.createdAt)
      .slice(0, 20);
    if (completedJobs.length > 0) {
      let totalTime = 0;
      let counted = 0;
      for (const j of completedJobs) {
        const created = parseInt(j.createdAt);
        const finished = parseInt(j.completedAt);
        const duration = finished - created;
        if (duration > 0 && duration < 3_600_000) {
          totalTime += duration;
          counted++;
        }
      }
      if (counted > 0) {
        stats.avgProcessingTimeMs = Math.round(totalTime / counted);
      }
    }

    cachedStats = stats;
    cacheTimestamp = now;
    return stats;
  });
}

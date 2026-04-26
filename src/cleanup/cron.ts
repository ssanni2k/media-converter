import cron from 'node-cron';
import { readdir, stat, rm } from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import redis from '../shared/redis.js';

export function startCleanupCron(): void {
  cron.schedule(config.cleanup.interval, async () => {
    const maxAgeMs = config.cleanup.maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();

    for (const dir of ['./data/uploads', './data/outputs']) {
      try {
        const entries = await readdir(dir);

        for (const entry of entries) {
          const entryPath = path.join(dir, entry);
          const stats = await stat(entryPath);

          if (now - stats.mtimeMs > maxAgeMs) {
            const jobStatus = await redis.hget(`job:${entry}`, 'status');
            if (jobStatus === 'active') {
              continue;
            }

            await rm(entryPath, { recursive: true });
            console.log(`Cleaned up: ${entryPath}`);
          }
        }
      } catch (error) {
        console.error(`Cleanup error for ${dir}:`, error);
      }
    }
  });
}

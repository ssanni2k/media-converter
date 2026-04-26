import pino from 'pino';
import { startCleanupCron } from './cron.js';

const logger = pino({ level: 'info' });

logger.info('Starting cleanup service...');
startCleanupCron();

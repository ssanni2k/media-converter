import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { mkdir, rm, stat } from 'fs/promises';
import { addJob } from '../../shared/queue.js';
import { setJobStatus } from '../../worker/processor.js';
import { publisher, STATS_CHANNEL } from '../../shared/pubsub.js';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { JobData, Priority } from '../../shared/types.js';
import { FORMAT_CODECS } from '../../worker/ffmpeg.js';
import { getSourceFormat, canConvert, getCompatibleFormats } from '../../shared/compatibility.js';
import { config } from '../../config/index.js';

function getPriority(fileSizeBytes: number): Priority {
  const mb = fileSizeBytes / (1024 * 1024);
  if (mb <= config.priority.highMaxMb) return 'high';
  if (mb <= config.priority.mediumMaxMb) return 'medium';
  return 'low';
}

export default async function convertRoute(fastify: any) {
  fastify.post('/convert', async (request: any, reply: any) => {
    const fields: Record<string, string> = {};
    let savedFilePath: string | null = null;
    let filename: string | null = null;

    const jobId = uuidv4();
    const uploadDir = `./data/uploads/${jobId}`;
    const outputDir = `./data/outputs/${jobId}`;

    const cleanup = async () => {
      await rm(uploadDir, { recursive: true, force: true }).catch(() => {});
      await rm(outputDir, { recursive: true, force: true }).catch(() => {});
    };

    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.file) {
          filename = part.filename;
          const safeName = path.basename(filename!);
          savedFilePath = `${uploadDir}/${safeName}`;

          await mkdir(uploadDir, { recursive: true });
          await mkdir(outputDir, { recursive: true });
          await pipeline(part.file, createWriteStream(savedFilePath));
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    } catch (error) {
      await cleanup();
      const message = error instanceof Error ? error.message : 'File upload failed';
      return reply.status(500).send({ error: message });
    }

    if (!savedFilePath || !filename) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Validate file size
    let fileSize: number;
    try {
      const fileStat = await stat(savedFilePath);
      fileSize = fileStat.size;
    } catch {
      await cleanup();
      return reply.status(500).send({ error: 'Failed to determine file size' });
    }

    if (fileSize > config.limits.maxFileSize) {
      await cleanup();
      return reply.status(413).send({
        error: `File size exceeds the ${config.limits.maxFileSizeMb} MB limit`,
      });
    }

    const format = fields.format || 'mp3';

    if (!FORMAT_CODECS[format]) {
      await cleanup();
      return reply.status(400).send({ error: 'Unsupported format' });
    }

    const sourceFormat = getSourceFormat(filename);
    if (sourceFormat && !canConvert(sourceFormat, format)) {
      const compatible = getCompatibleFormats(sourceFormat).map(f => f.toUpperCase());
      await cleanup();
      return reply.status(400).send({
        error: `Cannot convert ${sourceFormat.toUpperCase()} to ${format.toUpperCase()}. Available formats: ${compatible.join(', ')}`,
      });
    }

    const webhookUrl = fields.webhookUrl;
    const outputPath = `${outputDir}/${jobId}.${format}`;
    const priority = getPriority(fileSize);

    try {
      const jobData: JobData = {
        jobId,
        inputPath: savedFilePath,
        outputPath,
        format,
        webhookUrl,
      };

      await addJob(jobData, priority);
      await setJobStatus(jobId, {
        status: 'waiting',
        progress: 0,
        fileName: path.basename(savedFilePath),
        targetFormat: format,
        createdAt: String(Date.now()),
        fileSize,
        priorityName: priority,
      });
      publisher.publish(STATS_CHANNEL, '1').catch(() => {});
    } catch (error) {
      await cleanup();
      const message = error instanceof Error ? error.message : 'File upload failed';
      return reply.status(500).send({ error: message });
    }

    return { jobId };
  });
}

import type { JobData, JobStatus, Priority } from '../../shared/types.js';

export const sampleJobData: JobData = {
  jobId: 'test-job-123',
  inputPath: './data/uploads/test-job-123/video.mp4',
  outputPath: './data/outputs/test-job-123/test-job-123.mp3',
  format: 'mp3',
};

export const sampleJobStatus: JobStatus = {
  status: 'waiting',
  progress: 0,
  fileName: 'video.mp4',
  targetFormat: 'mp3',
  createdAt: String(Date.now()),
  fileSize: 5_242_880,
  priorityName: 'high',
};

export const samplePriority: Priority = 'high';

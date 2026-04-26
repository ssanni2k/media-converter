export type Priority = 'high' | 'medium' | 'low';

export interface JobData {
  jobId: string;
  inputPath: string;
  outputPath: string;
  format: string;
  webhookUrl?: string;
}

export interface JobStatus {
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  outputUrl?: string;
  error?: string;
  webhookAttempts?: number;
  fileName?: string;
  targetFormat?: string;
  createdAt?: string;
  completedAt?: string;
  fileSize?: number;
  priorityName?: Priority;
}

export interface ProgressEvent {
  jobId: string;
  progress: number;
  timestamp: number;
  estimatedTotal?: number;
}

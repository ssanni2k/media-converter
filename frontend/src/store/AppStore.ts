import { EventEmitter } from './EventEmitter';
import { JobHistoryStore } from './JobHistoryStore';
import { startConversion as apiStartConversion, getJobStatus, createSSEConnection, cancelJob as apiCancelJob, abortUpload } from '../api/conversionApi';
import { getStats } from '../api/statsApi';
import { localizeError, t } from '../i18n/index.js';
import type { JobStatus, SupportedFormat, JobHistoryItem } from '../types';

export interface ConversionState {
  status: JobStatus | 'uploading' | 'idle' | 'cancelled';
  progress: number;
  estimatedTotal?: number;
  conversionStartTime?: number;
  queueCount?: number;
  estimatedWaitMs?: number;
  outputUrl?: string;
  error?: string;
}

interface AppEvents {
  'file:change': File | null;
  'format:change': SupportedFormat;
  'sourceFormat:change': string | null;
  'conversion:change': ConversionState & { isConnected: boolean; estimatedTotal?: number; conversionStartTime?: number };
  'history:change': JobHistoryItem[];
  [key: string]: unknown;
}

export class AppStore {
  private emitter = new EventEmitter<AppEvents>();
  private jobHistory = new JobHistoryStore();

  selectedFile: File | null = null;
  selectedFormat: SupportedFormat = 'mp3';
  sourceFormat: string | null = null;
  conversion: ConversionState = { status: 'idle', progress: 0 };
  isConnected = false;

  private currentJob: { jobId: string; fileName: string; targetFormat: string } | null = null;
  private eventSource: EventSource | null = null;
  private pollInterval: number | null = null;
  private queuePollInterval: number | null = null;
  private sseRetryCount = 0;
  private historyEmitTimer: number | null = null;

  on<K extends keyof AppEvents>(event: K, listener: (data: AppEvents[K]) => void): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof AppEvents>(event: K, listener: (data: AppEvents[K]) => void): void {
    this.emitter.off(event, listener);
  }

  private emitConversion(): void {
    this.emitter.emit('conversion:change', {
      status: this.conversion.status,
      progress: this.conversion.progress,
      estimatedTotal: this.conversion.estimatedTotal,
      conversionStartTime: this.conversion.conversionStartTime,
      outputUrl: this.conversion.outputUrl,
      error: this.conversion.error,
      isConnected: this.isConnected,
    });
  }

  private emitHistoryNow(): void {
    this.emitter.emit('history:change', [...this.jobHistory.history]);
  }

  private emitHistoryDebounced(): void {
    if (this.historyEmitTimer !== null) return;
    this.historyEmitTimer = window.setTimeout(() => {
      this.historyEmitTimer = null;
      this.emitHistoryNow();
    }, 1000);
  }

  private emitHistoryImmediate(): void {
    if (this.historyEmitTimer !== null) {
      clearTimeout(this.historyEmitTimer);
      this.historyEmitTimer = null;
    }
    this.emitHistoryNow();
  }

  setSelectedFile(file: File | null): void {
    this.selectedFile = file;
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || null;
      this.sourceFormat = ext;
    } else {
      this.sourceFormat = null;
    }
    this.emitter.emit('file:change', file);
    this.emitter.emit('sourceFormat:change', this.sourceFormat);
  }

  setSelectedFormat(format: SupportedFormat): void {
    this.selectedFormat = format;
    this.emitter.emit('format:change', format);
  }

  get history(): JobHistoryItem[] {
    return this.jobHistory.history;
  }

  removeJob(jobId: string): void {
    this.jobHistory.removeJob(jobId);
    this.emitHistoryImmediate();
  }

  clearHistory(): void {
    this.jobHistory.clearHistory();
    this.emitHistoryImmediate();
  }

  /** Sync localStorage from another tab and re-emit */
  syncFromStorage(): void {
    this.jobHistory.reload();
    this.emitHistoryImmediate();
  }

  /** Check server for actual status of non-terminal jobs and fix stale history */
  async reconcileHistory(): Promise<void> {
    const jobs = this.jobHistory.history;
    let changed = false;

    for (const job of jobs) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') continue;

      try {
        const status = await getJobStatus(job.jobId);
        if (status.status === 'completed') {
          this.jobHistory.updateJob(job.jobId, { status: 'completed', progress: 100, outputUrl: status.outputUrl });
          changed = true;
        } else if (status.status === 'failed') {
          this.jobHistory.updateJob(job.jobId, { status: 'failed', error: localizeError(status.error || '') });
          changed = true;
        } else if (status.status === 'cancelled') {
          this.jobHistory.updateJob(job.jobId, { status: 'cancelled', error: t('errors.cancelled') });
          changed = true;
        }
      } catch {
        this.jobHistory.updateJob(job.jobId, { status: 'failed', error: t('errors.jobNotFound') });
        changed = true;
      }
    }

    if (changed) {
      this.emitHistoryImmediate();
    }
  }

  private stopSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  private stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private isTerminal(): boolean {
    return this.conversion.status === 'completed' || this.conversion.status === 'failed' || this.conversion.status === 'cancelled';
  }

  private handleProgress(progress: number, status: JobStatus | undefined, estimatedTotal?: number): void {
    if (this.isTerminal()) return;

    const effectiveStatus = status && status !== 'completed' && status !== 'failed' && status !== 'cancelled'
      ? status
      : this.conversion.status as JobStatus || 'active';

    if (effectiveStatus === 'completed' || effectiveStatus === 'failed' || effectiveStatus === 'cancelled') {
      return;
    }

    if (effectiveStatus === 'active') {
      this.stopQueuePoll();
    }

    this.conversion = {
      ...this.conversion,
      progress,
      status: effectiveStatus,
      ...(estimatedTotal && !this.conversion.estimatedTotal && { estimatedTotal }),
      ...(!this.conversion.conversionStartTime && { conversionStartTime: Date.now() }),
    };
    if (this.currentJob) {
      this.jobHistory.updateJob(this.currentJob.jobId, { progress, status: effectiveStatus });
      this.emitHistoryDebounced();
    }
    this.emitConversion();
  }

  private handleComplete(outputUrl: string | null): void {
    if (this.isTerminal()) return;
    this.stopQueuePoll();
    this.stopPolling();
    this.stopSSE();
    this.conversion = { status: 'completed', progress: 100, outputUrl: outputUrl || '' };
    if (this.currentJob) {
      this.jobHistory.updateJob(this.currentJob.jobId, { status: 'completed', progress: 100, outputUrl: outputUrl || '' });
      this.emitHistoryImmediate();
    }
    this.emitConversion();
  }

  private handleError(error: string): void {
    if (this.isTerminal()) return;
    this.stopQueuePoll();
    this.stopPolling();
    this.stopSSE();
    this.conversion = { ...this.conversion, status: 'failed', error: localizeError(error) };
    if (this.currentJob) {
      this.jobHistory.updateJob(this.currentJob.jobId, { status: 'failed', error: localizeError(error) });
      this.emitHistoryImmediate();
    }
    this.emitConversion();
  }

  private handleCancel(): void {
    this.stopQueuePoll();
    this.stopPolling();
    this.stopSSE();
    this.conversion = { ...this.conversion, status: 'cancelled', error: t('errors.cancelledByUser') };
    if (this.currentJob) {
      this.jobHistory.updateJob(this.currentJob.jobId, { status: 'cancelled', error: t('errors.cancelledByUser') });
      this.emitHistoryImmediate();
    }
    this.emitConversion();
  }

  async cancelConversion(): Promise<void> {
    abortUpload();
    if (this.currentJob) {
      try { await apiCancelJob(this.currentJob.jobId); } catch {}
    }
    this.handleCancel();
  }

  private async fetchQueueInfo(): Promise<void> {
    if (this.isTerminal() || this.conversion.status !== 'waiting') return;
    try {
      const data = await getStats();
      const concurrency = 4;
      const queueCount = Math.max(0, data.queueCount - 1);
      const estimatedWaitMs = data.avgProcessingTimeMs > 0
        ? Math.round(data.avgProcessingTimeMs * queueCount / concurrency)
        : undefined;
      this.conversion = { ...this.conversion, queueCount, estimatedWaitMs };
      this.emitConversion();
    } catch {
      // silent
    }
  }

  private startQueuePoll(): void {
    this.stopQueuePoll();
    this.fetchQueueInfo();
    this.queuePollInterval = window.setInterval(() => this.fetchQueueInfo(), 5000);
  }

  private stopQueuePoll(): void {
    if (this.queuePollInterval !== null) {
      clearInterval(this.queuePollInterval);
      this.queuePollInterval = null;
    }
  }

  private startPolling(jobId: string): void {
    this.stopPolling();
    this.pollInterval = window.setInterval(async () => {
      if (this.isTerminal()) return;
      try {
        const status = await getJobStatus(jobId);
        if (this.isTerminal()) return;

        if (status.status === 'completed') {
          this.handleComplete(status.outputUrl || null);
        } else if (status.status === 'failed') {
          this.handleError(status.error || '');
        } else if (status.status === 'cancelled') {
          this.handleCancel();
        } else {
          this.handleProgress(status.progress, status.status);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
  }

  private startSSE(jobId: string): void {
    this.stopSSE();
    this.eventSource = createSSEConnection(
      jobId,
      (event) => {
        if (this.isTerminal()) return;

        this.isConnected = true;

        if (event.status === 'completed') {
          this.handleComplete(event.outputUrl || null);
        } else if (event.status === 'failed') {
          this.handleError(event.error || '');
        } else if (event.status === 'cancelled') {
          this.handleCancel();
        } else {
          this.handleProgress(event.progress, event.status, event.estimatedTotal);
        }
      },
      (_error) => {
        if (this.isTerminal()) return;
        this.isConnected = false;
        this.emitConversion();
        if (this.currentJob && !this.isTerminal() && this.sseRetryCount < 5) {
          const delay = Math.min(5000, 1000 * Math.pow(2, this.sseRetryCount));
          this.sseRetryCount++;
          setTimeout(() => {
            if (this.currentJob && !this.isTerminal()) {
              this.startSSE(jobId);
            }
          }, delay);
        }
      }
    );

    this.eventSource.onopen = () => {
      this.isConnected = true;
      this.sseRetryCount = 0;
      this.emitConversion();
    };
  }

  async startConversion(file: File, format: string): Promise<void> {
    this.stopPolling();
    this.stopSSE();
    this.stopQueuePoll();
    this.sseRetryCount = 0;
    if (this.historyEmitTimer !== null) {
      clearTimeout(this.historyEmitTimer);
      this.historyEmitTimer = null;
    }

    this.conversion = { status: 'uploading', progress: 0 };
    this.emitConversion();

    try {
      const { jobId } = await apiStartConversion(file, format, (uploadProgress) => {
        this.conversion = { ...this.conversion, progress: uploadProgress };
        this.emitConversion();
      });

      this.currentJob = { jobId, fileName: file.name, targetFormat: format };
      this.jobHistory.addJob(jobId, file.name, format);
      this.emitHistoryImmediate();

      this.conversion = { status: 'waiting', progress: 0 };
      this.emitConversion();

      this.startQueuePoll();

      this.startPolling(jobId);
      this.startSSE(jobId);
    } catch (err) {
      this.conversion = {
        status: 'failed',
        progress: 0,
        error: localizeError(err instanceof Error ? err.message : ''),
      };
      this.emitConversion();
    }
  }

  reset(): void {
    this.stopPolling();
    this.stopSSE();
    this.stopQueuePoll();
    this.currentJob = null;
    this.sseRetryCount = 0;
    if (this.historyEmitTimer !== null) {
      clearTimeout(this.historyEmitTimer);
      this.historyEmitTimer = null;
    }
    this.conversion = { status: 'idle', progress: 0 };
    this.emitConversion();
  }
}
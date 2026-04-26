import type { JobHistoryItem, JobStatus } from '../types';

const STORAGE_KEY = 'conversion_job_history';
const MAX_HISTORY = 20;

export class JobHistoryStore {
  private items: JobHistoryItem[] = [];

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.items = JSON.parse(stored);
      }
    } catch {
      this.items = [];
    }
  }

  reload(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.items = stored ? JSON.parse(stored) : [];
    } catch {
      this.items = [];
    }
  }

  get history(): JobHistoryItem[] {
    return this.items;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
  }

  addJob(jobId: string, fileName: string, targetFormat: string): void {
    this.items = [
      {
        jobId,
        fileName,
        targetFormat,
        status: 'waiting' as JobStatus,
        progress: 0,
        createdAt: Date.now(),
      },
      ...this.items,
    ].slice(0, MAX_HISTORY);
    this.persist();
  }

  updateJob(jobId: string, updates: Partial<JobHistoryItem>): void {
    this.items = this.items.map((job) =>
      job.jobId === jobId ? { ...job, ...updates } : job
    );
    this.persist();
  }

  removeJob(jobId: string): void {
    this.items = this.items.filter((job) => job.jobId !== jobId);
    this.persist();
  }

  clearHistory(): void {
    this.items = [];
    this.persist();
  }
}

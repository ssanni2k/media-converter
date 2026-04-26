import { describe, it, expect, beforeEach } from 'vitest';
import { JobHistoryStore } from './JobHistoryStore';

describe('JobHistoryStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty history when localStorage is empty', () => {
    const store = new JobHistoryStore();
    expect(store.history).toEqual([]);
  });

  it('loads from localStorage on construction', () => {
    const items = [
      { jobId: '1', fileName: 'a.mp4', targetFormat: 'mp3', status: 'completed', progress: 100, createdAt: Date.now() },
    ];
    localStorage.setItem('conversion_job_history', JSON.stringify(items));

    const store = new JobHistoryStore();
    expect(store.history).toHaveLength(1);
    expect(store.history[0].jobId).toBe('1');
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('conversion_job_history', 'not-json');
    const store = new JobHistoryStore();
    expect(store.history).toEqual([]);
  });

  it('addJob adds to front of list', () => {
    const store = new JobHistoryStore();
    store.addJob('1', 'a.mp4', 'mp3');
    store.addJob('2', 'b.mp4', 'wav');

    expect(store.history).toHaveLength(2);
    expect(store.history[0].jobId).toBe('2');
    expect(store.history[1].jobId).toBe('1');
  });

  it('addJob sets initial status to waiting', () => {
    const store = new JobHistoryStore();
    store.addJob('1', 'a.mp4', 'mp3');

    expect(store.history[0].status).toBe('waiting');
    expect(store.history[0].progress).toBe(0);
  });

  it('addJob enforces MAX_HISTORY of 20', () => {
    const store = new JobHistoryStore();
    for (let i = 0; i < 25; i++) {
      store.addJob(String(i), `file${i}.mp4`, 'mp3');
    }

    expect(store.history).toHaveLength(20);
    // Most recent first
    expect(store.history[0].jobId).toBe('24');
  });

  it('addJob persists to localStorage', () => {
    const store = new JobHistoryStore();
    store.addJob('1', 'a.mp4', 'mp3');

    const stored = JSON.parse(localStorage.getItem('conversion_job_history')!);
    expect(stored).toHaveLength(1);
  });

  it('updateJob merges updates with existing item', () => {
    const store = new JobHistoryStore();
    store.addJob('1', 'a.mp4', 'mp3');
    store.updateJob('1', { status: 'completed', progress: 100, outputUrl: '/outputs/1.mp3' });

    const job = store.history[0];
    expect(job.status).toBe('completed');
    expect(job.progress).toBe(100);
    expect(job.outputUrl).toBe('/outputs/1.mp3');
    expect(job.fileName).toBe('a.mp4'); // preserved
  });

  it('updateJob does nothing for non-existent job', () => {
    const store = new JobHistoryStore();
    store.addJob('1', 'a.mp4', 'mp3');
    store.updateJob('999', { status: 'completed' });

    expect(store.history).toHaveLength(1);
    expect(store.history[0].status).toBe('waiting');
  });

  it('removeJob removes by jobId', () => {
    const store = new JobHistoryStore();
    store.addJob('1', 'a.mp4', 'mp3');
    store.addJob('2', 'b.mp4', 'wav');
    store.removeJob('1');

    expect(store.history).toHaveLength(1);
    expect(store.history[0].jobId).toBe('2');
  });

  it('clearHistory empties the list', () => {
    const store = new JobHistoryStore();
    store.addJob('1', 'a.mp4', 'mp3');
    store.addJob('2', 'b.mp4', 'wav');
    store.clearHistory();

    expect(store.history).toEqual([]);
  });

  it('reload re-reads from localStorage', () => {
    const store = new JobHistoryStore();
    store.addJob('1', 'a.mp4', 'mp3');

    // Modify localStorage directly
    const items = JSON.parse(localStorage.getItem('conversion_job_history')!);
    items.push({ jobId: '2', fileName: 'b.mp4', targetFormat: 'wav', status: 'waiting', progress: 0, createdAt: Date.now() });
    localStorage.setItem('conversion_job_history', JSON.stringify(items));

    store.reload();
    expect(store.history).toHaveLength(2);
  });
});

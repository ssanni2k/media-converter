import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockChildProcess } from '../__tests__/helpers/mockChildProcess.js';

const mockProcess = createMockChildProcess();
const spawnMock = vi.fn(() => mockProcess);

vi.mock('child_process', () => ({
  spawn: (...args: any[]) => spawnMock(...args),
}));

import { getDuration } from './ffprobe.js';

describe('getDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed duration from stdout', async () => {
    spawnMock.mockReturnValue(mockProcess);

    const promise = getDuration('input.mp4');

    // Simulate ffprobe output
    setTimeout(() => {
      mockProcess._emitStdout('10.5\n');
      mockProcess._emitClose(0);
    }, 10);

    const result = await promise;
    expect(result).toBe(10.5);
  });

  it('rejects when ffprobe exits with non-zero code', async () => {
    spawnMock.mockReturnValue(mockProcess);

    const promise = getDuration('invalid.xyz');

    setTimeout(() => {
      mockProcess._emitClose(1);
    }, 10);

    await expect(promise).rejects.toThrow('формат не поддерживается');
  });

  it('rejects when output is not a valid number', async () => {
    spawnMock.mockReturnValue(mockProcess);

    const promise = getDuration('bad.mp4');

    setTimeout(() => {
      mockProcess._emitStdout('not-a-number\n');
      mockProcess._emitClose(0);
    }, 10);

    await expect(promise).rejects.toThrow('формат не поддерживается');
  });

  it('calls spawn with correct arguments', async () => {
    spawnMock.mockReturnValue(mockProcess);

    const promise = getDuration('test.mp4');

    setTimeout(() => {
      mockProcess._emitStdout('5.0\n');
      mockProcess._emitClose(0);
    }, 10);

    await promise;
    expect(spawnMock).toHaveBeenCalledWith('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      'test.mp4',
    ]);
  });
});

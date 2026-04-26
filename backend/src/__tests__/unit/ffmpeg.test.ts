import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockChildProcess } from '../helpers/mockChildProcess.js';

const mockProcess = createMockChildProcess();
const spawnMock = vi.fn(() => mockProcess);

vi.mock('child_process', () => ({
  spawn: (...args: any[]) => spawnMock(...args),
}));

vi.mock('../../worker/ffprobe.js', () => ({
  getDuration: vi.fn().mockResolvedValue(10),
}));

import { convert, FORMAT_CODECS } from '../../worker/ffmpeg.js';

describe('FORMAT_CODECS', () => {
  it('has entries for all supported audio formats', () => {
    expect(FORMAT_CODECS.mp3).toBeDefined();
    expect(FORMAT_CODECS.wav).toBeDefined();
    expect(FORMAT_CODECS.flac).toBeDefined();
    expect(FORMAT_CODECS.ogg).toBeDefined();
    expect(FORMAT_CODECS.aac).toBeDefined();
  });

  it('has entries for all supported video formats', () => {
    expect(FORMAT_CODECS.mp4).toBeDefined();
    expect(FORMAT_CODECS.webm).toBeDefined();
    expect(FORMAT_CODECS.mov).toBeDefined();
    expect(FORMAT_CODECS.avi).toBeDefined();
    expect(FORMAT_CODECS.flv).toBeDefined();
  });

  it('has entries for container formats', () => {
    expect(FORMAT_CODECS.mkv).toBeDefined();
    expect(FORMAT_CODECS.ts).toBeDefined();
    expect(FORMAT_CODECS.mxf).toBeDefined();
    expect(FORMAT_CODECS.asf).toBeDefined();
  });
});

describe('convert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves on successful conversion', async () => {
    spawnMock.mockReturnValue(mockProcess);

    const promise = convert('input.mp4', 'output.mp3', 'mp3', vi.fn());

    setTimeout(() => {
      mockProcess._emitClose(0);
    }, 10);

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects on non-zero exit code', async () => {
    spawnMock.mockReturnValue(mockProcess);

    const promise = convert('input.mp4', 'output.mp3', 'mp3', vi.fn());

    setTimeout(() => {
      mockProcess._emitStderr(Buffer.from('Error details'));
      mockProcess._emitClose(1);
    }, 10);

    await expect(promise).rejects.toThrow('кодом 1');
  });

  it('calls spawn with correct arguments including format codecs', async () => {
    spawnMock.mockReturnValue(mockProcess);

    const promise = convert('in.mp4', 'out.mp3', 'mp3', vi.fn());

    setTimeout(() => {
      mockProcess._emitClose(0);
    }, 10);

    await promise;

    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-nostdin', '-i', 'in.mp4', '-progress', 'pipe:1', '-y',
      '-codec:a', 'libmp3lame', '-q:a', '2',
      'out.mp3',
    ]));
  });

  it('calls onProgress with progress events', async () => {
    spawnMock.mockReturnValue(mockProcess);
    const onProgress = vi.fn();

    const promise = convert('in.mp4', 'out.mp3', 'mp3', onProgress);

    setTimeout(() => {
      mockProcess._emitStdout('out_time_ms=5000000\n');
      mockProcess._emitClose(0);
    }, 10);

    await promise;
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        progress: expect.any(Number),
        timestamp: expect.any(Number),
      })
    );
  });

  it('kills stdin after spawn', async () => {
    spawnMock.mockReturnValue(mockProcess);

    const promise = convert('in.mp4', 'out.mp3', 'mp3', vi.fn());

    setTimeout(() => {
      mockProcess._emitClose(0);
    }, 10);

    await promise;
    expect(mockProcess.stdin.end).toHaveBeenCalled();
  });
});

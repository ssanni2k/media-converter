import { spawn } from 'child_process';
import { ProgressEvent } from '../shared/types.js';
import { getDuration } from './ffprobe.js';
import { FFMPEG_PATH } from '../config/paths.js';

export const FORMAT_CODECS: Record<string, string[]> = {
  // Audio
  mp3:  ['-codec:a', 'libmp3lame', '-q:a', '2'],
  wav:  ['-codec:a', 'pcm_s16le'],
  flac: ['-codec:a', 'flac'],
  ogg:  ['-codec:a', 'libopus', '-b:a', '128k'],
  aac:  ['-codec:a', 'aac', '-f', 'adts'],
  wma:  ['-codec:a', 'wmav2', '-f', 'asf'],
  ac3:  ['-codec:a', 'ac3'],
  // Video
  mp4:  ['-codec:v', 'libx264', '-preset', 'fast', '-codec:a', 'aac'],
  webm: ['-codec:v', 'libvpx-vp9', '-codec:a', 'libopus'],
  mov:  ['-codec:v', 'libx264', '-preset', 'fast', '-codec:a', 'aac', '-f', 'mov'],
  avi:  ['-codec:v', 'libx264', '-preset', 'fast', '-codec:a', 'mp3', '-f', 'avi'],
  flv:  ['-codec:v', 'libx264', '-preset', 'fast', '-codec:a', 'aac', '-f', 'flv'],
  // Containers
  mkv:  ['-codec:v', 'libx264', '-preset', 'fast', '-codec:a', 'aac', '-f', 'matroska'],
  ts:   ['-codec:v', 'libx264', '-preset', 'fast', '-codec:a', 'aac', '-f', 'mpegts'],
  mxf:  ['-codec:v', 'mpeg2video', '-pix_fmt', 'yuv422p', '-codec:a', 'pcm_s16le', '-ar', '48000', '-f', 'mxf'],
  asf:  ['-codec:v', 'libx264', '-preset', 'fast', '-codec:a', 'wmav2', '-f', 'asf'],
};

export async function convert(
  inputPath: string,
  outputPath: string,
  format: string,
  onProgress: (event: ProgressEvent) => void,
  signal?: { aborted: boolean }
): Promise<void> {
  let duration = 0;
  try {
    duration = await getDuration(inputPath);
  } catch {
    // Duration detection failed — proceed with safe defaults
  }

  const estimatedTotal = duration > 0 ? Math.max(2000, duration * 1500) : 5000;
  const args = buildArgs(inputPath, outputPath, format);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, args);
    ffmpeg.stdin.end();

    let lastTime = 0;
    let resolved = false;

    const timeoutMs = Math.min(300000, Math.max(60000, (duration > 0 ? duration * 5000 : 60000)));
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ffmpeg.kill('SIGKILL');
        reject(new Error('Conversion timeout exceeded'));
      }
    }, timeoutMs);

    const STALL_TIMEOUT_MS = 30_000;
    let stallTimer: NodeJS.Timeout;
    const resetStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ffmpeg.kill('SIGKILL');
          reject(new Error('Conversion stalled — no progress'));
        }
      }, STALL_TIMEOUT_MS);
    };
    resetStallTimer();

    if (signal) {
      const check = setInterval(() => {
        if (signal.aborted) {
          clearInterval(check);
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            clearTimeout(stallTimer);
            ffmpeg.kill('SIGKILL');
            reject(new Error('CANCELLED'));
          }
        }
      }, 200);
      ffmpeg.on('close', () => clearInterval(check));
    }

    const MAX_STDERR = 64 * 1024;
    let stderrChunks: Buffer[] = [];
    let stderrSize = 0;

    const finish = (code: number | null, err?: Error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      clearTimeout(stallTimer);
      if (err) reject(err);
      else if (code === 0) resolve();
      else {
        const stderrTail = Buffer.concat(stderrChunks).toString().slice(-500);
        reject(new Error(`FFmpeg exited with code ${code}\n${stderrTail}`));
      }
    };

    ffmpeg.stdout.on('data', (data) => {
      const output = data.toString();
      const timeMatch = output.match(/out_time_ms=(\d+)/);

      if (timeMatch) {
        const currentTime = parseInt(timeMatch[1]) / 1000000;
        const progress = duration > 0
          ? Math.min((currentTime / duration) * 100, 100)
          : Math.min(currentTime > 0 ? 50 : 0, 100);

        if (progress > lastTime) {
          lastTime = progress;
          resetStallTimer();
          onProgress({ jobId: '', progress: Math.round(progress), timestamp: Date.now(), estimatedTotal });
        }
      }
    });

    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderrChunks.push(data);
      stderrSize += data.length;
      while (stderrSize > MAX_STDERR && stderrChunks.length > 1) {
        const removed = stderrChunks.shift()!;
        stderrSize -= removed.length;
      }
    });

    ffmpeg.on('close', (code) => finish(code));
    ffmpeg.on('error', (err) => finish(null, err));
  });
}

function buildArgs(
  input: string,
  output: string,
  format: string
): string[] {
  const args = ['-nostdin', '-i', input, '-progress', 'pipe:1', '-y'];

  if (FORMAT_CODECS[format]) {
    args.push(...FORMAT_CODECS[format]);
  }

  args.push(output);
  return args;
}

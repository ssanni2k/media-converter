import { existsSync } from 'fs';
import { execSync } from 'child_process';

function findBinary(name: string, envVar: string): string {
  if (process.env[envVar]) return process.env[envVar]!;

  try {
    const result = execSync(`which ${name} 2>/dev/null`, { encoding: 'utf-8' }).trim();
    if (result) return result;
  } catch {}

  const commonPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
  for (const dir of commonPaths) {
    const full = `${dir}/${name}`;
    if (existsSync(full)) return full;
  }

  return name;
}

export const FFMPEG_PATH = findBinary('ffmpeg', 'FFMPEG_PATH');
export const FFPROBE_PATH = findBinary('ffprobe', 'FFPROBE_PATH');
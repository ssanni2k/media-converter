import { FORMAT_CODECS } from '../worker/ffmpeg.js';

const AUDIO_ONLY = new Set(['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3']);
const REQUIRES_VIDEO = new Set(['mp4', 'webm', 'mov', 'avi', 'flv', 'ts', 'mxf']);

export function getSourceFormat(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext && FORMAT_CODECS[ext] ? ext : null;
}

export function canConvert(sourceFormat: string, targetFormat: string): boolean {
  if (sourceFormat === targetFormat) return false;
  if (AUDIO_ONLY.has(sourceFormat) && REQUIRES_VIDEO.has(targetFormat)) return false;
  return true;
}

export function getCompatibleFormats(sourceFormat: string): string[] {
  return Object.keys(FORMAT_CODECS).filter(
    (f) => f !== sourceFormat && canConvert(sourceFormat, f)
  );
}

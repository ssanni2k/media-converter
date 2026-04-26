const AUDIO_ONLY = new Set(['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3']);
const VIDEO_FORMATS = new Set(['mp4', 'webm', 'mov', 'avi', 'flv', 'ts', 'mxf']);

export function shouldSkipConversion(source: string, target: string): boolean {
  if (source === target) return true;
  if (AUDIO_ONLY.has(source) && VIDEO_FORMATS.has(target)) return true;
  // MXF requires video stream — test samples don't contain video
  if (source === 'mxf' || target === 'mxf') return true;
  return false;
}

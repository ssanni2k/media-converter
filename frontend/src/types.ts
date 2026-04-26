export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface JobStatusResponse {
  status: JobStatus;
  progress: number;
  outputUrl?: string;
  error?: string;
}

export interface JobHistoryItem {
  jobId: string;
  fileName: string;
  targetFormat: string;
  status: JobStatus;
  progress: number;
  outputUrl?: string;
  error?: string;
  createdAt: number;
}

export type FormatCategory = 'audio' | 'video' | 'container';

export interface FormatInfo {
  category: FormatCategory;
  label: string;
  icon: string;
}

export const SUPPORTED_FORMATS = [
  'mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3',
  'mp4', 'webm', 'mov', 'avi', 'flv',
  'mkv', 'ts', 'mxf', 'asf',
] as const;

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

export const FORMAT_INFO: Record<SupportedFormat, FormatInfo> = {
  mp3:  { category: 'audio',     label: 'MP3 (Аудио)',        icon: '🎵' },
  wav:  { category: 'audio',     label: 'WAV (Аудио)',        icon: '📼' },
  flac: { category: 'audio',     label: 'FLAC (Без потерь)',  icon: '💿' },
  ogg:  { category: 'audio',     label: 'OGG (Аудио)',        icon: '🔊' },
  aac:  { category: 'audio',     label: 'AAC (Аудио)',        icon: '🎵' },
  wma:  { category: 'audio',     label: 'WMA (Аудио)',        icon: '🎵' },
  ac3:  { category: 'audio',     label: 'AC3 (Аудио)',        icon: '🔊' },
  mp4:  { category: 'video',     label: 'MP4 (Видео)',        icon: '🎬' },
  webm: { category: 'video',     label: 'WebM (Видео)',       icon: '🌐' },
  mov:  { category: 'video',     label: 'MOV (Видео)',        icon: '🎬' },
  avi:  { category: 'video',     label: 'AVI (Видео)',        icon: '🎥' },
  flv:  { category: 'video',     label: 'FLV (Видео)',        icon: '🎥' },
  mkv:  { category: 'container', label: 'MKV (Контейнер)',    icon: '📦' },
  ts:   { category: 'container', label: 'TS (Транспортный)',  icon: '📡' },
  mxf:  { category: 'container', label: 'MXF (Контейнер)',    icon: '📼' },
  asf:  { category: 'container', label: 'ASF (Контейнер)',    icon: '📦' },
};

export const CATEGORY_LABELS: Record<FormatCategory, string> = {
  audio: 'Аудио',
  video: 'Видео',
  container: 'Контейнеры',
};

const AUDIO_ONLY_FORMATS = new Set(['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3']);
const VIDEO_FORMATS = new Set(['mp4', 'webm', 'mov', 'avi', 'flv', 'ts', 'mxf']);

export function getCompatibleFormats(sourceFormat: string): SupportedFormat[] {
  if (!AUDIO_ONLY_FORMATS.has(sourceFormat)) {
    return SUPPORTED_FORMATS.filter(f => f !== sourceFormat);
  }
  return SUPPORTED_FORMATS.filter(f => f !== sourceFormat && !VIDEO_FORMATS.has(f));
}

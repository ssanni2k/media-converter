import { t } from './i18n/index.js';

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
  label: () => string;
  icon: string;
}

export const SUPPORTED_FORMATS = [
  'mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3',
  'mp4', 'webm', 'mov', 'avi', 'flv',
  'mkv', 'ts', 'mxf', 'asf',
] as const;

export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

export const FORMAT_ICONS: Record<SupportedFormat, string> = {
  mp3:  '🎵',
  wav:  '📼',
  flac: '💿',
  ogg:  '🔊',
  aac:  '🎵',
  wma:  '🎵',
  ac3:  '🔊',
  mp4:  '🎬',
  webm: '🌐',
  mov:  '🎬',
  avi:  '🎥',
  flv:  '🎥',
  mkv:  '📦',
  ts:   '📡',
  mxf:  '📼',
  asf:  '📦',
};

export const FORMAT_CATEGORIES: Record<SupportedFormat, FormatCategory> = {
  mp3:  'audio',
  wav:  'audio',
  flac: 'audio',
  ogg:  'audio',
  aac:  'audio',
  wma:  'audio',
  ac3:  'audio',
  mp4:  'video',
  webm: 'video',
  mov:  'video',
  avi:  'video',
  flv:  'video',
  mkv:  'container',
  ts:   'container',
  mxf:  'container',
  asf:  'container',
};

export function getFormatInfo(fmt: SupportedFormat): FormatInfo {
  return {
    category: FORMAT_CATEGORIES[fmt],
    label: () => t(`format.${fmt}`),
    icon: FORMAT_ICONS[fmt],
  };
}

export function getCategoryLabel(category: FormatCategory): string {
  return t(`format.categories.${category}`);
}

const AUDIO_ONLY_FORMATS = new Set(['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3']);
const VIDEO_FORMATS = new Set(['mp4', 'webm', 'mov', 'avi', 'flv', 'ts', 'mxf']);

export function getCompatibleFormats(sourceFormat: string): SupportedFormat[] {
  if (!AUDIO_ONLY_FORMATS.has(sourceFormat)) {
    return SUPPORTED_FORMATS.filter(f => f !== sourceFormat);
  }
  return SUPPORTED_FORMATS.filter(f => f !== sourceFormat && !VIDEO_FORMATS.has(f));
}
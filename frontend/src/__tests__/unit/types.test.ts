import { describe, it, expect } from 'vitest';
import { SUPPORTED_FORMATS, FORMAT_CATEGORIES, FORMAT_ICONS, getFormatInfo, getCategoryLabel, getCompatibleFormats } from '../../types';

describe('SUPPORTED_FORMATS', () => {
  it('contains 16 formats', () => {
    expect(SUPPORTED_FORMATS).toHaveLength(16);
  });

  it('includes all audio formats', () => {
    expect(SUPPORTED_FORMATS).toContain('mp3');
    expect(SUPPORTED_FORMATS).toContain('wav');
    expect(SUPPORTED_FORMATS).toContain('flac');
    expect(SUPPORTED_FORMATS).toContain('ogg');
    expect(SUPPORTED_FORMATS).toContain('aac');
    expect(SUPPORTED_FORMATS).toContain('wma');
    expect(SUPPORTED_FORMATS).toContain('ac3');
  });

  it('includes all video formats', () => {
    expect(SUPPORTED_FORMATS).toContain('mp4');
    expect(SUPPORTED_FORMATS).toContain('webm');
    expect(SUPPORTED_FORMATS).toContain('mov');
    expect(SUPPORTED_FORMATS).toContain('avi');
    expect(SUPPORTED_FORMATS).toContain('flv');
  });

  it('includes container formats', () => {
    expect(SUPPORTED_FORMATS).toContain('mkv');
    expect(SUPPORTED_FORMATS).toContain('ts');
    expect(SUPPORTED_FORMATS).toContain('mxf');
    expect(SUPPORTED_FORMATS).toContain('asf');
  });
});

describe('FORMAT_CATEGORIES and FORMAT_ICONS', () => {
  it('has an entry for every supported format', () => {
    for (const format of SUPPORTED_FORMATS) {
      expect(FORMAT_CATEGORIES[format]).toBeDefined();
      expect(FORMAT_ICONS[format]).toBeDefined();
    }
  });

  it('categorizes audio formats correctly', () => {
    expect(FORMAT_CATEGORIES.mp3).toBe('audio');
    expect(FORMAT_CATEGORIES.wav).toBe('audio');
    expect(FORMAT_CATEGORIES.flac).toBe('audio');
  });

  it('categorizes video formats correctly', () => {
    expect(FORMAT_CATEGORIES.mp4).toBe('video');
    expect(FORMAT_CATEGORIES.webm).toBe('video');
  });

  it('categorizes container formats correctly', () => {
    expect(FORMAT_CATEGORIES.mkv).toBe('container');
    expect(FORMAT_CATEGORIES.ts).toBe('container');
    expect(FORMAT_CATEGORIES.mxf).toBe('container');
  });
});

describe('getFormatInfo', () => {
  it('returns format info with category, label function, and icon', () => {
    const info = getFormatInfo('mp3');
    expect(info.category).toBe('audio');
    expect(typeof info.label).toBe('function');
    expect(info.icon).toBeDefined();
  });
});

describe('getCategoryLabel', () => {
  it('returns Russian labels by default', () => {
    expect(getCategoryLabel('audio')).toBe('Аудио');
    expect(getCategoryLabel('video')).toBe('Видео');
    expect(getCategoryLabel('container')).toBe('Контейнеры');
  });
});

describe('getCompatibleFormats', () => {
  it('excludes the source format', () => {
    const formats = getCompatibleFormats('mp4');
    expect(formats).not.toContain('mp4');
  });

  it('audio source excludes video formats', () => {
    const formats = getCompatibleFormats('mp3');
    expect(formats).not.toContain('mp4');
    expect(formats).not.toContain('webm');
    expect(formats).not.toContain('mov');
    expect(formats).toContain('wav');
    expect(formats).toContain('flac');
  });

  it('video source includes all other formats', () => {
    const formats = getCompatibleFormats('mp4');
    expect(formats).toContain('mp3');
    expect(formats).toContain('wav');
    expect(formats).toContain('webm');
    expect(formats).toContain('mkv');
    expect(formats).not.toContain('mp4');
  });

  it('returns all formats except source for containers', () => {
    const formats = getCompatibleFormats('mkv');
    expect(formats).toContain('mp3');
    expect(formats).toContain('mp4');
    expect(formats).not.toContain('mkv');
  });
});
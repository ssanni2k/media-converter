import { describe, it, expect } from 'vitest';
import { SUPPORTED_FORMATS, FORMAT_INFO, getCompatibleFormats } from '../../types';

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

describe('FORMAT_INFO', () => {
  it('has an entry for every supported format', () => {
    for (const format of SUPPORTED_FORMATS) {
      expect(FORMAT_INFO[format]).toBeDefined();
      expect(FORMAT_INFO[format].category).toBeDefined();
      expect(FORMAT_INFO[format].label).toBeDefined();
    }
  });

  it('categorizes audio formats correctly', () => {
    expect(FORMAT_INFO.mp3.category).toBe('audio');
    expect(FORMAT_INFO.wav.category).toBe('audio');
    expect(FORMAT_INFO.flac.category).toBe('audio');
  });

  it('categorizes video formats correctly', () => {
    expect(FORMAT_INFO.mp4.category).toBe('video');
    expect(FORMAT_INFO.webm.category).toBe('video');
  });

  it('categorizes container formats correctly', () => {
    expect(FORMAT_INFO.mkv.category).toBe('container');
    expect(FORMAT_INFO.ts.category).toBe('container');
    expect(FORMAT_INFO.mxf.category).toBe('container');
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

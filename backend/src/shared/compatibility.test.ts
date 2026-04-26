import { describe, it, expect, vi } from 'vitest';

vi.mock('../worker/ffmpeg.js', () => ({
  FORMAT_CODECS: {
    mp3: ['-codec:a', 'libmp3lame'],
    wav: ['-codec:a', 'pcm_s16le'],
    mp4: ['-codec:v', 'libx264', '-codec:a', 'aac'],
    webm: ['-codec:v', 'libvpx-vp9', '-codec:a', 'libopus'],
    mkv: ['-codec:v', 'libx264', '-codec:a', 'aac'],
  },
}));

import { getSourceFormat, canConvert, getCompatibleFormats } from './compatibility.js';

describe('getSourceFormat', () => {
  it('extracts format from filename', () => {
    expect(getSourceFormat('video.mp4')).toBe('mp4');
    expect(getSourceFormat('audio.mp3')).toBe('mp3');
    expect(getSourceFormat('file.WAV')).toBe('wav');
  });

  it('returns null for unknown format', () => {
    expect(getSourceFormat('file.xyz')).toBeNull();
  });

  it('returns null for filename without extension', () => {
    expect(getSourceFormat('file')).toBeNull();
  });
});

describe('canConvert', () => {
  it('returns false for same format', () => {
    expect(canConvert('mp4', 'mp4')).toBe(false);
    expect(canConvert('mp3', 'mp3')).toBe(false);
  });

  it('returns false for audio-only to video format', () => {
    expect(canConvert('mp3', 'mp4')).toBe(false);
    expect(canConvert('wav', 'webm')).toBe(false);
  });

  it('returns true for video to audio', () => {
    expect(canConvert('mp4', 'mp3')).toBe(true);
    expect(canConvert('webm', 'wav')).toBe(true);
  });

  it('returns true for audio to audio', () => {
    expect(canConvert('mp3', 'wav')).toBe(true);
    expect(canConvert('wav', 'mp3')).toBe(true);
  });

  it('returns true for video to video', () => {
    expect(canConvert('mp4', 'webm')).toBe(true);
    expect(canConvert('webm', 'mkv')).toBe(true);
  });

  it('returns true for audio to container', () => {
    expect(canConvert('mp3', 'mkv')).toBe(true);
  });
});

describe('getCompatibleFormats', () => {
  it('excludes source format', () => {
    const formats = getCompatibleFormats('mp4');
    expect(formats).not.toContain('mp4');
  });

  it('audio source excludes video formats', () => {
    const formats = getCompatibleFormats('mp3');
    expect(formats).not.toContain('mp4');
    expect(formats).not.toContain('webm');
    expect(formats).toContain('wav');
  });

  it('video source includes all other formats', () => {
    const formats = getCompatibleFormats('mp4');
    expect(formats).toContain('mp3');
    expect(formats).toContain('wav');
    expect(formats).toContain('webm');
    expect(formats).toContain('mkv');
    expect(formats).not.toContain('mp4');
  });
});

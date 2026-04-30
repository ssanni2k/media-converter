import { describe, it, expect, beforeEach } from 'vitest';
import { getCompatibleFormats } from '../../types';

describe('format-filter-flow integration', () => {
  it('audio file filters out video formats', () => {
    const formats = getCompatibleFormats('mp3');
    const videoFormats = ['mp4', 'webm', 'mov', 'avi', 'flv', 'ts', 'mxf', 'asf'];

    for (const vf of videoFormats) {
      expect(formats).not.toContain(vf);
    }

    // But should include other audio and containers
    expect(formats).toContain('wav');
    expect(formats).toContain('flac');
    expect(formats).toContain('mkv');
  });

  it('video file shows all formats except source', () => {
    const formats = getCompatibleFormats('mp4');

    // Should include audio
    expect(formats).toContain('mp3');
    expect(formats).toContain('wav');

    // Should include other video
    expect(formats).toContain('webm');
    expect(formats).toContain('mov');

    // Should include containers
    expect(formats).toContain('mkv');

    // Should not include self
    expect(formats).not.toContain('mp4');
  });

  it('container source shows all other formats', () => {
    const formats = getCompatibleFormats('mkv');

    expect(formats).toContain('mp3');
    expect(formats).toContain('mp4');
    expect(formats).toContain('webm');
    expect(formats).not.toContain('mkv');
  });

  it('all audio formats produce compatible lists', () => {
    const audioFormats = ['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3'];

    for (const af of audioFormats) {
      const formats = getCompatibleFormats(af);
      expect(formats).not.toContain(af);
      expect(formats.length).toBeGreaterThan(0);

      // None should be video-only
      const videoFormats = ['mp4', 'webm', 'mov', 'avi', 'flv', 'ts', 'mxf', 'asf'];
      for (const vf of videoFormats) {
        expect(formats).not.toContain(vf);
      }
    }
  });
});

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.resolve(__dirname, '..', 'test-data');

export const media = {
  // Audio
  wav: path.join(testDataDir, 'sample.wav'),
  mp3: path.join(testDataDir, 'sample.mp3'),
  ogg: path.join(testDataDir, 'sample.ogg'),
  flac: path.join(testDataDir, 'sample.flac'),
  aac: path.join(testDataDir, 'sample.aac'),
  wma: path.join(testDataDir, 'sample.wma'),
  ac3: path.join(testDataDir, 'sample.ac3'),
  // Video
  mp4: path.join(testDataDir, 'sample.mp4'),
  webm: path.join(testDataDir, 'sample.webm'),
  mov: path.join(testDataDir, 'sample.mov'),
  avi: path.join(testDataDir, 'sample.avi'),
  flv: path.join(testDataDir, 'sample.flv'),
  // Containers
  mkv: path.join(testDataDir, 'sample.mkv'),
  ts: path.join(testDataDir, 'sample.ts'),
  mxf: path.join(testDataDir, 'sample.mxf'),
  asf: path.join(testDataDir, 'sample.asf'),
  // Invalid
  invalid: path.join(testDataDir, 'invalid.txt'),
};

export const SUPPORTED_INPUTS = ['wav', 'mp3', 'ogg', 'flac', 'aac', 'wma', 'ac3', 'mp4', 'webm', 'mov', 'avi', 'flv', 'mkv', 'ts', 'mxf', 'asf'] as const;
export const SUPPORTED_OUTPUTS = ['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3', 'mp4', 'webm', 'mov', 'avi', 'flv', 'mkv', 'ts', 'mxf', 'asf'] as const;

import { spawn } from 'child_process';
import { FFPROBE_PATH } from '../config/paths.js';

export async function getDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(FFPROBE_PATH, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      inputPath,
    ]);

    let output = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        ffprobe.kill('SIGKILL');
        reject(new Error('Failed to determine file duration — timeout exceeded'));
      }
    }, 10000);

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) {
          reject(new Error('Unsupported file format'));
        } else {
          resolve(duration);
        }
      } else {
        reject(new Error('Unsupported file format'));
      }
    });

    ffprobe.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(new Error(`File analysis error: ${err.message}`));
    });
  });
}

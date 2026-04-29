import type { JobStatusResponse } from '../types';

const API_BASE = 'http://localhost:3000';

let currentUploadXhr: XMLHttpRequest | null = null;

export function abortUpload(): void {
  if (currentUploadXhr) {
    currentUploadXhr.abort();
    currentUploadXhr = null;
  }
}

export async function startConversion(
  file: File,
  format: string,
  onProgress?: (progress: number) => void
): Promise<{ jobId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    currentUploadXhr = xhr;

    let lastProgressTime = Date.now();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        lastProgressTime = Date.now();
        onProgress((e.loaded / e.total) * 50);
      }
    });

    xhr.addEventListener('load', () => {
      currentUploadXhr = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.statusText || 'File upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      currentUploadXhr = null;
      reject(new Error('Network error'));
    });

    xhr.addEventListener('abort', () => {
      currentUploadXhr = null;
      reject(new Error('Upload cancelled'));
    });

    const stallTimer = setInterval(() => {
      if (Date.now() - lastProgressTime > 300_000) {
        xhr.abort();
        clearInterval(stallTimer);
        reject(new Error('Upload stalled — no progress'));
      }
    }, 30_000);

    xhr.addEventListener('load', () => clearInterval(stallTimer));
    xhr.addEventListener('error', () => clearInterval(stallTimer));
    xhr.addEventListener('abort', () => clearInterval(stallTimer));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    xhr.open('POST', `${API_BASE}/convert`);
    xhr.send(formData);
  });
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`);
  }
  return response.json();
}

export function createSSEConnection(
  jobId: string,
  onProgress: (event: JobStatusResponse & { estimatedTotal?: number }) => void,
  onError: (error: Error) => void
): EventSource {
  const eventSource = new EventSource(`${API_BASE}/events/${jobId}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onProgress(data);
    } catch {
      onError(new Error('Failed to parse SSE event'));
    }
  };

  eventSource.onerror = () => {
    onError(new Error('SSE connection error'));
    eventSource.close();
  };

  return eventSource;
}

export function getDownloadUrl(outputPath: string): string {
  return outputPath.startsWith('http')
    ? outputPath
    : `${API_BASE}${outputPath}`;
}

export async function cancelJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to cancel job: ${response.statusText}`);
  }
}
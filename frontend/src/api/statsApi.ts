const API_BASE = 'http://localhost:3000';

export interface StatsResponse {
  total: number;
  byStatus: Record<string, number>;
  byFormat: Record<string, number>;
  queueCount: number;
  avgProcessingTimeMs: number;
  recentJobs: Array<{
    jobId: string;
    fileName: string;
    targetFormat: string;
    status: string;
    progress: number;
    createdAt: string;
  }>;
}

export async function getStats(): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to get stats: ${response.statusText}`);
  }
  return response.json();
}

export function subscribeStatsChanges(onChange: () => void): () => void {
  let es: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const connect = () => {
    if (cancelled) return;
    es = new EventSource(`${API_BASE}/stats/stream`);
    es.onmessage = () => onChange();
    es.onerror = () => {
      es?.close();
      es = null;
      retryTimer = setTimeout(connect, 3000);
    };
  };
  connect();

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    es?.close();
  };
}

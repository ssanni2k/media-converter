import '../css/JobQueue.css';
import { createJobCard, updateJobCard } from './JobCard';
import { getJobStatus } from '../api/conversionApi';

interface QueueJob {
  jobId: string;
  fileName: string;
  targetFormat: string;
  status: string;
  progress: number;
}

const POLL_INTERVAL = 2000;

export function mountJobQueue(container: HTMLElement): {
  update: (jobs: QueueJob[]) => void;
  destroy: () => void;
} {
  container.innerHTML = `
    <div class="job-queue">
      <div class="job-queue__header">
        <h2 class="job-queue__title">Очередь</h2>
        <span class="job-queue__subtitle">Обработка выполняется асинхронно</span>
        <span class="job-queue__count">0</span>
      </div>
      <div class="job-queue__grid">
        <div class="job-queue__empty">Нет активных задач</div>
      </div>
    </div>
  `;

  const grid = container.querySelector('.job-queue__grid') as HTMLElement;
  const countBadge = container.querySelector('.job-queue__count') as HTMLElement;
  const emptyMsg = container.querySelector('.job-queue__empty') as HTMLElement;
  const cardMap = new Map<string, HTMLElement>();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const stopPoll = () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPoll = () => {
    stopPoll();
    pollTimer = setInterval(async () => {
      for (const [jobId, card] of cardMap) {
        try {
          const status = await getJobStatus(jobId);
          updateJobCard(card, {
            jobId,
            fileName: card.querySelector('.job-card__file-name')?.textContent || '',
            targetFormat: card.querySelector('.job-card__format')?.textContent?.toLowerCase() || '',
            status: status.status,
            progress: status.progress,
            createdAt: 0,
          });
        } catch {
          // ignore
        }
      }
    }, POLL_INTERVAL);
  };

  const render = (jobs: QueueJob[]) => {
    const activeIds = new Set(jobs.map(j => j.jobId));

    // Remove cards that left the queue
    for (const [id, el] of cardMap) {
      if (!activeIds.has(id)) {
        el.remove();
        cardMap.delete(id);
      }
    }

    // Add/update cards
    for (const job of jobs) {
      if (cardMap.has(job.jobId)) {
        updateJobCard(cardMap.get(job.jobId)!, job as any);
      } else {
        const card = createJobCard(job as any, () => {});
        grid.appendChild(card);
        cardMap.set(job.jobId, card);
      }
    }

    emptyMsg.style.display = jobs.length === 0 ? '' : 'none';
    countBadge.textContent = String(jobs.length);

    if (cardMap.size > 0) {
      startPoll();
    } else {
      stopPoll();
    }
  };

  return {
    update(jobs) {
      render(jobs);
    },
    destroy() {
      stopPoll();
      cardMap.clear();
    },
  };
}

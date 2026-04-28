import '../css/JobQueue.css';
import { createJobCard, updateJobCard } from './JobCard';
import { getJobStatus } from '../api/conversionApi';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

interface QueueJob {
  jobId: string;
  fileName: string;
  targetFormat: string;
  status: string;
  progress: number;
  createdAt: number;
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

  const removeCard = (jobId: string) => {
    const card = cardMap.get(jobId);
    if (card) {
      card.classList.add('fade-leave');
      card.addEventListener('animationend', () => {
        card.remove();
        cardMap.delete(jobId);
        if (cardMap.size === 0) {
          stopPoll();
          emptyMsg.style.display = '';
        }
        countBadge.textContent = String(cardMap.size);
      }, { once: true });
    }
  };

  const startPoll = () => {
    stopPoll();
    pollTimer = setInterval(async () => {
      const jobIds = [...cardMap.keys()];
      for (const jobId of jobIds) {
        try {
          const status = await getJobStatus(jobId);
          if (TERMINAL.has(status.status)) {
            removeCard(jobId);
            continue;
          }
          const card = cardMap.get(jobId);
          if (card) {
            updateJobCard(card, {
              jobId,
              fileName: card.querySelector('.job-card__file-name')?.textContent || '',
              targetFormat: card.querySelector('.job-card__format')?.textContent?.toLowerCase() || '',
              status: status.status,
              progress: status.progress,
              createdAt: parseInt(card.querySelector('.job-card__timestamp')?.dataset.ts || '0') || Date.now(),
            });
          }
        } catch {
          removeCard(jobId);
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
        const tsEl = card.querySelector('.job-card__timestamp');
        if (tsEl) tsEl.dataset.ts = String(job.createdAt);
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

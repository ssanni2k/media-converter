import '../css/JobHistory.css';
import type { AppStore } from '../store/AppStore';
import { createJobCard, updateJobCard } from './JobCard';

export function mountJobHistory(container: HTMLElement, store: AppStore): () => void {
  container.innerHTML = `
    <div class="job-history" style="display:none">
      <div class="job-history__header">
        <h2 class="job-history__title">История конвертаций</h2>
        <button class="job-history__clear-btn">Очистить всё</button>
      </div>
      <div class="job-history__grid"></div>
    </div>
  `;

  const root = container.querySelector('.job-history') as HTMLElement;
  const grid = container.querySelector('.job-history__grid') as HTMLElement;
  const clearBtn = container.querySelector('.job-history__clear-btn') as HTMLButtonElement;

  clearBtn.addEventListener('click', () => store.clearHistory());

  const cardMap = new Map<string, HTMLElement>();

  const render = (jobs: typeof store.history) => {
    const terminalJobs = jobs.filter(j =>
      j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled'
    );

    if (terminalJobs.length === 0) {
      root.style.display = 'none';
      grid.innerHTML = '';
      cardMap.clear();
      return;
    }

    root.style.display = '';

    const currentIds = new Set(terminalJobs.map(j => j.jobId));

    // Remove cards for jobs no longer in terminal list
    for (const [id, el] of cardMap) {
      if (!currentIds.has(id)) {
        cardMap.delete(id);
        el.classList.add('fade-leave');
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }
    }

    // Add new cards, update existing ones
    for (const job of terminalJobs) {
      if (cardMap.has(job.jobId)) {
        updateJobCard(cardMap.get(job.jobId)!, job);
      } else {
        const card = createJobCard(job, () => store.removeJob(job.jobId));
        cardMap.set(job.jobId, card);
        grid.appendChild(card);
      }
    }

    // Reorder cards to match array order (only move if position changed)
    for (let i = 0; i < terminalJobs.length; i++) {
      const card = cardMap.get(terminalJobs[i].jobId);
      if (card && card !== grid.children[i]) {
        const refChild = grid.children[i] || null;
        grid.insertBefore(card, refChild);
      }
    }
  };

  render(store.history);
  store.on('history:change', render);

  return () => store.off('history:change', render);
}

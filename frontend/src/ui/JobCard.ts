import '../css/JobCard.css';
import type { JobHistoryItem } from '../types';
import { createDownloadButton } from './DownloadButton';
import { t, getLocale } from '../i18n/index.js';

const STATUS_ICONS: Record<string, string> = {
  waiting: '⏱️',
  active: '⚙️',
  completed: '✅',
  failed: '❌',
  cancelled: '⚠️',
};

export function createJobCard(job: JobHistoryItem, onRemove: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = `job-card job-card--${job.status}`;
  card.dataset.jobId = job.jobId;

  card.innerHTML = `
    <div class="job-card__header">
      <span class="job-card__status-marker"></span>
      <span class="job-card__icon">${STATUS_ICONS[job.status]}</span>
      <span class="job-card__format">${job.targetFormat.toUpperCase()}</span>
      <button class="job-card__remove-btn" aria-label="${t('history.remove')}">✕</button>
    </div>
    <div class="job-card__file-name">${escapeHtml(job.fileName)}</div>
    ${job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled' ? `
    <div class="job-card__progress-section">
      <div class="job-card__progress-bar">
        <div class="job-card__progress-fill" style="width:${job.progress}%"></div>
      </div>
      <span class="job-card__progress-text">${job.progress}%</span>
    </div>` : ''}
    <div class="job-card__download-slot"></div>
    <div class="job-card__error-slot"></div>
    <div class="job-card__timestamp">${new Date(job.createdAt).toLocaleString(getLocale() === 'ru' ? 'ru-RU' : 'en-US')}</div>
  `;

  card.querySelector('.job-card__remove-btn')!.addEventListener('click', onRemove);

  const downloadSlot = card.querySelector('.job-card__download-slot') as HTMLElement;
  const errorSlot = card.querySelector('.job-card__error-slot') as HTMLElement;

  if (job.status === 'completed' && job.outputUrl) {
    downloadSlot.appendChild(createDownloadButton(job.outputUrl, `${job.jobId}.${job.targetFormat}`));
  }

  if (job.status === 'failed' && job.error) {
    errorSlot.innerHTML = `<div class="job-card__error">${escapeHtml(job.error)}</div>`;
  }

  if (job.status === 'cancelled') {
    errorSlot.innerHTML = `<div class="job-card__info">${escapeHtml(job.error || t('status.cancelled'))}</div>`;
  }

  return card;
}

export function updateJobCard(element: HTMLElement, job: JobHistoryItem): void {
  const icon = element.querySelector('.job-card__icon') as HTMLElement;
  const downloadSlot = element.querySelector('.job-card__download-slot') as HTMLElement;
  const errorSlot = element.querySelector('.job-card__error-slot') as HTMLElement;
  const progressSection = element.querySelector('.job-card__progress-section') as HTMLElement | null;

  element.className = `job-card job-card--${job.status}`;
  icon.textContent = STATUS_ICONS[job.status] || '⏱️';

  if (progressSection) {
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      progressSection.remove();
    } else {
      const fill = progressSection.querySelector('.job-card__progress-fill') as HTMLElement;
      const progressText = progressSection.querySelector('.job-card__progress-text') as HTMLElement;
      fill.style.width = `${job.progress}%`;
      progressText.textContent = `${job.progress}%`;
    }
  }

  downloadSlot.innerHTML = '';
  errorSlot.innerHTML = '';

  if (job.status === 'completed' && job.outputUrl) {
    downloadSlot.appendChild(createDownloadButton(job.outputUrl, `${job.jobId}.${job.targetFormat}`));
  }

  if (job.status === 'failed' && job.error) {
    errorSlot.innerHTML = `<div class="job-card__error">${escapeHtml(job.error)}</div>`;
  }

  if (job.status === 'cancelled') {
    errorSlot.innerHTML = `<div class="job-card__info">${escapeHtml(job.error || t('status.cancelled'))}</div>`;
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

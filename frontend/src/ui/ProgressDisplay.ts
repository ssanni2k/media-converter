import '../css/ProgressDisplay.css';
import type { JobStatus } from '../types';
import { createDownloadButton } from './DownloadButton';
import { t, pluralize } from '../i18n/index.js';

function getStatusConfig(status: string): { label: string; icon: string } {
  const icons: Record<string, string> = {
    idle: '⏳', uploading: '⬆️', waiting: '⏱️', active: '⚙️',
    completed: '✅', failed: '❌', cancelled: '⚠️',
  };
  return { label: t(`status.${status}`), icon: icons[status] || icons.idle };
}

function formatWaitTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return t('progress.eta', { seconds });
  const minutes = Math.ceil(seconds / 60);
  return t('progress.etaMinutes', { minutes });
}

interface ProgressDisplayUpdate {
  status: JobStatus | 'uploading' | 'idle';
  progress: number;
  isConnected?: boolean;
  estimatedTotal?: number;
  conversionStartTime?: number;
  queueCount?: number;
  estimatedWaitMs?: number;
  outputUrl?: string;
  outputFileName?: string;
  error?: string;
}

export function mountProgressDisplay(
  container: HTMLElement,
  { onCancel, onReset, onReconvert }: { onCancel?: () => void; onReset?: () => void; onReconvert?: () => void }
): {
  update: (opts: ProgressDisplayUpdate) => void;
} {
  container.innerHTML = `
    <div class="progress-display">
      <div class="progress-display__header">
        <span class="progress-display__icon">⏳</span>
        <span class="progress-display__label">${t('status.idle')}</span>
        <span class="progress-display__connection-status" style="display:none"></span>
      </div>
      <div class="progress-display__bar">
        <div class="progress-display__fill" style="width:0%"></div>
      </div>
      <div class="progress-display__info">
        <span class="progress-display__percentage">0%</span>
        <span class="progress-display__eta" style="display:none"></span>
      </div>
      <div class="progress-display__queue-info" style="display:none"></div>
      <div class="progress-display__error" style="display:none"></div>
      <div class="progress-display__download-slot"></div>
      <div class="progress-display__actions">
        <button class="progress-display__cancel-btn" style="display:none">${t('progress.cancel')}</button>
        <button class="progress-display__reconvert-btn" style="display:none">${t('progress.reconvert')}</button>
        <button class="progress-display__reset-btn" style="display:none">${t('progress.reset')}</button>
      </div>
    </div>
  `;

  const root = container.querySelector('.progress-display') as HTMLElement;
  const icon = container.querySelector('.progress-display__icon') as HTMLElement;
  const label = container.querySelector('.progress-display__label') as HTMLElement;
  const connectionStatus = container.querySelector('.progress-display__connection-status') as HTMLElement;
  const bar = container.querySelector('.progress-display__bar') as HTMLElement;
  const fill = container.querySelector('.progress-display__fill') as HTMLElement;
  const percentage = container.querySelector('.progress-display__percentage') as HTMLElement;
  const eta = container.querySelector('.progress-display__eta') as HTMLElement;
  const queueInfo = container.querySelector('.progress-display__queue-info') as HTMLElement;
  const errorEl = container.querySelector('.progress-display__error') as HTMLElement;
  const downloadSlot = container.querySelector('.progress-display__download-slot') as HTMLElement;
  const cancelBtn = container.querySelector('.progress-display__cancel-btn') as HTMLButtonElement;
  const reconvertBtn = container.querySelector('.progress-display__reconvert-btn') as HTMLButtonElement;
  const resetBtn = container.querySelector('.progress-display__reset-btn') as HTMLButtonElement;

  if (onCancel) cancelBtn.addEventListener('click', onCancel);
  if (onReconvert) reconvertBtn.addEventListener('click', onReconvert);
  if (onReset) resetBtn.addEventListener('click', onReset);

  let prevStatus = '';
  let animFrame = 0;
  let displayedProgress = 0;

  function animateTo(targetProgress: number) {
    cancelAnimationFrame(animFrame);
    const step = () => {
      const diff = targetProgress - displayedProgress;
      if (Math.abs(diff) < 0.5) {
        displayedProgress = targetProgress;
        fill.style.width = `${displayedProgress}%`;
        percentage.textContent = `${Math.round(displayedProgress)}%`;
        return;
      }
      displayedProgress += diff * 0.15;
      fill.style.width = `${displayedProgress}%`;
      percentage.textContent = `${Math.round(displayedProgress)}%`;
      animFrame = requestAnimationFrame(step);
    };
    animFrame = requestAnimationFrame(step);
  }

  return {
    update({ status, progress, isConnected, estimatedTotal, conversionStartTime, queueCount, estimatedWaitMs, outputUrl, outputFileName, error }) {
      if (status === 'waiting') {
        cancelAnimationFrame(animFrame);
        displayedProgress = 0;
        bar.style.display = 'none';
        eta.style.display = 'none';
        percentage.style.display = 'none';

        if (queueCount !== undefined && queueCount > 0) {
          let text = pluralize(queueCount, 'progress.queueAhead', { count: queueCount });
          if (estimatedWaitMs && estimatedWaitMs > 0) {
            text += ' ' + t('progress.queueWait', { eta: formatWaitTime(estimatedWaitMs) });
          }
          queueInfo.textContent = text;
          queueInfo.style.display = '';
        } else {
          queueInfo.textContent = t('progress.queuePending');
          queueInfo.style.display = '';
        }
      } else if (status === 'uploading') {
        cancelAnimationFrame(animFrame);
        displayedProgress = 0;
        fill.style.width = '100%';
        queueInfo.style.display = 'none';
        bar.style.display = '';
        percentage.style.display = '';
        percentage.textContent = t('progress.uploadProgress', { percent: Math.round(progress) });
        eta.style.display = 'none';
      } else if (status === 'active') {
        queueInfo.style.display = 'none';
        bar.style.display = '';
        percentage.style.display = '';

        animateTo(progress);

        if (estimatedTotal && conversionStartTime) {
          const elapsed = Date.now() - conversionStartTime;
          const remaining = Math.max(0, estimatedTotal - elapsed);
          if (remaining > 0) {
            const seconds = Math.ceil(remaining / 1000);
            eta.style.display = '';
            eta.textContent = t('progress.eta', { seconds });
          } else {
            eta.style.display = 'none';
          }
        } else {
          eta.style.display = 'none';
        }
      } else if (status === 'completed') {
        queueInfo.style.display = 'none';
        bar.style.display = '';
        percentage.style.display = '';
        eta.style.display = 'none';

        cancelAnimationFrame(animFrame);
        displayedProgress = 100;
        fill.style.width = '100%';
        percentage.textContent = '100%';
      } else if (status === 'failed') {
        queueInfo.style.display = 'none';
        bar.style.display = '';
        percentage.style.display = '';
        eta.style.display = 'none';

        cancelAnimationFrame(animFrame);
        displayedProgress = progress;
        fill.style.width = `${progress}%`;
        percentage.textContent = `${Math.round(progress)}%`;
      } else if (status === 'cancelled') {
        queueInfo.style.display = 'none';
        bar.style.display = 'none';
        percentage.style.display = 'none';
        eta.style.display = 'none';
      }

      if (status === 'failed' && error) {
        errorEl.textContent = error;
        errorEl.style.display = '';
      } else {
        errorEl.style.display = 'none';
      }

      downloadSlot.innerHTML = '';
      if (status === 'completed' && outputUrl) {
        downloadSlot.appendChild(createDownloadButton(outputUrl, outputFileName));
      }

      const isProcessing = status === 'uploading' || status === 'waiting' || status === 'active';
      const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled';

      cancelBtn.style.display = isProcessing ? '' : 'none';
      reconvertBtn.style.display = isTerminal ? '' : 'none';
      resetBtn.style.display = isTerminal ? '' : 'none';

      if (status !== prevStatus) {
        prevStatus = status;
        const config = getStatusConfig(status);
        icon.textContent = config.icon;
        label.textContent = config.label;

        root.className = `progress-display progress-display--${status}`;

        if (status === 'active' || status === 'uploading') {
          connectionStatus.style.display = status === 'active' ? '' : 'none';
          if (status === 'active') {
            connectionStatus.textContent = isConnected ? t('progress.online') : t('progress.polling');
          }
          fill.classList.add('progress-display__fill--shimmer');
        } else {
          connectionStatus.style.display = 'none';
          fill.classList.remove('progress-display__fill--shimmer');
        }
      } else if (status === 'active') {
        connectionStatus.textContent = isConnected ? t('progress.online') : t('progress.polling');
      }
    },
  };
}
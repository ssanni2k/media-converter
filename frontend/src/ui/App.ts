import '../css/App.css';
import type { AppStore } from '../store/AppStore';
import { mountTabBar, type TabId } from './TabBar';
import { mountFileUpload } from './FileUpload';
import { mountFormatSelector } from './FormatSelector';
import { mountProgressDisplay } from './ProgressDisplay';
import { mountJobHistory } from './JobHistory';
import { mountAnimatedBackground } from './AnimatedBackground';
import { mountStatsPage } from './StatsPage';

const BUTTERFLY_SVG = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 50 L14 38 L6 46 L22 54 Z" fill="#209CEE"/>
  <path d="M50 50 L30 58 L22 66 L38 64 Z" fill="#33C2FF"/>
  <path d="M50 50 L62 64 L78 66 L70 58 Z" fill="#33C2FF"/>
  <path d="M50 50 L78 54 L94 46 L86 38 Z" fill="#209CEE"/>
  <line x1="50" y1="36" x2="50" y2="64" stroke="#8CD7FF" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

export function mountApp(container: HTMLElement, store: AppStore): () => void {
  container.innerHTML = `
    <canvas class="animated-background__canvas"></canvas>
    <div class="app">
      <header class="header">
        <div class="header__brand">
          <span class="header__logo">${BUTTERFLY_SVG}</span>
          <div>
            <h1 class="header__title">Сервис конвертации медиа</h1>
            <p class="header__subtitle">Конвертируйте аудио и видео файлы в любой формат</p>
          </div>
        </div>
        <div class="header__tabs"></div>
        <button class="animated-background__toggle">⏸</button>
      </header>

      <main class="main">
        <div class="tab-converter">
          <div class="converter-card">
            <div class="file-upload-slot"></div>
            <div class="format-selector-slot"></div>

            <div class="actions">
              <div class="action-idle">
                <button class="convert-btn" disabled>Конвертировать</button>
              </div>
              <div class="action-converting hidden">
                <div class="progress-display-slot"></div>
              </div>
            </div>
          </div>

          <div class="job-history-slot"></div>
        </div>

        <div class="tab-statistics hidden">
          <div class="stats-slot"></div>
        </div>
      </main>

      <footer class="footer">
        <span class="footer__text">Сервис конвертации медиа &copy; 2026</span>
      </footer>
    </div>
  `;

  // Mount tab bar
  const tabConverter = container.querySelector('.tab-converter') as HTMLElement;
  const tabStatistics = container.querySelector('.tab-statistics') as HTMLElement;
  const statsSlot = container.querySelector('.stats-slot') as HTMLElement;

  let statsLoaded = false;
  let statsCleanup: (() => void) | null = null;

  mountTabBar(
    container.querySelector('.header__tabs')!,
    (tabId: TabId) => {
      tabConverter.classList.toggle('hidden', tabId !== 'converter');
      tabStatistics.classList.toggle('hidden', tabId !== 'statistics');

      if (tabId === 'statistics' && !statsLoaded) {
        statsLoaded = true;
        statsCleanup = mountStatsPage(statsSlot);
      }
    }
  );

  // Mount children
  const fileUploadCleanup = mountFileUpload(
    container.querySelector('.file-upload-slot')!,
    store
  );
  const formatSelectorCleanup = mountFormatSelector(
    container.querySelector('.format-selector-slot')!,
    store
  );
  const progressDisplay = mountProgressDisplay(
    container.querySelector('.progress-display-slot')!,
    {
      onCancel: () => store.cancelConversion(),
      onReconvert: () => {
        if (store.selectedFile) store.startConversion(store.selectedFile, store.selectedFormat);
      },
      onReset: () => { store.setSelectedFile(null); store.reset(); },
    }
  );
  const jobHistoryCleanup = mountJobHistory(
    container.querySelector('.job-history-slot')!,
    store
  );

  // Mount animated background
  const bgCleanup = mountAnimatedBackground(
    container.querySelector('.animated-background__canvas') as HTMLCanvasElement,
    container.querySelector('.animated-background__toggle') as HTMLButtonElement
  );

  // Action sections
  const actionIdle = container.querySelector('.action-idle') as HTMLElement;
  const actionConverting = container.querySelector('.action-converting') as HTMLElement;
  const convertBtn = container.querySelector('.convert-btn') as HTMLButtonElement;

  // Conversion flow
  convertBtn.addEventListener('click', () => {
    if (!store.selectedFile) return;
    store.startConversion(store.selectedFile, store.selectedFormat);
  });

  // Show/hide sections based on conversion state
  const onFileChange = (file: File | null) => {
    convertBtn.disabled = !file;
  };

  const onConversionChange = () => {
    const { status, progress, outputUrl, error } = store.conversion;
    const { isConnected } = store;

    actionIdle.classList.toggle('hidden', status !== 'idle');
    actionConverting.classList.toggle('hidden', status === 'idle');

    progressDisplay.update({
      status,
      progress,
      isConnected,
      estimatedTotal: store.conversion.estimatedTotal,
      conversionStartTime: store.conversion.conversionStartTime,
      queueCount: store.conversion.queueCount,
      estimatedWaitMs: store.conversion.estimatedWaitMs,
      outputUrl,
      outputFileName: outputUrl ? `converted.${store.selectedFormat}` : undefined,
      error,
    });

    convertBtn.disabled = !store.selectedFile || status !== 'idle';
  };

  store.on('file:change', onFileChange);
  store.on('conversion:change', onConversionChange);
  onFileChange(store.selectedFile);

  // Cross-tab sync: when another tab updates localStorage, reload history
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'conversion_job_history') {
      store.syncFromStorage();
    }
  };
  window.addEventListener('storage', onStorage);

  // Reconcile stale history with server (fixes stuck cards after refresh)
  store.reconcileHistory();

  return () => {
    fileUploadCleanup();
    formatSelectorCleanup();
    jobHistoryCleanup();
    bgCleanup();
    statsCleanup?.();
    window.removeEventListener('storage', onStorage);
    store.off('file:change', onFileChange);
    store.off('conversion:change', onConversionChange);
  };
}

import '../css/DownloadButton.css';
import { getDownloadUrl } from '../api/conversionApi';

export function createDownloadButton(outputUrl: string, fileName?: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'download-btn';
  let downloading = false;

  btn.innerHTML = `<span class="download-btn__icon">⬇️</span><span>Скачать</span>`;

  btn.addEventListener('click', async () => {
    if (downloading) return;

    const fullUrl = getDownloadUrl(outputUrl);

    try {
      downloading = true;
      btn.disabled = true;
      btn.innerHTML = `<span class="download-btn__icon">⏳</span><span>Загрузка...</span>`;

      const response = await fetch(fullUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'converted-file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(fullUrl, '_blank');
    } finally {
      downloading = false;
      btn.disabled = false;
      btn.innerHTML = `<span class="download-btn__icon">⬇️</span><span>Скачать</span>`;
    }
  });

  return btn;
}

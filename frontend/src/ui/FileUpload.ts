import '../css/FileUpload.css';
import type { AppStore } from '../store/AppStore';
import { t } from '../i18n/index.js';

export function mountFileUpload(container: HTMLElement, store: AppStore): () => void {
  container.innerHTML = `
    <div class="upload-zone">
      <input type="file" accept="audio/*,video/*" class="upload-zone__input" id="file-input" />
      <label for="file-input" class="upload-zone__label">
        <span class="upload-zone__icon">📁</span>
        <span class="upload-zone__text">${t('upload.dragDrop')}</span>
        <span class="upload-zone__hint">${t('upload.supported')}</span>
        <span class="upload-zone__size-limit">${t('upload.maxSize', { size: 200 })}</span>
      </label>
      <div class="upload-zone__selected" style="display:none">
        <span class="upload-zone__file-icon"></span>
        <span class="upload-zone__file-name"></span>
        <span class="upload-zone__file-size"></span>
      </div>
    </div>
  `;

  const zone = container.querySelector('.upload-zone') as HTMLElement;
  const input = container.querySelector('.upload-zone__input') as HTMLInputElement;
  const label = container.querySelector('.upload-zone__label') as HTMLElement;
  const selected = container.querySelector('.upload-zone__selected') as HTMLElement;
  const fileIcon = container.querySelector('.upload-zone__file-icon') as HTMLElement;
  const fileName = container.querySelector('.upload-zone__file-name') as HTMLElement;
  const fileSize = container.querySelector('.upload-zone__file-size') as HTMLElement;

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!zone.classList.contains('upload-zone--disabled')) {
      zone.classList.add('upload-zone--dragging');
    }
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    zone.classList.remove('upload-zone--dragging');
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    zone.classList.remove('upload-zone--dragging');

    if (zone.classList.contains('upload-zone--disabled')) return;

    const file = e.dataTransfer?.files[0];
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
      store.setSelectedFile(file);
    }
  };

  const onInputChange = () => {
    const file = input.files?.[0];
    if (file) store.setSelectedFile(file);
  };

  zone.addEventListener('dragover', onDragOver);
  zone.addEventListener('dragleave', onDragLeave);
  zone.addEventListener('drop', onDrop);
  input.addEventListener('change', onInputChange);

  const showFile = (file: File) => {
    label.style.display = 'none';
    selected.style.display = 'flex';
    fileIcon.textContent = file.type.startsWith('video/') ? t('upload.videoIcon') : t('upload.audioIcon');
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} ${t('upload.fileSizeUnit')}`;
    zone.classList.add('upload-zone--has-file');
  };

  const clearFile = () => {
    label.style.display = 'flex';
    selected.style.display = 'none';
    zone.classList.remove('upload-zone--has-file');
    input.value = '';
  };

  const onFileChange = (file: File | null) => {
    if (file) showFile(file);
    else clearFile();
  };

  const onConversionChange = () => {
    const isProcessing = store.conversion.status !== 'idle' && store.conversion.status !== 'completed' && store.conversion.status !== 'failed';
    if (isProcessing) {
      zone.classList.add('upload-zone--disabled');
      input.disabled = true;
    } else {
      zone.classList.remove('upload-zone--disabled');
      input.disabled = false;
    }
  };

  store.on('file:change', onFileChange);
  store.on('conversion:change', onConversionChange);

  return () => {
    zone.removeEventListener('dragover', onDragOver);
    zone.removeEventListener('dragleave', onDragLeave);
    zone.removeEventListener('drop', onDrop);
    input.removeEventListener('change', onInputChange);
    store.off('file:change', onFileChange);
    store.off('conversion:change', onConversionChange);
  };
}

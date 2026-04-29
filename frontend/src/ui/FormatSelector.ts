import '../css/FormatSelector.css';
import { SUPPORTED_FORMATS, getCompatibleFormats, getFormatInfo, getCategoryLabel } from '../types';
import type { SupportedFormat, FormatCategory } from '../types';
import type { AppStore } from '../store/AppStore';
import { t } from '../i18n/index.js';

function buildOptionsHtml(formats: SupportedFormat[]): string {
  const groups: Record<FormatCategory, SupportedFormat[]> = {
    audio: [],
    video: [],
    container: [],
  };

  for (const fmt of formats) {
    groups[getFormatInfo(fmt).category].push(fmt);
  }

  return (Object.entries(groups) as [FormatCategory, SupportedFormat[]][])
    .filter(([, formats]) => formats.length > 0)
    .map(([category, formats]) => {
      const options = formats
        .map((f) => {
          const info = getFormatInfo(f);
          return `<option value="${f}">${info.icon} ${info.label()}</option>`;
        })
        .join('');
      return `<optgroup label="${getCategoryLabel(category)}">${options}</optgroup>`;
    })
    .join('');
}

export function mountFormatSelector(container: HTMLElement, store: AppStore): () => void {
  const formats: SupportedFormat[] = [...SUPPORTED_FORMATS];
  const optionsHtml = buildOptionsHtml(formats);

  container.innerHTML = `
    <div class="format-selector">
      <label class="format-selector__label">${t('format.label')}</label>
      <select class="format-selector__select">${optionsHtml}</select>
    </div>
  `;

  const select = container.querySelector('.format-selector__select') as HTMLSelectElement;
  select.value = store.selectedFormat;

  select.addEventListener('change', () => {
    store.setSelectedFormat(select.value as SupportedFormat);
  });

  const onSourceFormatChange = (sourceFormat: string | null) => {
    const filtered = sourceFormat ? getCompatibleFormats(sourceFormat) : [...SUPPORTED_FORMATS];
    if (filtered.length === 0) return;

    const currentVal = select.value as SupportedFormat;
    select.innerHTML = buildOptionsHtml(filtered);

    if (filtered.includes(currentVal)) {
      select.value = currentVal;
    } else {
      select.value = filtered[0];
      store.setSelectedFormat(filtered[0]);
    }
  };

  const onConversionChange = () => {
    const isProcessing = store.conversion.status !== 'idle'
      && store.conversion.status !== 'completed'
      && store.conversion.status !== 'failed';
    select.disabled = isProcessing;
  };

  store.on('sourceFormat:change', onSourceFormatChange);
  store.on('conversion:change', onConversionChange);

  return () => {
    store.off('sourceFormat:change', onSourceFormatChange);
    store.off('conversion:change', onConversionChange);
  };
}

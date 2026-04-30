import ru from './ru.js';
import en from './en.js';

type TranslationValue = string | { [key: string]: TranslationValue };
type Translations = { [key: string]: TranslationValue };

const dictionaries: Record<string, Translations> = { ru, en };
const STORAGE_KEY = 'media_converter_locale';

const DEFAULT_LOCALE = 'ru';
const SUPPORTED_LOCALES = ['ru', 'en'];

let currentLocale = DEFAULT_LOCALE;

try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored)) {
    currentLocale = stored;
  }
} catch {}

function getDictionary(): Translations {
  return dictionaries[currentLocale] || dictionaries[DEFAULT_LOCALE];
}

function resolve(obj: TranslationValue, path: string[]): string | undefined {
  let current: TranslationValue | undefined = obj;
  for (const key of path) {
    if (current == null || typeof current === 'string') return undefined;
    current = (current as Record<string, TranslationValue>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const path = key.split('.');
  let value = resolve(getDictionary(), path);

  if (value === undefined) {
    value = resolve(dictionaries[DEFAULT_LOCALE], path);
  }

  if (value === undefined) return key;

  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, name) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`
    );
  }

  return value;
}

export function pluralize(count: number, key: string, params?: Record<string, string | number>): string {
  if (currentLocale === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    let suffix: string;
    if (mod100 >= 11 && mod100 <= 19) {
      suffix = '_many';
    } else if (mod10 === 1) {
      suffix = '_one';
    } else if (mod10 >= 2 && mod10 <= 4) {
      suffix = '_few';
    } else {
      suffix = '_many';
    }
    const formKey = `${key}${suffix}`;
    return t(formKey, { count, ...params });
  }

  const suffix = count === 1 ? '_one' : '_other';
  const formKey = `${key}${suffix}`;
  return t(formKey, { count, ...params });
}

const ERROR_PATTERNS: [string, string][] = [
  ['No file uploaded', 'errors.noFileUploaded'],
  ['Unsupported format', 'errors.unsupportedFormat'],
  ['File upload failed', 'errors.fileUploadFailed'],
  ['File size exceeds', 'errors.fileSizeExceeded'],
  ['Cannot convert', 'errors.cannotConvert'],
  ['Job not found', 'errors.jobNotFound'],
  ['Job already finished', 'errors.jobAlreadyFinished'],
  ['Cancelled by user', 'errors.cancelledByUser'],
  ['Upload cancelled', 'errors.cancelled'],
  ['Uploaded file is empty', 'errors.fileEmpty'],
  ['Input file not found or corrupted', 'errors.fileNotFound'],
  ['Conversion timeout exceeded', 'errors.conversionTimeout'],
  ['Conversion stalled', 'errors.conversionStalled'],
  ['Unsupported file format', 'errors.unsupportedFileFormat'],
  ['Failed to determine file duration', 'errors.durationTimeout'],
  ['Worker restarted', 'errors.workerRestarted'],
  ['Network error', 'errors.network'],
  ['Upload stalled', 'errors.uploadStalled'],
  ['Failed to parse SSE event', 'errors.sseParseError'],
  ['SSE connection error', 'errors.sseConnectionError'],
  ['Unknown error', 'errors.unknown'],
];

export function localizeError(message: string): string {
  if (!message) return t('errors.unknown');

  for (const [pattern, key] of ERROR_PATTERNS) {
    if (message.includes(pattern)) {
      return t(key);
    }
  }

  return message;
}

export function getLocale(): string {
  return currentLocale;
}

export function setLocale(locale: string): void {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  if (locale === currentLocale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
}
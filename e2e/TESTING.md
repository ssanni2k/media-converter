# E2E Тестирование

Тесты покрывают полный цикл работы приложения: загрузка файла, выбор формата, конвертацию, прогресс, скачивание результата, очередь, историю, статистику, обработку ошибок.

## Запуск

```bash
# Убедиться, что Docker контейнеры запущены
docker compose up --build -d

# Установить зависимости (один раз, из корня проекта)
npm install
npx playwright install chromium

# Запустить все E2E тесты
npm run test:e2e

# Запустить конкретный файл
npx @playwright/test tests/06-conversion-queue.spec.ts

# С видимым браузером / UI / HTML отчёт
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:report
```

## Конфигурация Playwright

| Параметр        | Значение      | Причина                          |
|----------------|---------------|----------------------------------|
| `baseURL`      | `http://localhost:5173` | Vite dev server          |
| `headless`     | `false`       | Видимый браузер для отладки      |
| `slowMo`       | `300`         | Замедление для наблюдаемости     |
| `workers`      | `1`           | Избежать коллизий rate limiting  |
| `timeout`      | `120_000`     | FFmpeg конвертация может быть медленной |

## Тестовые данные

Минимальные медиафайлы (~1 сек) в `e2e/test-data/`:

| Файл          | Формат | Размер | Описание                   |
|--------------|--------|--------|----------------------------|
| sample.wav   | WAV    | 16 KB  | 8000 Hz, mono, тишина     |
| sample.mp3   | MP3    | 1 KB   | Сжатый из sample.wav      |
| sample.ogg   | OGG    | 3 KB   | Vorbis, из sample.wav     |
| sample.flac  | FLAC   | 8 KB   | Без потерь, из sample.wav |
| sample.webm  | WebM   | 1 KB   | Opus аудио                 |
| sample.mp4   | MP4    | 1 KB   | AAC аудио (без видео)      |
| sample.mov   | MOV    | 12 KB  | H.264 + AAC, 1 сек видео  |
| sample.avi   | AVI    | 21 KB  | H.264 + MP3, 1 сек видео  |
| sample.mkv   | MKV    | 11 KB  | H.264 + AAC, Matroska      |
| sample.flv   | FLV    | 12 KB  | H.264 + AAC, Flash Video   |
| sample.ts    | TS     | 19 KB  | H.264 + AAC, MPEG-TS       |
| sample.mxf   | MXF    | 141 KB | MPEG-2 + PCM, Material eXchange |
| sample.asf   | ASF    | 20 KB  | H.264 + WMA v2              |
| sample.aac   | AAC    | 9 KB   | AAC в ADTS контейнере      |
| sample.wma   | WMA    | 20 KB  | WMA v2 в ASF контейнере    |
| sample.ac3   | AC3    | 12 KB  | Dolby Digital              |
| invalid.txt  | TXT    | 25 B   | Для тестов отклонения      |

## Вспомогательные модули

### `helpers/selectors.ts`

CSS-селекторы для всех UI-элементов. Используется во всех тестах для локации элементов.

### `helpers/wait-for.ts`

Функции ожидания:
- `waitForProgressStatus(page, status)` — ожидание статуса на прогресс-дисплее
- `waitForConnectionIndicator(page)` — ожидание индикатора подключения
- `uploadAndWaitForCompletion(page, filePath, format)` — загрузка файла, выбор формата, конвертация, ожидание завершения
- `clearConverter(page)` — нажатие «Очистить» и ожидание idle-состояния
- `clearLocalStorage(page)` — очистка localStorage и перезагрузка
- `waitForHistoryCardCount(page, count)` — ожидание количества карточек в истории

### `helpers/compatibility.ts`

Определяет, какие конвертации нужно пропустить (`test.skip`):
- Самоконвертация (mp3 → mp3) — всегда skip
- Аудио → видео (wav → mp4) — skip, FFmpeg не может создать видео из аудио
- MXF в любом направлении — skip, тестовые файлы не содержат видеопоток, требуемый MXF muxer

### `helpers/test-media.ts`

Пути к тестовым файлам и массив `SUPPORTED_INPUTS` — список всех форматов, для которых есть тестовые данные.

---

## Тест-сюиты

### 01 — Initial Render (1 тест)

**Файл:** `tests/01-initial-render.spec.ts`

| Тест | Назначение |
|------|-----------|
| `page loads with all UI elements in initial state` | Проверяет корректность начального рендера: заголовок, подзаголовок, upload zone, format selector (16 опций, 3 optgroup'а), кнопка disabled, скрытые секции, canvas анимации |

**Тестируемый функционал:** Все UI компоненты при первой загрузке.

---

### 02 — File Upload (5 тестов)

**Файл:** `tests/02-file-upload.spec.ts`

| Тест | Назначение |
|------|-----------|
| `upload audio file via file input` | Загрузка WAV через `<input>`: скрытие label, показ имени файла, иконка `🎵`, CSS-класс `--has-file`, кнопка enabled |
| `upload video file shows video icon` | Загрузка MP4: иконка `🎬` вместо `🎵` |
| `drag states apply correct CSS classes` | `dragover` добавляет `--dragging`, `dragleave` убирает |
| `non-media file is rejected via drag and drop` | Файл `invalid.txt` через `DataTransfer` + `DragEvent` отклоняется |
| `file size limit is displayed` | Текст «Максимальный размер файла: 200 МБ» виден в зоне загрузки |

**Тестируемый функционал:** `frontend/src/ui/FileUpload.ts` — drag & drop, file input, валидация типов, подсказка лимита.

---

### 03 — Format Selector (2 теста)

**Файл:** `tests/03-format-selector.spec.ts`

| Тест | Назначение |
|------|-----------|
| `format selector defaults to MP3 and has 16 options in 3 groups` | Дефолтное значение `mp3`, 16 `<option>`, 3 `<optgroup>` (Аудио, Видео, Контейнеры) |
| `selecting different formats updates the value` | Выбор flac/wav/mkv/mov обновляет значение select'а |

**Тестируемый функционал:** `frontend/src/ui/FormatSelector.ts`, `frontend/src/types.ts`.

---

### 05 — Re-conversion (2 теста)

**Файл:** `tests/05-reconversion.spec.ts`

| Тест | Назначение |
|------|-----------|
| `convert same file to different formats sequentially` | WAV→MP3, повторная конвертация (кнопка «Конвертировать»), WAV→MP3 ещё раз — история содержит 2 карточки |
| `convert WAV → OGG then clean and convert WAV → FLAC` | WAV→OGG, очистка конвертера, WAV→FLAC — обе загрузки успешны, в истории 2 карточки с разными форматами |

**Тестируемый функционал:** Повторная конвертация без перезагрузки, сброс конвертера, корректная работа JobHistory. Формат-селектор динамически обновляет доступные опции после очистки.

---

### 06 — Conversion Queue (7 тестов)

**Файл:** `tests/06-conversion-queue.spec.ts`

| Тест | Назначение |
|------|-----------|
| `priority is assigned based on file size` | Отправка маленького файла через API, проверка `priorityName === 'high'` и `fileSize > 0` в статусе |
| `multiple jobs are processed without loss` | 3 задачи через API, все завершаются (`status === 'completed'`) |
| `concurrent processing — two workers handle two jobs simultaneously` | 2 задачи через API, обе достигают `active` (параллельная обработка 2 high-воркерами) |
| `FIFO ordering — jobs created in sequence complete in order` | Задача A → `active`, задача B → обе завершаются, `createdAt A ≤ createdAt B` |
| `stats endpoint returns correct queue data` | `GET /stats` возвращает `queueCount` и `avgProcessingTimeMs` |
| `active jobs do not appear in history during conversion` | Задача в процессе → 0 карточек в истории, после завершения → 1 карточка |
| `queue info is hidden after conversion completes` | UI: информация об очереди скрыта после завершения конвертации |

**Тестируемый функционал:** Кастомная FIFO очередь с приоритетами, Lua-скрипты атомарных операций, Pub/Sub распределение, параллельная обработка, статистика.

---

### 07 — Progress Display (4 теста)

**Файл:** `tests/07-progress-display.spec.ts`

| Тест | Назначение |
|------|-----------|
| `progress display shows correct status during conversion` | Секция прогресса появляется, дождаться completed |
| `SSE connection indicator appears during active phase` | Индикатор `🟢 Онлайн` или `🟠 Опрос` виден при активной конвертации |
| `progress bar width matches percentage text` | CSS `width` в стиле совпадает с текстом процента |
| `progress percentage increases over time` | Процент через 1 секунду >= начального значения |

**Ограничения:** Для маленьких тестовых файлов конвертация завершается быстро, фаза «Конвертация...» может не отобразиться. Тесты используют try/catch — если активная фаза не видна, assertion пропускается.

---

### 08 — Completion & Download (2 теста)

**Файл:** `tests/08-completion-download.spec.ts`

| Тест | Назначение |
|------|-----------|
| `download button produces file with correct extension` | Скачивание даёт файл с расширением `.mp3`, размер > 0 |
| `verify conversion via API after UI completion` | GET `/jobs/:id` через API возвращает `status: completed`, `progress: 100` |

**Тестируемый функционал:** Download button, API статус, `frontend/src/ui/ProgressDisplay.ts`.

---

### 09 — Error Handling (2 теста)

**Файл:** `tests/09-error-handling.spec.ts`

| Тест | Назначение |
|------|-----------|
| `server error shows error section with retry button` | Route intercept (mock 500) → показ секции ошибки с кнопками «Попробовать снова» и «Очистить» |
| `clean after error returns to idle state` | Кнопка «Очистить» после ошибки возвращает в idle |

**Тестируемый функционал:** `frontend/src/store/AppStore.ts` (обработка ошибок), Playwright route intercept.

---

### 10 — Job History (4 теста)

**Файл:** `tests/10-job-history.spec.ts`

| Тест | Назначение |
|------|-----------|
| `conversion appears in job history` | После конвертации карточка появляется в истории |
| `job history persists after page reload` | Перезагрузка страницы — карточка остаётся (localStorage) |
| `individual job removal` | Удаление одной карточки из истории |
| `clear all history` | Кнопка «Очистить всё» удаляет все карточки |

**Тестируемый функционал:** `frontend/src/store/JobHistoryStore.ts`, `frontend/src/ui/JobHistory.ts`, `frontend/src/ui/JobCard.ts`.

---

### 11 — Animated Background (1 тест)

**Файл:** `tests/11-animated-background.spec.ts`

| Тест | Назначение |
|------|-----------|
| `animated background toggle works` | Canvas прикреплён к DOM, кнопка toggle меняет текст ⏸/▶, скриншот совпадает |

**Тестируемый функционал:** `frontend/src/ui/AnimatedBackground.ts` — canvas анимация бабочек.

---

### 12 — Rate Limiting (1 тест)

**Файл:** `tests/12-rate-limiting.spec.ts`

| Тест | Назначение |
|------|-----------|
| `rate limiting: browser-based requests eventually get 429` | 600 fetch-запросов из браузера к `/jobs/*` — хотя бы один возвращает 429, первые 5+ успешны |

**Тестируемый функционал:** `@fastify/rate-limit`. Запросы идут через `page.evaluate(fetch(...))`, а не через Playwright `request` fixture, т.к. тот использует другой network path.

**Ограничения:** Если предыдущие тесты исчерпали лимит (100/мин), тест может упасть. Решение: запускать отдельно или ждать истечения окна.

---

## Тесты форматов

### Общий сценарий тестирования

Для каждого из 16 поддерживаемых форматов генерируются два тест-файла (API и UI) с параметризованными тестами. Общий сценарий:

**Из формата X** — 15 тестов: конвертация X → каждый из 15 остальных форматов.

**В формат X** — 15 тестов: конвертация каждого из 15 остальных форматов → X.

Итого: 30 тестов на формат, 480 тестов в API и 480 в UI (960 суммарно).

### Пропуски (test.skip)

Через `shouldSkipConversion(source, target)` из `helpers/compatibility.ts`:
- Самоконвертация (source === target)
- Аудио → видео (audio-only форматы в video-форматы и контейнеры, требующие видео-кодек: mp4, webm, mov, avi, flv, mkv, ts, mxf, asf)
- MXF в любом направлении (тестовые файлы не содержат видеопоток)

### API-тесты (`tests/formats/api/`)

Общий сценарий для каждого теста:
1. `POST /convert` с файлом исходного формата и целевым форматом → 200 + `jobId`
2. Polling `GET /jobs/{jobId}` каждые 1с до `status === 'completed'`
3. `GET /outputs/{outputUrl}` → 200
4. Проверка расширения в `outputUrl`

Тесты выполняются через Playwright `request` fixture (без браузера). Быстро (~30 сек на формат).

### UI-тесты (`tests/formats/ui/`)

Общий сценарий для каждого теста:
1. Загрузка файла через `<input type="file">`
2. Выбор целевого формата в `<select>`
3. Клик «Конвертировать»
4. Ожидание статуса «Готово!»
5. Скачивание файла → проверка расширения

Тесты выполняются через браузер. Медленнее (~3 мин на формат).

### Запуск

```bash
# API-тесты одного формата (~30 сек)
npx @playwright/test tests/formats/api/mp3.spec.ts

# Все API-тесты
npx @playwright/test tests/formats/api/

# UI-тесты одного формата (~3 мин)
npx @playwright/test tests/formats/ui/mp3.spec.ts

# Все тесты (960, не рекомендуется)
npx @playwright/test tests/formats/
```

### Файлы

| Файл | Формат | API тестов | UI тестов |
|------|--------|-----------|-----------|
| `mp3.spec.ts` | MP3 | 30 | 30 |
| `wav.spec.ts` | WAV | 30 | 30 |
| `flac.spec.ts` | FLAC | 30 | 30 |
| `ogg.spec.ts` | OGG | 30 | 30 |
| `aac.spec.ts` | AAC | 30 | 30 |
| `wma.spec.ts` | WMA | 30 | 30 |
| `ac3.spec.ts` | AC3 | 30 | 30 |
| `mp4.spec.ts` | MP4 | 30 | 30 |
| `webm.spec.ts` | WebM | 30 | 30 |
| `mov.spec.ts` | MOV | 30 | 30 |
| `avi.spec.ts` | AVI | 30 | 30 |
| `flv.spec.ts` | FLV | 30 | 30 |
| `mkv.spec.ts` | MKV | 30 | 30 |
| `ts.spec.ts` | TS | 30 | 30 |
| `mxf.spec.ts` | MXF | 30 | 30 |
| `asf.spec.ts` | ASF | 30 | 30 |

# Media Converter Service

Веб-сервис для конвертации аудио и видео файлов между форматами с использованием FFmpeg.

## Возможности

- Конвертация между 16 форматами: MP3, WAV, FLAC, OGG, AAC, WMA, AC3, MP4, WebM, MOV, AVI, FLV, MKV, TS, MXF, ASF
- Drag & drop загрузка файлов
- Кастомная FIFO очередь с приоритетами на Redis (high/medium/low по размеру файла)
- Настраиваемое количество воркеров на каждый приоритет
- Отслеживание прогресса в реальном времени (SSE + polling fallback)
- Webhook уведомления о завершении конвертации
- История конвертаций (сохраняется в localStorage, max 20)
- Отмена конвертации из прогресс-бара и из карточки очереди
- Адаптивный тёмный UI с neumorphism эффектами и анимированным фоном
- Страница статистики с данными о задачах и очереди, Chart.js графики
- Интернационализация (русский / английский), переключатель в шапке
- Rate limiting запросов
- Автоматическая очистка старых файлов (cron, 24ч)

## Архитектура

```
                          ┌──────────────────────────────────┐
                          │        Redis (ioredis)           │
                          │                                  │
                          │  queue:jobs (List)               │
                          │  job:{id}   (Hash)               │
                          │  Pub/Sub каналы:                 │
                          │    job-progress                  │
                          │    stats-changed                 │
                          │    queue:new-job:{priority}      │
                          └──┬──────────┬──────────┬─────────┘
                             │          │          │
┌─────────────┐     ┌───────┴──┐  ┌────┴─────┐ ┌──┴──────────┐
│   Frontend  │────▶│    API   │  │  Worker  │ │  Cleanup    │
│ (VanillaTS) │     │ (Fastify)│  │ (FFmpeg) │ │  (cron)     │
└─────────────┘     └──────────┘  └──────────┘ └─────────────┘
```

### Очередь с приоритетами

Задачи хранятся в одном Redis List `queue:jobs` в порядке FIFO. Каждой задаче при поступлении назначается приоритет на основе размера файла:

| Приоритет | Размер файла | Воркеров по умолчанию |
|-----------|-------------|----------------------|
| high      | ≤ 10 МБ     | 2                    |
| medium    | ≤ 50 МБ     | 1                    |
| low       | ≤ 200 МБ    | 1                    |

Воркер передаёт очереди свой приоритет, и очередь через Lua-скрипт сканирует список от старых к новым, находя первую свободную задачу с совпадающим приоритетом. Задача не удаляется — при взятии помечается `assignedWorker`. При падении воркера его задачи автоматически переназначаются.

Событийная модель: при добавлении задачи публикуется сообщение на приоритетный Pub/Sub канал. Свободный воркер забирает задачу, занятый — игнорирует. После завершения воркер всегда опрашивает очередь за следующей задачей.

### Компоненты

- **Frontend** — Vanilla TypeScript + Vite, без фреймворков. Состояние через кастомный AppStore (EventEmitter)
- **API** — Fastify 5, REST + SSE, rate limiting, CORS, multipart upload, валидация размера файла (413 при >200 МБ)
- **Worker** — множество воркеров с разными приоритетами, FFmpeg через child_process.spawn, Redis pub/sub для прогресса
- **Cleanup** — node-cron, удаляет файлы старше 24ч, пропускает активные джобы

## Структура проекта

```
media-processing/
├── backend/                  # Node.js бэкенд (Fastify + FFmpeg)
│   ├── src/
│   │   ├── api/                  # REST API сервер
│   │   │   ├── index.ts          # Fastify: CORS, rate limit, multipart
│   │   │   └── routes/
│   │   │       ├── convert.ts    # POST /convert — загрузка, валидация, очередь
│   │   │       ├── status.ts     # GET /jobs/:id — статус задачи
│   │   │       ├── cancel.ts     # POST /jobs/:id/cancel — отмена задачи + pub/sub
│   │   │       ├── events.ts     # GET /events/:id — SSE прогресс
│   │   │       ├── stats.ts      # GET /stats — статистика (кэш 5с)
│   │   │       └── stats-events.ts # GET /stats/stream — SSE обновления статистики
│   │   ├── worker/               # Обработчики задач
│   │   │   ├── index.ts          # Запуск воркеров по приоритетам
│   │   │   ├── processor.ts      # Логика обработки, статусы, webhook
│   │   │   ├── ffmpeg.ts         # FFmpeg обёртка + FORMAT_CODECS
│   │   │   ├── ffprobe.ts        # Получение длительности
│   │   │   └── webhook.ts        # HTTP webhook с retry
│   │   ├── shared/               # Общие модули
│   │   │   ├── types.ts          # TypeScript интерфейсы
│   │   │   ├── queue.ts          # Кастомная FIFO очередь (Redis + Lua)
│   │   │   ├── redis.ts          # Redis клиент
│   │   │   ├── pubsub.ts         # Redis pub/sub каналы
│   │   │   └── compatibility.ts  # Проверка совместимости форматов
│   │   ├── cleanup/              # Cron cleanup сервис
│   │   │   └── cron.ts           # Удаление старых файлов
│   │   └── config/
│   │       └── index.ts          # Конфигурация из env
│   ├── Dockerfile
│   └── package.json
├── frontend/                 # Vanilla TypeScript + Vite
│   ├── src/
│   │   ├── api/
│   │   │   ├── conversionApi.ts  # API клиент (XHR, SSE)
│   │   │   └── statsApi.ts       # API клиент статистики
│   │   ├── i18n/
│   │   │   ├── index.ts          # Локализация, pluralize, localizeError
│   │   │   ├── ru.ts             # Русские переводы
│   │   │   └── en.ts             # Английские переводы
│   │   ├── store/
│   │   │   ├── EventEmitter.ts    # Типизированный EventEmitter
│   │   │   ├── AppStore.ts       # Основное состояние приложения
│   │   │   └── JobHistoryStore.ts # localStorage история
│   │   ├── ui/                    # UI компоненты
│   │   │   ├── App.ts            # Корневой компонент
│   │   │   ├── TabBar.ts         # Навигация между вкладками
│   │   │   ├── FileUpload.ts     # Загрузка файлов
│   │   │   ├── FormatSelector.ts # Выбор формата
│   │   │   ├── ProgressDisplay.ts# Прогресс и действия
│   │   │   ├── JobCard.ts        # Карточка задачи
│   │   │   ├── JobQueue.ts       # Карточки очереди с отменой
│   │   │   ├── JobHistory.ts     # История конвертаций
│   │   │   ├── DownloadButton.ts # Кнопка скачивания
│   │   │   ├── StatsPage.ts      # Страница статистики
│   │   │   └── AnimatedBackground.ts # Canvas анимация
│   │   ├── css/                  # Стили компонентов
│   │   └── types.ts              # Типы + форматные константы
│   └── package.json
├── docs/                     # Документация
│   ├── backend.md            # Документация бэкенда
│   └── frontend.md           # Документация фронтенда
├── e2e/                      # Playwright E2E тесты
├── docker-compose.yml
└── package.json              # Root: workspaces, скрипты
```

## Развёртывание

### Требования

| Зависимость | Версия | Назначение |
|-------------|--------|-----------|
| Node.js     | ≥ 22   | Серверная часть и сборка |
| Redis       | ≥ 7    | Очередь задач, статусы, pub/sub |
| FFmpeg      | ≥ 4.0  | Конвертация медиафайлов |
| npm         | ≥ 10   | Менеджер пакетов |

### Установка зависимостей

#### macOS

```bash
brew install node ffmpeg redis
brew services start redis
```

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y nodejs npm ffmpeg redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

#### Windows (WSL2)

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# FFmpeg
sudo apt install -y ffmpeg

# Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

#### Arch Linux

```bash
sudo pacman -S nodejs npm ffmpeg redis
sudo systemctl enable redis
sudo systemctl start redis
```

#### Проверка

```bash
node --version    # v22+
redis-cli ping    # PONG
ffmpeg -version   # ffmpeg version 4+
```

### Docker (рекомендуется для продакшена)

```bash
docker compose up --build -d

# Frontend: http://localhost:5173
# API: http://localhost:3000
```

Docker-образ бэкенда включает FFmpeg (`node:22-bookworm-slim` + `apt-get install ffmpeg`). Redis запускается отдельным контейнером с персистентным хранилищем.

### Локальная разработка

```bash
# Установка Node-зависимостей
npm install

# Запуск Redis (один из вариантов):
docker compose up -d redis          # Docker
# или redis-server                   # Если установлен локально

# Сборка бэкенда
npm run dev:backend                  # API + Worker через tsx watch

# В отдельном терминале — фронтенд
npm run dev:frontend                 # Vite dev-сервер на :5173

# Или всё одной командой:
npm run dev                          # API + Worker + Frontend через concurrently
```

`npm run dev` запускает всё через concurrently: API-сервер, воркеры и Vite dev-сервер. Перед запуском `predev`-скрипт освобождает порты 3000 и 5173.

### Сборка для продакшена

```bash
# Бэкенд
cd backend && npm run build          # tsc → dist/

# Фронтенд
cd frontend && npm run build          # tsc + vite build → dist/
```

---

## API Endpoints

### POST /convert

Загрузка файла и запуск конвертации. Файлы >200 МБ отклоняются (413). Аудио-форматы нельзя конвертировать в видео-форматы (400).

**Request:** `multipart/form-data`

| Параметр     | Тип    | Обязательный | Описание                           |
|-------------|--------|--------------|------------------------------------|
| `file`      | File   | Да           | Видео или аудио файл               |
| `format`    | string | Нет          | Целевой формат (по умолчанию mp3)  |
| `webhookUrl`| string | Нет          | URL для webhook уведомления        |

**Response (200):**
```json
{ "jobId": "uuid-v4-string" }
```

**Пример:**
```bash
curl -X POST http://localhost:3000/convert \
  -F "file=@video.mp4" \
  -F "format=mkv"
```

---

### GET /jobs/:id

Проверка статуса задачи.

**Response (200):**
```json
{
  "status": "waiting" | "active" | "completed" | "failed" | "cancelled",
  "progress": 0-100,
  "outputUrl": "/outputs/{jobId}/{jobId}.{format}",
  "error": "error message if failed",
  "fileName": "video.mp4",
  "targetFormat": "mkv",
  "priorityName": "high" | "medium" | "low",
  "fileSize": 12345,
  "createdAt": "1700000000000",
  "completedAt": "1700000060000"
}
```

---

### POST /jobs/:id/cancel

Отмена задачи. Завершённые задачи (completed/failed/cancelled) нельзя отменить (400). При успешной отмене публикуются события в Redis-каналы `job-progress` и `stats-changed`, что обеспечивает мгновенное обновление всех SSE-клиентов.

**Response (200):**
```json
{ "cancelled": true }
```

---

### GET /events/:id

Server-Sent Events для отслеживания прогресса в реальном времени. Подписка на Redis pub/sub перед проверкой статуса (без race condition). Heartbeat каждые 15с.

**Response:** `text/event-stream`

```
data: {"jobId":"...","progress":50,"status":"active","timestamp":...}
data: {"jobId":"...","progress":100,"status":"completed","outputUrl":"/outputs/...","timestamp":...}
```

---

### GET /stats

Статистика системы (кэш 5 секунд).

**Response (200):**
```json
{
  "total": 42,
  "byStatus": { "completed": 35, "failed": 3, "active": 1, "waiting": 3 },
  "queueCount": 4,
  "avgProcessingTimeMs": 5200,
  "byFormat": { "mp3": 15, "wav": 10 },
  "recentJobs": [...]
}
```

---

### GET /stats/stream

SSE для обновлений статистики в реальном времени. Heartbeat каждые 15с.

---

### GET /outputs/:jobId/:filename

Скачивание конвертированного файла.

---

## Webhook уведомления

При указании `webhookUrl` в POST /convert, сервис отправит HTTP POST на указанный URL после завершения конвертации.

**Payload:**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "timestamp": 1700000000000,
  "format": "mkv",
  "outputUrl": "/outputs/{jobId}/{jobId}.mkv"
}
```

**Retry логика:** до 3 попыток с exponential backoff (1с, 2с, 4с). Webhook не блокирует завершение джоба (fire-and-forget). Таймаут запроса: 10с.

---

## Поддерживаемые форматы

### Аудио

| Формат | Кодек         | Описание                   |
|--------|--------------|----------------------------|
| MP3    | libmp3lame   | MPEG Audio Layer III       |
| WAV    | pcm_s16le    | PCM 16-bit uncompressed    |
| FLAC   | flac         | Free Lossless Audio Codec  |
| OGG    | libopus      | Opus audio                 |
| AAC    | aac          | Advanced Audio Coding (ADTS) |
| WMA    | wmav2        | Windows Media Audio 2      |
| AC3    | ac3          | Dolby Digital (AC-3)       |

### Видео

| Формат | Видео кодек  | Аудио кодек | Описание       |
|--------|-------------|-------------|----------------|
| MP4    | libx264     | aac         | H.264 + AAC    |
| WebM   | libvpx-vp9  | libopus     | VP9 + Opus     |
| MOV    | libx264     | aac         | QuickTime      |
| AVI    | libx264     | mp3         | Audio Video Interleave |
| FLV    | libx264     | aac         | Flash Video    |
| MKV    | libx264     | aac         | Matroska        |
| TS     | libx264     | aac         | MPEG-TS         |
| MXF    | mpeg2video   | pcm_s16le   | Material eXchange Format |
| ASF    | libx264      | wmav2       | Advanced Systems Format |

### Совместимость

Аудио-форматы (MP3, WAV, FLAC, OGG, AAC, WMA, AC3) нельзя конвертировать в видео-форматы и контейнеры (MP4, WebM, MOV, AVI, FLV, MKV, TS, MXF, ASF). Самоконвертация (формат → тот же формат) также недоступна.

---

## Переменные окружения

| Переменная                 | По умолчанию | Описание                        |
|---------------------------|--------------|---------------------------------|
| `PORT`                    | 3000         | Порт API сервера                |
| `REDIS_HOST`              | localhost    | Redis хост                      |
| `REDIS_PORT`              | 6379         | Redis порт                      |
| `PRIORITY_HIGH_WORKERS`   | 2            | Воркеров для priority high      |
| `PRIORITY_MEDIUM_WORKERS` | 1            | Воркеров для priority medium    |
| `PRIORITY_LOW_WORKERS`    | 1            | Воркеров для priority low       |
| `PRIORITY_HIGH_MAX_MB`    | 10           | Порог high priority (МБ)        |
| `PRIORITY_MEDIUM_MAX_MB`  | 50           | Порог medium priority (МБ)      |
| `MAX_FILE_SIZE_MB`        | 200          | Макс. размер файла (МБ)         |
| `RATE_LIMIT_MAX`          | 100          | Макс. запросов в окно           |
| `RATE_LIMIT_WINDOW`       | 1 minute     | Окно rate limiting              |
| `FILE_MAX_AGE_HOURS`      | 24           | Время хранения файлов (часы)    |
| `WEBHOOK_MAX_RETRIES`     | 3            | Retry для webhook               |
| `WEBHOOK_BASE_DELAY_MS`   | 1000         | Базовая задержка retry (мс)    |
| `WEBHOOK_TIMEOUT_MS`      | 10000        | Таймаут webhook запроса (мс)   |

## Docker сервисы

| Сервис    | Описание                        | Порт |
|-----------|---------------------------------|------|
| `redis`   | Хранение очереди, статусов, pub/sub | 6379 |
| `api`     | REST API сервер                 | 3000 |
| `frontend`| Vanilla TS приложение           | 5173 |
| `worker`  | FFmpeg обработчики (4 воркера)  | —    |
| `cleanup` | Cron удаление старых файлов     | —    |

## Добавление нового формата

1. Добавить кодеки в `src/worker/ffmpeg.ts` → `FORMAT_CODECS`
2. Добавить формат в `frontend/src/types.ts` → `SUPPORTED_FORMATS`, `FORMAT_CATEGORIES`, `FORMAT_ICONS`
3. При необходимости обновить `src/shared/compatibility.ts` и `frontend/src/types.ts` → `VIDEO_FORMATS` / `REQUIRES_VIDEO`
4. Добавить переводы в `frontend/src/i18n/ru.ts` и `en.ts` → `format.{name}`
5. Генерировать тестовый файл в `e2e/test-data/`
6. Добавить путь в `e2e/helpers/test-media.ts`

## Документация

- [Документация бэкенда](docs/backend.md)
- [Документация фронтенда](docs/frontend.md)
- [E2E тестирование](e2e/TESTING.md)

## Тестирование

### Unit/Integration тесты

```bash
npm test                # Все тесты во всех workspace'ах
npm run test:unit       # Только unit-тесты
npm run test:integration # Только integration-тесты
npm run test:coverage   # С покрытием
```

### E2E тесты (Playwright)

```bash
npm install
npx playwright install chromium

npm run test:e2e            # Все E2E тесты
npm run test:e2e:headed     # С видимым браузером
npm run test:e2e:ui         # С UI Playwright
npm run test:e2e:report     # HTML отчёт
```

Подробнее: [e2e/TESTING.md](e2e/TESTING.md)

## Лицензия

MIT
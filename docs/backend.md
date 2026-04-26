# Backend — Документация

## Обзор

Бэкенд построен на Fastify 5 и состоит из трёх независимых процессов: API-сервер, воркеры и cleanup-сервис. Все процессы взаимодействуют через Redis (ioredis) — очередь задач, хранение статусов, pub/sub для событий.

## Технологии

| Технология   | Назначение                          |
|-------------|-------------------------------------|
| Fastify 5    | HTTP-сервер, REST API, SSE          |
| ioredis     | Redis клиент                        |
| FFmpeg      | Конвертация медиафайлов             |
| node-cron   | Планировщик задач очистки           |
| pino        | Логирование                         |
| uuid        | Генерация ID задач                  |
| dotenv      | Переменные окружения                |
| TypeScript  | Типизация                           |

## Структура

```
src/
├── api/                  # REST API сервер
│   ├── index.ts          # Инициализация Fastify, middleware
│   └── routes/
│       ├── convert.ts    # POST /convert
│       ├── status.ts     # GET /jobs/:id
│       ├── cancel.ts     # POST /jobs/:id/cancel
│       ├── events.ts     # GET /events/:id (SSE)
│       ├── stats.ts      # GET /stats
│       └── stats-events.ts # GET /stats/events (SSE)
├── worker/
│   ├── index.ts          # Запуск воркеров
│   ├── processor.ts      # Обработка задачи
│   ├── ffmpeg.ts         # FFmpeg обёртка
│   ├── ffprobe.ts        # Анализ длительности
│   └── webhook.ts        # Webhook с retry
├── shared/
│   ├── types.ts          # Общие типы
│   ├── queue.ts          # FIFO очередь с приоритетами
│   ├── redis.ts          # Redis клиент
│   ├── pubsub.ts         # Pub/Sub каналы
│   └── compatibility.ts  # Совместимость форматов
├── cleanup/
│   └── cron.ts           # Очистка старых файлов
└── config/
    └── index.ts          # Конфигурация
```

## API сервер (`src/api/`)

### Инициализация (`index.ts`)

Fastify-сервер с зарегистрированными плагинами:
- `@fastify/cors` — CORS для `localhost:5173` и `localhost:3000`
- `@fastify/rate-limit` — ограничение запросов (10/мин по умолчанию)
- `@fastify/multipart` — приём multipart/form-data загрузок
- `@fastify/static` — раздача файлов из `data/outputs/`
- `@fastify/sensible` — утилиты HTTP-ответов

### POST /convert (`routes/convert.ts`)

Потоковая обработка multipart-запроса:

1. Чтение полей и файла через `request.parts()`
2. Сохранение файла в `data/uploads/{jobId}/`
3. Создание директории вывода `data/outputs/{jobId}/`
4. Валидация размера файла (>200 МБ → 413)
5. Проверка формата через `FORMAT_CODECS` и `canConvert()`
6. Определение приоритета по размеру: `getPriority(fileSizeBytes)`
7. Добавление задачи в очередь: `addJob(jobData, priority)`
8. Запись начального статуса в Redis: `setJobStatus(jobId, { status: 'waiting', ... })`
9. Публикация события в `stats-changed`

При любой ошибке после сохранения файла — вызывается `cleanup()` для удаления директорий загрузки и вывода.

### GET /jobs/:id (`routes/status.ts`)

Чтение статуса из Redis-хеша `job:{id}`. Возвращает 404 если задача не найдена.

### POST /jobs/:id/cancel (`routes/cancel.ts`)

Проверяет существование задачи и текущий статус. Если задача уже завершена (completed/failed/cancelled) — возвращает ошибку. Иначе устанавливает статус `cancelled`. Воркер проверяет статус каждую секунду и прерывает конвертацию.

### GET /events/:id (`routes/events.ts`)

Server-Sent Events для real-time прогресса:

1. Подписка на Redis-канал `job-progress` (до чтения статуса — предотвращает race condition)
2. Отправка текущего статуса сразу после подписки
3. Heartbeat каждые 15 секунд для поддержания соединения
4. Пересылка всех сообщений из Redis pub/sub клиенту
5. Закрытие соединения при получении терминального статуса (completed/failed/cancelled)

### GET /stats (`routes/stats.ts`)

Агрегация статистики с кэшированием на 5 секунд. Вычисляет:
- Общее количество задач и разбивка по статусам
- Количество задач в очереди (waiting + active)
- Среднее время обработки (из последних 20 завершённых)
- Разбивка по целевым форматам
- Список последних 50 задач

### GET /stats/events (`routes/stats-events.ts`)

SSE-подписка на канал `stats-changed`. Отправляет `{"changed":true}` при каждом изменении статистики. Heartbeat каждые 15с.

## Очередь (`src/shared/queue.ts`)

Кастомная FIFO очередь на Redis с приоритетами, реализованная поверх Redis List.

### Хранение

Один Redis List `queue:jobs`. Каждый элемент — JSON:

```json
{
  "jobId": "uuid",
  "data": { "jobId": "...", "inputPath": "...", "outputPath": "...", "format": "mp3", "webhookUrl": "..." },
  "priority": "high",
  "assignedWorker": null,
  "status": "waiting"
}
```

### Lua-скрипты

Все операции над очередью выполняются через Lua-скрипты для атомарности:

**`getNextJob`** — сканирует список от старых к новым, находит первую задачу со статусом `waiting` и совпадающим приоритетом, помечает `assigned` и `assignedWorker`.

**`releaseWorkerJobs`** — сканирует список, находит все задачи с указанным `assignedWorker` и статусом `assigned`, сбрасывает в `waiting` с `assignedWorker: null`. Используется при падении воркера.

**`removeJob`** — удаляет задачу из списка по `jobId`. Вызывается после завершения обработки.

### Функции

| Функция | Описание |
|---------|----------|
| `addJob(data, priority)` | Добавляет задачу в конец списка, публикует событие на приоритетный канал |
| `getNextJob(workerPriority, workerId)` | Атомарно забирает задачу через Lua-скрипт |
| `releaseWorkerJobs(workerId)` | Освобождает все задачи упавшего воркера |
| `removeJob(jobId)` | Удаляет задачу из очереди |

## Воркеры (`src/worker/`)

### Запуск (`index.ts`)

Создаёт отдельные воркеры для каждого приоритета. Количество воркеров определяется конфигурацией:
- `PRIORITY_HIGH_WORKERS` (по умолчанию 2)
- `PRIORITY_MEDIUM_WORKERS` (по умолчанию 1)
- `PRIORITY_LOW_WORKERS` (по умолчанию 1)

Каждый воркер (`startWorker(workerId, priority)`):

1. **При запуске** — освобождает свои старые задачи через `releaseWorkerJobs()`, публикует событие в канал приоритета
2. **Подписка** — слушает приоритетный Pub/Sub канал (`queue:new-job:{priority}`)
3. **Опрос** — при получении сообщения или после завершения текущей задачи вызывает `getNextJob(priority, workerId)`
4. **Обработка** — если задача найдена, вызывает `processJob(job.data)`, затем `removeJob(job.jobId)` и опрашивает очередь снова
5. **Защита** — флаг `busy` предотвращает одновременную обработку двух задач одним воркером

### Обработка (`processor.ts`)

`processJob(jobData)` — полный цикл обработки задачи:

1. Проверка существования и непустоты входного файла
2. Создание директории вывода
3. Установка статуса `active` в Redis
4. Запуск проверки отмены каждую секунду (интервал 1с)
5. Вызов `convert()` из `ffmpeg.ts` с callback прогресса
6. При каждом обновлении прогресса — публикация в `job-progress` и обновление статуса в Redis
7. По завершении — установка статуса `completed`, отправка webhook (если указан)
8. При ошибке — установка статуса `failed`, публикация события
9. При отмене — установка статуса `cancelled`

**Статусы задачи** хранятся в Redis-хеше `job:{jobId}` с TTL 26 часов.

### FFmpeg (`ffmpeg.ts`)

Обёртка над FFmpeg через `child_process.spawn`:

- Выбор кодеков по целевому формату из `FORMAT_CODECS`
- Определение длительности через ffprobe для расчёта прогресса
- Парсинг stdout FFmpeg для извлечения прогресса (`time=`)
- Защита от зависания: таймаут 5 минут, детектор застоя (30с без прогресса)
- Ограничение памяти stderr (64 КБ)

### Webhook (`webhook.ts`)

Отправка HTTP POST на указанный URL после завершения конвертации:
- Exponential backoff: 1с, 2с, 4с (макс 3 попытки)
- Таймаут запроса: 10с
- Fire-and-forget: не блокирует завершение задачи
- Счётчик попыток хранится в Redis

## Совместимость форматов (`src/shared/compatibility.ts`)

Определяет допустимые направления конвертации:

- Аудио-форматы (mp3, wav, flac, ogg, aac, wma, ac3) нельзя конвертировать в видео-форматы (mp4, webm, mov, avi, flv, ts, mxf)
- Самоконвертация заблокирована
- Контейнеры (mkv, asf) доступны из любого формата

Функции: `getSourceFormat(filename)`, `canConvert(source, target)`, `getCompatibleFormats(source)`.

## Pub/Sub каналы (`src/shared/pubsub.ts`)

| Канал                   | Назначение                          |
|------------------------|-------------------------------------|
| `job-progress`          | Прогресс конвертации                |
| `stats-changed`         | Изменение статистики                |
| `queue:new-job:high`    | Новая задача с приоритетом high     |
| `queue:new-job:medium`  | Новая задача с приоритетом medium   |
| `queue:new-job:low`     | Новая задача с приоритетом low      |

## Cleanup (`src/cleanup/cron.ts`)

node-cron задача, запускаемая каждые 5 минут:
- Сканирует директории `data/uploads/` и `data/outputs/`
- Удаляет файлы старше `FILE_MAX_AGE_HOURS` (24ч по умолчанию)
- Пропускает директории активных задач (проверка статуса в Redis)

## Конфигурация (`src/config/index.ts`)

Все настройки читаются из переменных окружения с дефолтными значениями. См. полный список в README.md.

## Docker

Мulti-stage Dockerfile:
1. `deps` — установка production-зависимостей
2. `builder` — установка всех зависимостей, сборка TypeScript
3. `final` — slim Node.js 22 + FFmpeg, копирование dist и production node_modules

В docker-compose.yml запускаются 5 сервисов: redis, api, frontend, worker, cleanup.

# Frontend — Документация

## Обзор

Фронтенд — SPA на Vanilla TypeScript + Vite без фреймворков. Состояние управляется через кастомный EventEmitter-based store. UI состоит из набора компонентов, каждый из которых подписывается на изменения store и обновляет DOM напрямую.

## Технологии

| Технология   | Назначение                          |
|-------------|-------------------------------------|
| TypeScript  | Типизация                           |
| Vite 6      | Сборка и dev-сервер                 |
| Vanilla TS  | Без фреймворков, прямой DOM-доступ  |

## Структура

```
frontend/src/
├── main.ts                # Точка входа, монтирование App
├── types.ts               # Типы, форматные константы, совместимость
├── api/
│   ├── conversionApi.ts   # API клиент: загрузка, статус, SSE, отмена
│   └── statsApi.ts        # API клиент статистики
├── store/
│   ├── EventEmitter.ts    # Типизированный EventEmitter
│   ├── AppStore.ts        # Основное состояние приложения
│   └── JobHistoryStore.ts # localStorage история
├── ui/
│   ├── App.ts             # Корневой компонент, компоновка
│   ├── TabBar.ts          # Переключатель вкладок (Конвертер/Статистика)
│   ├── FileUpload.ts      # Загрузка файлов (drag & drop + input)
│   ├── FormatSelector.ts  # Выбор целевого формата
│   ├── ProgressDisplay.ts # Прогресс, действия, очередь
│   ├── DownloadButton.ts  # Кнопка скачивания
│   ├── JobQueue.ts        # Отображение информации об очереди
│   ├── JobCard.ts         # Карточка задачи в истории
│   ├── JobHistory.ts      # Сетка карточек истории
│   ├── StatsPage.ts       # Страница статистики
│   └── AnimatedBackground.ts # Canvas анимация бабочек
└── css/
    ├── index.css          # Глобальные стили и reset
    ├── App.css            # Стили основного контейнера
    ├── FileUpload.css     # Зона загрузки
    ├── FormatSelector.css | Селектор формата
    ├── ProgressDisplay.css | Прогресс-бар и действия
    ├── DownloadButton.css | Кнопка скачивания
    ├── JobCard.css        | Карточка задачи
    ├── JobHistory.css     | Сетка истории
    ├── JobQueue.css       | Информация об очереди
    ├── StatsPage.css      | Страница статистики
    ├── TabBar.css         | Навигация
    └── AnimatedBackground.css | Анимация фона
```

## Управление состоянием

### EventEmitter (`store/EventEmitter.ts`)

Обобщённый типобезопасный EventEmitter. Методы: `on(event, listener)`, `off(event, listener)`, `emit(event, data)`. Используется Map<string, Set<Function>> для хранения слушателей.

### AppStore (`store/AppStore.ts`)

Центральное состояние приложения. Содержит:

**Состояние:**
- `selectedFile` — выбранный файл (File | null)
- `selectedFormat` — целевой формат (SupportedFormat, по умолчанию 'mp3')
- `sourceFormat` — формат исходного файла (string | null)
- `conversion` — текущее состояние конвертации (ConversionState)
- `isConnected` — статус SSE-подключения

**ConversionState:**
```typescript
{
  status: 'idle' | 'uploading' | 'waiting' | 'active' | 'completed' | 'failed' | 'cancelled',
  progress: number,          // 0-100
  estimatedTotal?: number,   // оценочное время обработки (мс)
  conversionStartTime?: number,
  queueCount?: number,       // количество задач в очереди
  estimatedWaitMs?: number,  // ожидаемое время ожидания (мс)
  outputUrl?: string,
  error?: string
}
```

**События:**
| Событие | Данные | Когда |
|---------|--------|-------|
| `file:change` | File \| null | Выбор/очистка файла |
| `format:change` | SupportedFormat | Смена формата |
| `sourceFormat:change` | string \| null | Определение формата файла |
| `conversion:change` | ConversionState + isConnected | Любое изменение конвертации |
| `history:change` | JobHistoryItem[] | Изменение истории |

**Ключевые методы:**

- `setSelectedFile(file)` — устанавливает файл, определяет исходный формат по расширению
- `setSelectedFormat(format)` — устанавливает целевой формат
- `startConversion(file, format)` — полный цикл: загрузка → очередь → ожидание → прогресс → завершение
- `cancelConversion()` — отмена через API и локальный сброс
- `reset()` — полный сброс в idle (остановка SSE, polling, queue poll)
- `removeJob(jobId)` / `clearHistory()` — управление историей
- `syncFromStorage()` — синхронизация localStorage из другой вкладки
- `reconcileHistory()` — проверка статусов не-завершённых задач на сервере

**Прогресс и подключение:**

- При запуске конвертации одновременно запускаются SSE (`startSSE`) и polling (`startPolling`)
- SSE подключается к `GET /events/:id`, получает real-time обновления
- Polling опрашивает `GET /jobs/:id` каждые 2 секунды как fallback
- При потере SSE — реконнект с exponential backoff (до 5 попыток)
- Индикатор подключения: `isConnected` = true при активном SSE, false при polling
- После завершения — оба механизма останавливаются

**Очередь:**

- При статусе `waiting` запускается `startQueuePoll()` — опрос `GET /stats` каждые 5 секунд
- Отображает `queueCount` и `estimatedWaitMs` в UI
- Останавливается при переходе в `active`

### JobHistoryStore (`store/JobHistoryStore.ts`)

Хранение истории в localStorage:
- Макс 20 записей
- CRUD: `addJob`, `updateJob`, `removeJob`, `clearHistory`
- `reload()` — перечитывает из localStorage (для синхронизации между вкладками)

Каждая запись (`JobHistoryItem`): jobId, fileName, targetFormat, status, progress, outputUrl?, error?, createdAt.

## Компоненты

### App (`ui/App.ts`)

Корневой компонент. Отвечает за:
- Создание экземпляра AppStore
- Рендер шапки (логотип бабочка, заголовок, подзаголовок)
- Компоновку: TabBar → FileUpload → FormatSelector → ProgressDisplay → JobHistory
- AnimatedBackground (canvas)
- Обработку событий store: запуск конвертации, сброс, переключение вкладок
- Синхронизацию между вкладками (слушатель `storage` события)
- Lazy-loading StatsPage при переключении на вкладку статистики

### TabBar (`ui/TabBar.ts`)

Переключение между вкладками «Конвертер» и «Статистика». Эмитит событие `tab:change`.

### FileUpload (`ui/FileUpload.ts`)

Зона загрузки файлов:
- Drag & drop (dragover/dragleave/drop)
- Клик для открытия `<input type="file">`
- Валидация MIME-типа (audio/*, video/*)
- Определение типа файла: аудио (🎵) или видео (🎬)
- CSS-классы: `--has-file`, `--dragging`
- Подсказка лимита: «Максимальный размер файла: 200 МБ»

### FormatSelector (`ui/FormatSelector.ts`)

Выпадающий список целевых форматов:
- 16 форматов в 3 optgroup (Аудио, Видео, Контейнеры)
- Динамическая фильтрация на основе исходного формата через `getCompatibleFormats()`
- Заблокирован во время активной конвертации

### ProgressDisplay (`ui/ProgressDisplay.ts`)

Комплексный компонент отображения состояния конвертации:
- **Idle** — скрыт
- **Uploading** — прогресс-бар загрузки
- **Waiting** — «В очереди...» + информация об очереди (количество задач, ожидаемое время)
- **Active** — прогресс-бар конвертации, процент, ETA
- **Completed** — «Готово!» + DownloadButton + кнопки «Конвертировать» (переконвертация) и «Очистить»
- **Failed** — сообщение об ошибке + кнопки «Попробовать снова» и «Очистить»
- **Cancelled** — «Отменено» + кнопка «Очистить»
- Индикатор подключения: 🟢 Онлайн (SSE) или 🟠 Опрос (polling fallback)

### DownloadButton (`ui/DownloadButton.ts`)

Кнопка скачивания результата. Генерирует ссылку на `/outputs/{jobId}/{jobId}.{format}` через API-базовый URL.

### JobQueue (`ui/JobQueue.ts`)

Отображает информацию об очереди при статусе `waiting`: количество задач и ожидаемое время ожидания.

### JobCard (`ui/JobCard.ts`)

Карточка задачи в истории. Отображает:
- Имя файла и целевой формат
- Статус с иконкой (completed/failed/cancelled)
- Прогресс-бар для активных задач
- Кнопку скачивания для завершённых
- Сообщение об ошибке для проваленных
- Кнопку удаления

### JobHistory (`ui/JobHistory.ts`)

Контейнер карточек истории:
- Сетка из JobCard
- Кнопка «Очистить всё»
- Показывает только завершённые/проваленные/отменённые задачи
- Эффективное обновление DOM: добавление/удаление отдельных карточек

### StatsPage (`ui/StatsPage.ts`)

Страница статистики (загружается по требованию):
- Общее количество задач и разбивка по статусам
- Среднее время обработки
- Количество задач в очереди
- Разбивка по форматам (bar chart)
- Последние задачи (список)
- SSE-подписка на `GET /stats/stream` для real-time обновлений

### AnimatedBackground (`ui/AnimatedBackground.ts`)

Canvas-анимация с частицами-бабочками. Toggle-кнопка (▶/⏸) для включения/паузы.

## API клиент (`api/conversionApi.ts`)

| Функция | Описание |
|---------|----------|
| `startConversion(file, format, onProgress)` | Загрузка через XHR с отслеживанием прогресса (таймаут 5 мин) |
| `getJobStatus(jobId)` | GET `/jobs/:id` |
| `createSSEConnection(jobId, onMessage, onError)` | EventSource на `/events/:id` |
| `cancelJob(jobId)` | POST `/jobs/:id/cancel` |
| `abortUpload()` | Прерывание текущей загрузки XHR |

## API клиент статистики (`api/statsApi.ts`)

| Функция | Описание |
|---------|----------|
| `getStats()` | GET `/stats` |
| `subscribeStatsChanges(onChange)` | EventSource на `/stats/stream` (автореконнект каждые 3с), возвращает функцию отписки |

## Типы и форматы (`types.ts`)

- `SUPPORTED_FORMATS` — массив из 16 форматов
- `FORMAT_INFO` — метаданные каждого формата (категория, метка, иконка)
- `CATEGORY_LABELS` — названия категорий на русском
- `getCompatibleFormats(sourceFormat)` — возвращает допустимые целевые форматы (фильтрует аудио→видео)

## Запуск

```bash
cd frontend
npm install
npm run dev        # Dev-сервер на http://localhost:5173
npm run build      # Сборка (tsc + vite build)
npm run preview    # Превью сборки
```

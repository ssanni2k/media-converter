import '../css/StatsPage.css';
import { getStats, subscribeStatsChanges, type StatsResponse } from '../api/statsApi';
import { mountJobQueue } from './JobQueue';

declare const Chart: any;

function formatTimestamp(ts: string): string {
  const d = new Date(parseInt(ts));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { completed: 'Завершено', failed: 'Ошибка', active: 'В работе', waiting: 'В очереди' };
  return map[status] || status;
}

function statusClass(status: string): string {
  return `stats-status stats-status--${status}`;
}

export function mountStatsPage(container: HTMLElement): () => void {
  container.innerHTML = `
    <div class="stats-page">
      <div class="stats-cards">
        <div class="stats-card">
          <span class="stats-card__value" id="stat-total">—</span>
          <span class="stats-card__label">Всего</span>
        </div>
        <div class="stats-card stats-card--success">
          <span class="stats-card__value" id="stat-completed">—</span>
          <span class="stats-card__label">Успешных</span>
        </div>
        <div class="stats-card stats-card--error">
          <span class="stats-card__value" id="stat-failed">—</span>
          <span class="stats-card__label">С ошибками</span>
        </div>
        <div class="stats-card stats-card--active">
          <span class="stats-card__value" id="stat-active">—</span>
          <span class="stats-card__label">В процессе</span>
        </div>
      </div>

      <div class="stats-charts">
        <div class="stats-chart-card">
          <h3 class="stats-chart-card__title">По форматам</h3>
          <div class="stats-chart-card__body">
            <canvas id="chart-by-format"></canvas>
          </div>
        </div>
        <div class="stats-chart-card">
          <h3 class="stats-chart-card__title">По статусам</h3>
          <div class="stats-chart-card__body">
            <canvas id="chart-by-status"></canvas>
          </div>
        </div>
      </div>

      <div class="stats-queue-slot"></div>

      <div class="stats-table-card">
        <h3 class="stats-table-card__title">Последние конвертации</h3>
        <div class="stats-table-card__body">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Файл</th>
                <th>Формат</th>
                <th>Статус</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody id="stats-table-body">
              <tr><td colspan="4" class="stats-table__empty">Загрузка...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const queue = mountJobQueue(container.querySelector('.stats-queue-slot') as HTMLElement);

  let formatChart: any = null;
  let statusChart: any = null;

  async function load() {
    let data: StatsResponse;
    try {
      data = await getStats();
    } catch {
      container.querySelector('#stats-table-body')!.innerHTML =
        '<tr><td colspan="4" class="stats-table__empty">Не удалось загрузить данные</td></tr>';
      return;
    }

    // Summary cards
    (container.querySelector('#stat-total') as HTMLElement).textContent = String(data.total);
    (container.querySelector('#stat-completed') as HTMLElement).textContent = String(data.byStatus.completed || 0);
    (container.querySelector('#stat-failed') as HTMLElement).textContent = String(data.byStatus.failed || 0);
    (container.querySelector('#stat-active') as HTMLElement).textContent =
      String((data.byStatus.active || 0) + (data.byStatus.waiting || 0));

    // Update queue with active jobs from server
    const activeJobs = data.recentJobs
      .filter(j => j.status === 'active' || j.status === 'waiting')
      .map(j => ({ ...j, createdAt: parseInt(j.createdAt) || Date.now() }));
    queue.update(activeJobs);

    // Charts
    const formatEntries = Object.entries(data.byFormat).sort((a, b) => b[1] - a[1]);
    const formatLabels = formatEntries.map(([f]) => f.toUpperCase());
    const formatValues = formatEntries.map(([, v]) => v);
    const chartColors = ['#209CEE', '#33C2FF', '#00d9a5', '#feca57', '#ff6b6b', '#a29bfe', '#fd79a8', '#8CD7FF'];

    if (formatChart) formatChart.destroy();
    const formatCtx = (container.querySelector('#chart-by-format') as HTMLCanvasElement).getContext('2d');
    formatChart = new Chart(formatCtx, {
      type: 'doughnut',
      data: {
        labels: formatLabels,
        datasets: [{
          data: formatValues,
          backgroundColor: chartColors,
          borderColor: '#0B1420',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#A0B8CC', padding: 12, font: { size: 12 } } },
        },
      },
    });

    if (statusChart) statusChart.destroy();
    const statusCtx = (container.querySelector('#chart-by-status') as HTMLCanvasElement).getContext('2d');
    statusChart = new Chart(statusCtx, {
      type: 'bar',
      data: {
        labels: ['Завершено', 'С ошибками', 'В работе', 'В очереди'],
        datasets: [{
          data: [
            data.byStatus.completed || 0,
            data.byStatus.failed || 0,
            data.byStatus.active || 0,
            data.byStatus.waiting || 0,
          ],
          backgroundColor: ['#00d9a5', '#ff6b6b', '#209CEE', '#feca57'],
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#A0B8CC' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#A0B8CC', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true },
        },
      },
    });

    // Table
    const tbody = container.querySelector('#stats-table-body') as HTMLElement;
    if (data.recentJobs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="stats-table__empty">Нет данных</td></tr>';
      return;
    }

    tbody.innerHTML = data.recentJobs.map(job => `
      <tr>
        <td class="stats-table__file" title="${job.fileName}">${job.fileName}</td>
        <td><span class="stats-table__format">${job.targetFormat.toUpperCase()}</span></td>
        <td><span class="${statusClass(job.status)}">${statusLabel(job.status)}</span></td>
        <td class="stats-table__date">${formatTimestamp(job.createdAt)}</td>
      </tr>
    `).join('');
  }

  load();
  const unsubscribeStats = subscribeStatsChanges(load);

  return () => {
    unsubscribeStats();
    formatChart?.destroy();
    statusChart?.destroy();
    queue.destroy();
  };
}

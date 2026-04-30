import '../css/TabBar.css';
import { t } from '../i18n/index.js';

export type TabId = 'converter' | 'statistics';

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'converter', label: t('tabs.converter'), icon: '🔄' },
  { id: 'statistics', label: t('tabs.statistics'), icon: '📊' },
];

export function mountTabBar(
  container: HTMLElement,
  onTabChange: (tabId: TabId) => void,
  initialTab: TabId = 'converter'
): void {
  container.innerHTML = `
    <nav class="tab-bar">
      ${TABS.map(t => `
        <button class="tab-bar__btn ${t.id === initialTab ? 'tab-bar__btn--active' : ''}" data-tab="${t.id}">
          <span class="tab-bar__icon">${t.icon}</span>
          <span class="tab-bar__label">${t.label}</span>
        </button>
      `).join('')}
    </nav>
  `;

  const buttons = container.querySelectorAll<HTMLButtonElement>('.tab-bar__btn');

  function setTab(tabId: TabId) {
    buttons.forEach(btn => {
      btn.classList.toggle('tab-bar__btn--active', btn.dataset.tab === tabId);
    });
    onTabChange(tabId);
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab as TabId));
  });
}

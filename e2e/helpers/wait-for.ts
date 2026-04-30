import { Page, expect } from '@playwright/test';
import { s } from './selectors';

const STATUS_LABELS: Record<string, string> = {
  uploading: 'Загрузка...',
  waiting: 'В очереди...',
  active: 'Конвертируется',
  completed: 'Готово!',
  failed: 'Ошибка',
};

export async function waitForProgressStatus(
  page: Page,
  status: string,
  timeout = 60_000
) {
  await expect(page.locator(s.progressDisplayLabel))
    .toHaveText(STATUS_LABELS[status], { timeout });
}

export async function waitForConnectionIndicator(
  page: Page,
  timeout = 20_000
) {
  const el = page.locator(s.progressDisplayConnectionStatus);
  await expect(el).toBeVisible({ timeout });
  const text = await el.textContent();
  expect(text).toMatch(/🟢 Онлайн|🟠 Опрос/);
}

export async function uploadAndWaitForCompletion(
  page: Page,
  filePath: string,
  format: string,
  timeout = 90_000
): Promise<void> {
  await expect(page.locator(s.uploadZoneInput)).toBeAttached({ timeout: 30_000 });
  await page.locator(s.uploadZoneInput).setInputFiles(filePath);
  await expect(page.locator(s.uploadZoneHasFile)).toBeAttached();

  await expect(page.locator(s.formatSelectorSelect)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`${s.formatSelectorSelect} option[value="${format}"]`)).toBeAttached({ timeout: 10_000 });
  await page.locator(s.formatSelectorSelect).selectOption(format);
  await page.locator(s.convertBtn).click();

  // Wait for converting card to appear and reach completed state
  await expect(page.locator(s.actionConverting)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Готово!', { timeout });
  await expect(page.locator(s.downloadBtn)).toBeVisible();
}

export async function clearConverter(page: Page): Promise<void> {
  await page.locator(s.resetBtn).click();
  await expect(page.locator(s.actionIdle)).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(s.uploadZoneLabel)).toBeVisible();
  await expect(page.locator(s.uploadZoneSelected)).toBeHidden();
}

export async function clearLocalStorage(page: Page) {
  // Navigate away first to ensure a clean page context
  await page.goto('about:blank');
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
}

export async function waitForHistoryCardCount(page: Page, count: number, timeout = 15_000) {
  // Exclude cards that are animating out (fade-leave class)
  await expect(page.locator(`${s.jobHistoryGrid} ${s.jobCard}:not(.fade-leave)`)).toHaveCount(count, { timeout });
}

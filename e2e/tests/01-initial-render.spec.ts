import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage } from '../helpers/wait-for';

test.beforeEach(async ({ page }) => {
  await clearLocalStorage(page);
});

test('page loads with all UI elements in initial state', async ({ page }) => {

  await expect(page.locator(s.title)).toHaveText('Конвертер Медиа');
  await expect(page.locator(s.subtitle)).toHaveText('Конвертируйте аудио и видео файлы в любой формат');

  // Upload zone
  await expect(page.locator(s.uploadZone)).toBeVisible();
  await expect(page.locator(s.uploadZoneText)).toHaveText('Перетащите файл или нажмите для выбора');
  await expect(page.locator(s.uploadZoneHint)).toHaveText('Поддерживаются аудио и видео файлы');
  await expect(page.locator(s.uploadZoneSelected)).toBeHidden();

  // Format selector
  await expect(page.locator(s.formatSelectorLabel)).toHaveText('Целевой формат');
  await expect(page.locator(s.formatSelectorSelect)).toHaveValue('mp3');
  const optionCount = await page.locator(`${s.formatSelectorSelect} option`).count();
  expect(optionCount).toBe(16);

  // Convert button disabled
  await expect(page.locator(s.convertBtn)).toBeVisible();
  await expect(page.locator(s.convertBtn)).toBeDisabled();

  // Converting section hidden
  await expect(page.locator(s.actionConverting)).toHaveClass(/hidden/);

  // Animated background
  await expect(page.locator(s.animatedBgCanvas)).toBeAttached();
  await expect(page.locator(s.animatedBgToggle)).toBeVisible();
  await expect(page.locator(s.animatedBgToggle)).toHaveText('⏸');
});

import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage } from '../helpers/wait-for';

test.beforeEach(async ({ page }) => {
  await clearLocalStorage(page);
});

test('format selector defaults to MP3 and has 16 options in 3 groups', async ({ page }) => {

  const select = page.locator(s.formatSelectorSelect);
  await expect(select).toHaveValue('mp3');

  const options = select.locator('option');
  await expect(options).toHaveCount(16);

  const optgroups = select.locator('optgroup');
  await expect(optgroups).toHaveCount(3);

  const groupLabels = await optgroups.evaluateAll(els => els.map(e => e.getAttribute('label')));
  expect(groupLabels).toContain('Аудио');
  expect(groupLabels).toContain('Видео');
  expect(groupLabels).toContain('Контейнеры');
});

test('selecting different formats updates the value', async ({ page }) => {

  const select = page.locator(s.formatSelectorSelect);

  await select.selectOption('flac');
  await expect(select).toHaveValue('flac');

  await select.selectOption('wav');
  await expect(select).toHaveValue('wav');

  await select.selectOption('mkv');
  await expect(select).toHaveValue('mkv');

  await select.selectOption('mov');
  await expect(select).toHaveValue('mov');
});

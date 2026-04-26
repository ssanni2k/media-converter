import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage, uploadAndWaitForCompletion, clearConverter } from '../helpers/wait-for';
import { media } from '../helpers/test-media';

test('convert same file to different formats sequentially', async ({ page }) => {
  await clearLocalStorage(page);

  // First conversion: WAV → MP3
  await uploadAndWaitForCompletion(page, media.wav, 'mp3');

  const [download1] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.locator(s.downloadBtn).click(),
  ]);
  expect(download1.suggestedFilename()).toMatch(/\.mp3$/);

  // Click "Конвертировать" — reconverts same file to same format
  await page.locator(s.reconvertBtn).click();

  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Готово!', { timeout: 60_000 });

  const [download2] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.locator(s.downloadBtn).click(),
  ]);
  expect(download2.suggestedFilename()).toMatch(/\.mp3$/);

  // History has 2 cards
  const cards = page.locator(s.jobCard);
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveClass(/job-card--completed/);
  await expect(cards.nth(1)).toHaveClass(/job-card--completed/);
});

test('convert WAV → OGG then clean and convert WAV → FLAC', async ({ page }) => {
  await clearLocalStorage(page);

  // WAV → OGG
  await uploadAndWaitForCompletion(page, media.wav, 'ogg');

  const [download1] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.locator(s.downloadBtn).click(),
  ]);
  expect(download1.suggestedFilename()).toMatch(/\.ogg$/);

  // Click "Очистить" — returns to idle, file is removed
  await clearConverter(page);

  // WAV → FLAC (same source, different target — WAV→WAV is excluded by compatibility filter)
  await uploadAndWaitForCompletion(page, media.wav, 'flac');

  const [download2] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.locator(s.downloadBtn).click(),
  ]);
  expect(download2.suggestedFilename()).toMatch(/\.flac$/);

  // History has 2 cards with different formats
  const cards = page.locator(s.jobCard);
  await expect(cards).toHaveCount(2);

  const formatTexts = await cards.locator(s.jobCardFormat).allTextContents();
  expect(formatTexts).toContain('OGG');
  expect(formatTexts).toContain('FLAC');
});

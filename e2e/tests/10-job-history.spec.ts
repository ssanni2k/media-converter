import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage, uploadAndWaitForCompletion, clearConverter, waitForHistoryCardCount } from '../helpers/wait-for';
import { media } from '../helpers/test-media';

test('conversion appears in job history only after completion', async ({ page }) => {
  await clearLocalStorage(page);

  // Before conversion — history should be empty
  await waitForHistoryCardCount(page, 0, 5_000);

  await uploadAndWaitForCompletion(page, media.wav, 'mp3');

  // After completion — history should show the completed job
  await expect(page.locator(s.jobHistory)).toBeVisible();
  await expect(page.locator(s.jobHistoryTitle)).toHaveText('История конвертаций');

  await waitForHistoryCardCount(page, 1);

  const card = page.locator(s.jobCard).first();
  await expect(card).toHaveClass(/job-card--completed/);
  await expect(card.locator(s.jobCardFormat)).toHaveText('MP3');
  await expect(card.locator(s.jobCardFileName)).toHaveText('sample.wav');
  await expect(card.locator(s.jobCardTimestamp)).toBeVisible();
});

test('job history persists after page reload', async ({ page }) => {
  await clearLocalStorage(page);

  await uploadAndWaitForCompletion(page, media.wav, 'mp3');

  const jobIdBefore = await page.locator(s.jobCard).first().getAttribute('data-job-id');

  await page.reload();
  await page.waitForLoadState('networkidle');

  await expect(page.locator(s.jobHistory)).toBeVisible();
  const jobIdAfter = await page.locator(s.jobCard).first().getAttribute('data-job-id');
  expect(jobIdBefore).toBe(jobIdAfter);
});

test('individual job removal', async ({ page }) => {
  await clearLocalStorage(page);

  // First conversion via UI
  await uploadAndWaitForCompletion(page, media.wav, 'mp3');
  await clearConverter(page);

  // Second conversion via UI
  await uploadAndWaitForCompletion(page, media.wav, 'flac');
  await clearConverter(page);

  await waitForHistoryCardCount(page, 2);

  // Remove first card
  await page.locator(s.jobCard).first().locator(s.jobCardRemoveBtn).click();
  await waitForHistoryCardCount(page, 1);
});

test('clear all history', async ({ page }) => {
  await clearLocalStorage(page);

  // First conversion via UI
  await uploadAndWaitForCompletion(page, media.wav, 'mp3');
  await clearConverter(page);

  // Second conversion via UI
  await uploadAndWaitForCompletion(page, media.wav, 'ogg');
  await clearConverter(page);

  await waitForHistoryCardCount(page, 2);

  await page.locator(s.jobHistoryClearBtn).click();

  await expect(page.locator(s.jobHistory)).toBeHidden();
});

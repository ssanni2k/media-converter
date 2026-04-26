import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage, uploadAndWaitForCompletion, clearConverter } from '../helpers/wait-for';
import { media } from '../helpers/test-media';

test('server error shows error with retry and clean buttons', async ({ page }) => {
  await clearLocalStorage(page);

  await page.route('**/convert', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Internal Server Error' }),
  }));

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);
  await page.locator(s.convertBtn).click();

  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Ошибка', { timeout: 10_000 });
  await expect(page.locator(s.progressDisplayError)).toBeVisible();
  await expect(page.locator(s.reconvertBtn)).toBeVisible();
  await expect(page.locator(s.resetBtn)).toBeVisible();
});

test('clean after error returns to idle state', async ({ page }) => {
  await clearLocalStorage(page);

  await page.route('**/convert', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'fail' }),
  }));

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);
  await page.locator(s.convertBtn).click();
  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Ошибка', { timeout: 10_000 });

  await clearConverter(page);

  await expect(page.locator(s.actionIdle)).toBeVisible();
  await expect(page.locator(s.convertBtn)).toBeDisabled();
  await expect(page.locator(s.uploadZoneLabel)).toBeVisible();
  await expect(page.locator(s.uploadZoneSelected)).toBeHidden();
});

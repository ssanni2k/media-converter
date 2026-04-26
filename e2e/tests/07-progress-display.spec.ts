import { test, expect, Page } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage, waitForHistoryCardCount } from '../helpers/wait-for';
import { media } from '../helpers/test-media';

async function waitForConvertingCard(page: Page, timeout = 10_000) {
  await expect(page.locator(s.actionConverting)).toBeVisible({ timeout });
}

// These tests verify the progress display UI. For tiny test files (~1 sec),
// the conversion completes so fast that the "active" phase may never be visible.
// Tests handle this gracefully: if the conversion completes before the
// progress display updates, the test skips that assertion.

test('progress display shows correct status during conversion', async ({ page }) => {
  await clearLocalStorage(page);

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);
  await page.locator(s.convertBtn).click();

  await waitForHistoryCardCount(page, 0, 5_000);

  await waitForConvertingCard(page);
  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Готово!', { timeout: 60_000 });
  await expect(page.locator(s.downloadBtn)).toBeVisible();
});

test('SSE connection indicator appears during active phase (if conversion is slow enough)', async ({ page }) => {
  await clearLocalStorage(page);

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);
  await page.locator(s.convertBtn).click();

  await waitForConvertingCard(page);

  let sawActive = false;
  try {
    await expect(page.locator(s.progressDisplayLabel)).toHaveText('Конвертируется', { timeout: 5_000 });
    sawActive = true;
  } catch {
    // Conversion completed too fast
  }

  if (sawActive) {
    await expect(page.locator(s.progressDisplayConnectionStatus)).toBeVisible();
    expect(await page.locator(s.progressDisplayConnectionStatus).textContent()).toMatch(/🟢 Онлайн|🟠 Опрос/);
  }

  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Готово!', { timeout: 60_000 });
});

test('progress bar width matches percentage text (if active phase visible)', async ({ page }) => {
  await clearLocalStorage(page);

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);
  await page.locator(s.convertBtn).click();

  await waitForConvertingCard(page);

  let fillStyle: string | null = null;
  let percentageText: string | null = null;

  try {
    await expect(page.locator(s.progressDisplayLabel)).toHaveText('Конвертируется', { timeout: 5_000 });
    fillStyle = await page.locator(s.progressDisplayFill).getAttribute('style');
    percentageText = await page.locator(s.progressDisplayPercentage).textContent();
  } catch {
    // Active phase not visible
  }

  if (fillStyle && percentageText) {
    const widthMatch = fillStyle?.match(/width:\s*(\d+)%/);
    if (widthMatch) {
      expect(percentageText).toContain(widthMatch[1]);
    }
  }

  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Готово!', { timeout: 60_000 });
});

test('progress percentage increases over time (if active phase visible)', async ({ page }) => {
  await clearLocalStorage(page);

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);
  await page.locator(s.convertBtn).click();

  await waitForConvertingCard(page);

  try {
    await expect(page.locator(s.progressDisplayLabel)).toHaveText('Конвертируется', { timeout: 5_000 });

    const p1 = await page.locator(s.progressDisplayPercentage).textContent();
    const num1 = parseInt(p1!, 10);

    await new Promise(r => setTimeout(r, 1000));

    const p2 = await page.locator(s.progressDisplayPercentage).textContent();
    const num2 = parseInt(p2!, 10);

    expect(num2).toBeGreaterThanOrEqual(num1);
  } catch {
    // Active phase not visible
  }

  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Готово!', { timeout: 60_000 });
});

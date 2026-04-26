import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage } from '../helpers/wait-for';
import { media } from '../helpers/test-media';

test.beforeEach(async ({ page }) => {
  await clearLocalStorage(page);
});

test('upload audio file via file input', async ({ page }) => {

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);

  await expect(page.locator(s.uploadZoneLabel)).toBeHidden();
  await expect(page.locator(s.uploadZoneSelected)).toBeVisible();
  await expect(page.locator(s.uploadZoneFileIcon)).toHaveText('🎵');
  await expect(page.locator(s.uploadZoneFileName)).toHaveText('sample.wav');
  await expect(page.locator(s.uploadZone)).toHaveClass(/upload-zone--has-file/);
  await expect(page.locator(s.convertBtn)).toBeEnabled();
});

test('upload video file shows video icon', async ({ page }) => {

  await page.locator(s.uploadZoneInput).setInputFiles(media.mp4);

  await expect(page.locator(s.uploadZoneFileIcon)).toHaveText('🎬');
  await expect(page.locator(s.uploadZoneFileName)).toHaveText('sample.mp4');
});

test('drag states apply correct CSS classes', async ({ page }) => {

  const zone = page.locator(s.uploadZone);

  await zone.dispatchEvent('dragover', { bubbles: true, cancelable: true });
  await expect(zone).toHaveClass(/upload-zone--dragging/);

  await zone.dispatchEvent('dragleave', { bubbles: true, cancelable: true });
  await expect(zone).not.toHaveClass(/upload-zone--dragging/);
});

test('non-media file is rejected via drag and drop', async ({ page }) => {
  // Create File and DataTransfer inside browser context to avoid cross-realm issues
  await page.evaluate(() => {
    const file = new File(['not a media file'], 'invalid.txt', { type: 'text/plain' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const zone = document.querySelector('.upload-zone');
    zone?.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
  });

  // File info section stays hidden, convert button stays disabled
  await expect(page.locator(s.uploadZoneSelected)).toBeHidden();
  await expect(page.locator(s.convertBtn)).toBeDisabled();
});

test('file size limit hint is visible', async ({ page }) => {
  await expect(page.locator(s.uploadZoneSizeLimit)).toBeVisible();
  await expect(page.locator(s.uploadZoneSizeLimit)).toHaveText('Максимальный размер файла: 200 МБ');
});

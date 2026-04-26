import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage, uploadAndWaitForCompletion, clearConverter } from '../helpers/wait-for';
import { media } from '../helpers/test-media';

test('download button produces file with correct extension', async ({ page }) => {
  await clearLocalStorage(page);

  await uploadAndWaitForCompletion(page, media.wav, 'mp3');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.locator(s.downloadBtn).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.mp3$/);

  const downloadPath = await download.path();
  if (downloadPath) {
    const fs = await import('fs');
    expect(fs.statSync(downloadPath).size).toBeGreaterThan(0);
  }
});

test('verify conversion via API after UI completion', async ({ page, request }) => {
  await clearLocalStorage(page);

  await uploadAndWaitForCompletion(page, media.wav, 'ogg');

  const jobId = await page.locator(s.jobCard).first().getAttribute('data-job-id');
  expect(jobId).toBeTruthy();

  const resp = await request.get(`http://localhost:3000/jobs/${jobId}`);
  const body = await resp.json();
  expect(body.status).toBe('completed');
  expect(body.progress).toBe(100);
  expect(body.outputUrl).toContain(jobId!);
});

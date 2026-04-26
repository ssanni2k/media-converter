import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage, waitForHistoryCardCount } from '../helpers/wait-for';
import { media } from '../helpers/test-media';
import { createReadStream } from 'fs';

const API = 'http://localhost:3000';

async function submitJob(request: any, filePath: string, format: string) {
  const resp = await request.post(`${API}/convert`, {
    multipart: {
      file: createReadStream(filePath),
      format,
    },
  });
  expect(resp.status()).toBe(200);
  return await resp.json();
}

async function getJob(request: any, jobId: string) {
  const resp = await request.get(`${API}/jobs/${jobId}`);
  return resp.json();
}

async function waitForTerminal(request: any, jobId: string, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const job = await getJob(request, jobId);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return job;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Job ${jobId} did not reach terminal state within ${timeout}ms`);
}

test('priority is assigned based on file size', async ({ request }) => {
  const { jobId } = await submitJob(request, media.wav, 'mp3');

  const job = await getJob(request, jobId);
  expect(job.priorityName).toBe('high');
  expect(job.fileSize).toBeGreaterThan(0);

  await waitForTerminal(request, jobId);
});

test('multiple jobs are processed without loss', async ({ request }) => {
  const jobIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { jobId } = await submitJob(request, media.wav, 'mp3');
    jobIds.push(jobId);
  }

  for (const jobId of jobIds) {
    const job = await waitForTerminal(request, jobId);
    expect(job.status).toBe('completed');
  }
});

test('concurrent processing — two high-priority workers handle jobs simultaneously', async ({ request }) => {
  const { jobId: job1 } = await submitJob(request, media.wav, 'mp3');
  const { jobId: job2 } = await submitJob(request, media.wav, 'ogg');

  // Both should reach 'active' quickly (2 high-priority workers)
  await expect(async () => {
    const s1 = await getJob(request, job1);
    expect(s1.status).toBe('active');
  }).toPass({ timeout: 10_000 });

  await expect(async () => {
    const s2 = await getJob(request, job2);
    expect(s2.status).toBe('active');
  }).toPass({ timeout: 10_000 });

  await waitForTerminal(request, job1);
  await waitForTerminal(request, job2);
});

test('FIFO ordering — earlier submitted jobs start processing first', async ({ request }) => {
  // Submit first job
  const { jobId: jobA } = await submitJob(request, media.wav, 'mp3');

  // Wait for it to be picked up by a worker
  await expect(async () => {
    const status = await getJob(request, jobA);
    expect(status.status).toBe('active');
  }).toPass({ timeout: 10_000 });

  // Submit second job while first is processing
  const { jobId: jobB } = await submitJob(request, media.wav, 'mp3');

  // Wait for both to complete
  const finalA = await waitForTerminal(request, jobA);
  const finalB = await waitForTerminal(request, jobB);

  expect(finalA.status).toBe('completed');
  expect(finalB.status).toBe('completed');
  expect(parseInt(finalA.createdAt)).toBeLessThanOrEqual(parseInt(finalB.createdAt));
});

test('stats endpoint returns correct queue data', async ({ request }) => {
  const resp = await request.get(`${API}/stats`);
  expect(resp.status()).toBe(200);
  const body = await resp.json();

  expect('queueCount' in body).toBe(true);
  expect(typeof body.queueCount).toBe('number');
  expect(body.queueCount).toBeGreaterThanOrEqual(0);

  expect('avgProcessingTimeMs' in body).toBe(true);
  expect(typeof body.avgProcessingTimeMs).toBe('number');
  expect(body.avgProcessingTimeMs).toBeGreaterThanOrEqual(0);
});

test('active jobs do not appear in history during conversion', async ({ page }) => {
  await clearLocalStorage(page);

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);
  await page.locator(s.convertBtn).click();

  // While converting, history should have 0 cards
  await waitForHistoryCardCount(page, 0, 5_000);

  // Wait for completion
  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Готово!', { timeout: 60_000 });

  // After completion, history should have 1 card
  await waitForHistoryCardCount(page, 1, 15_000);
});

test('queue info is hidden after conversion completes', async ({ page }) => {
  await clearLocalStorage(page);

  await page.locator(s.uploadZoneInput).setInputFiles(media.wav);
  await page.locator(s.convertBtn).click();

  await expect(page.locator(s.progressDisplayLabel)).toHaveText('Готово!', { timeout: 60_000 });

  await expect(page.locator(s.progressDisplayQueueInfo)).toBeHidden();
});

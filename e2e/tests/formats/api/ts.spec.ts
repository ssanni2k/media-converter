import { test, expect } from '@playwright/test';
import { createReadStream, statSync } from 'fs';
import { media, SUPPORTED_INPUTS } from '../../../helpers/test-media';
import { shouldSkipConversion } from '../../../helpers/compatibility.js';

const API = 'http://localhost:3000';
const FORMAT = 'ts';
const others = SUPPORTED_INPUTS.filter(f => f !== FORMAT);

async function convertAndWait(request, filePath, format, timeout = 60_000) {
  const fileSize = statSync(filePath).size;
  const uploadTimeout = Math.max(30_000, fileSize * 2);
  const response = await request.post(`${API}/convert`, {
    multipart: {
      file: createReadStream(filePath),
      format,
    },
    timeout: uploadTimeout,
  });
  expect(response.status()).toBe(200);
  const { jobId } = await response.json();

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const status = await request.get(`${API}/jobs/${jobId}`);
    const data = await status.json();
    if (data.status === 'failed') throw new Error(`Job failed: ${data.error}`);
    if (data.status === 'completed') return data.outputUrl;
    await new Promise(r => setTimeout(r, 1_000));
  }
  throw new Error(`Job ${jobId} did not complete within ${timeout}ms`);
}

test.describe(`${FORMAT.toUpperCase()} как источник (API)`, () => {
  for (const target of others) {
    (shouldSkipConversion(FORMAT, target) ? test.skip : test)(`${FORMAT} → ${target}`, async ({ request }) => {
      const outputUrl = await convertAndWait(request, media[FORMAT], target);
      const file = await request.get(`${API}${outputUrl}`);
      expect(file.status()).toBe(200);
      expect(outputUrl).toMatch(new RegExp(`\\.${target}$`));
    });
  }
});

test.describe(`Конвертация в ${FORMAT.toUpperCase()} (API)`, () => {
  for (const source of others) {
    (shouldSkipConversion(source, FORMAT) ? test.skip : test)(`${source} → ${FORMAT}`, async ({ request }) => {
      const outputUrl = await convertAndWait(request, media[source], FORMAT);
      const file = await request.get(`${API}${outputUrl}`);
      expect(file.status()).toBe(200);
      expect(outputUrl).toMatch(new RegExp(`\\.${FORMAT}$`));
    });
  }
});

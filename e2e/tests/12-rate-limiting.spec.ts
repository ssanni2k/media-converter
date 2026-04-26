import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

test('rate limiting: browser-based requests eventually get 429', async ({ page }) => {
  await page.goto('/');

  // Send requests from the browser context (same network path as real users)
  // The Playwright `request` fixture may use a different IP/protocol than the browser,
  // causing it to bypass the rate limiter. Using page.evaluate ensures we test the
  // actual rate limiting behavior users would experience.
  const result = await page.evaluate(async (api) => {
    let successCount = 0;
    let rateLimited = false;

    for (let i = 0; i < 600; i++) {
      try {
        const resp = await fetch(`${api}/jobs/rl-${i}`);
        if (resp.status === 429) {
          rateLimited = true;
          break;
        }
        successCount++;
      } catch {
        // Network/CORS error — stop
        break;
      }
    }

    return { successCount, rateLimited };
  }, API_BASE);

  expect(result.rateLimited, `Rate limiter never triggered after ${result.successCount} requests`).toBe(true);
  expect(result.successCount).toBeGreaterThanOrEqual(5);
});

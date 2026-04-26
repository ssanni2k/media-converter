import { test, expect } from '@playwright/test';
import { s } from '../helpers/selectors';
import { clearLocalStorage } from '../helpers/wait-for';

test.beforeEach(async ({ page }) => {
  await clearLocalStorage(page);
});

test('animated background toggle works', async ({ page }) => {

  const canvas = page.locator(s.animatedBgCanvas);
  const toggle = page.locator(s.animatedBgToggle);

  await expect(canvas).toBeAttached();
  await expect(toggle).toHaveText('⏸');

  // Take screenshot before toggle
  const screenshotBefore = await canvas.screenshot();

  // Disable animation
  await toggle.click();
  await expect(toggle).toHaveText('▶');
  await expect(toggle).toHaveClass(/animated-background__toggle--disabled/);

  // Wait for canvas to clear
  await new Promise(r => setTimeout(r, 500));
  const screenshotAfter = await canvas.screenshot();

  // Screenshots should differ
  expect(screenshotBefore).not.toEqual(screenshotAfter);

  // Re-enable
  await toggle.click();
  await expect(toggle).toHaveText('⏸');
  await expect(toggle).not.toHaveClass(/animated-background__toggle--disabled/);
});

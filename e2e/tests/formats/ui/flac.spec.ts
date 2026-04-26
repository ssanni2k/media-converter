import { test, expect } from '@playwright/test';
import { s } from '../../../helpers/selectors';
import { clearLocalStorage, uploadAndWaitForCompletion } from '../../../helpers/wait-for';
import { media, SUPPORTED_INPUTS } from '../../../helpers/test-media';

const FORMAT = 'flac';
const others = SUPPORTED_INPUTS.filter(f => f !== FORMAT);

const AUDIO_ONLY = ['mp3', 'wav', 'flac', 'ogg', 'aac', 'wma', 'ac3'] as const;
const MXF_REQUIRES_VIDEO = FORMAT === 'mxf';

test.describe(`${FORMAT.toUpperCase()} как источник (UI)`, () => {
  for (const target of others) {
    const skip = (MXF_REQUIRES_VIDEO || target === 'mxf')
      && (AUDIO_ONLY.includes(FORMAT) || AUDIO_ONLY.includes(target));
    (skip ? test.skip : test)(`${FORMAT} → ${target}`, async ({ page }) => {
      await clearLocalStorage(page);
      await uploadAndWaitForCompletion(page, media[FORMAT], target);

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }),
        page.locator(s.downloadBtn).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${target}$`));
    });
  }
});

test.describe(`Конвертация в ${FORMAT.toUpperCase()} (UI)`, () => {
  for (const source of others) {
    const skip = (MXF_REQUIRES_VIDEO || source === 'mxf')
      && (AUDIO_ONLY.includes(FORMAT) || AUDIO_ONLY.includes(source));
    (skip ? test.skip : test)(`${source} → ${FORMAT}`, async ({ page }) => {
      await clearLocalStorage(page);
      await uploadAndWaitForCompletion(page, media[source], FORMAT);

      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }),
        page.locator(s.downloadBtn).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${FORMAT}$`));
    });
  }
});

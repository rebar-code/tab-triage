import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

function previewCount(panel: Page): Promise<number> {
  return panel.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('tab-triage', 1);
        req.onsuccess = () => {
          const count = req.result.transaction('previews').objectStore('previews').count();
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => reject(count.error);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

function capturedAt(panel: Page, url: string): Promise<number> {
  return panel.evaluate(
    (key) =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('tab-triage', 1);
        req.onsuccess = () => {
          const get = req.result.transaction('previews').objectStore('previews').get(key);
          get.onsuccess = () => resolve((get.result as { capturedAt?: number })?.capturedAt ?? 0);
          get.onerror = () => reject(get.error);
        };
        req.onerror = () => reject(req.error);
      }),
    url,
  );
}

test('scrolling the visible tab refreshes its screenshot', async ({ context, panel }) => {
  const page = await context.newPage();
  await page.goto('https://example.com/long');
  await page.evaluate(() => {
    document.body.style.height = '5000px';
  });
  await page.bringToFront();
  await expect
    .poll(() => capturedAt(panel, 'https://example.com/long'), { timeout: 10_000 })
    .toBeGreaterThan(0);
  const first = await capturedAt(panel, 'https://example.com/long');
  await page.mouse.move(200, 200);
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => capturedAt(panel, 'https://example.com/long')).toBeGreaterThan(first);
});

test('hover shows the last screenshot of a tab; closing the tab deletes it', async ({
  context,
  panel,
}) => {
  const page = await context.newPage();
  await page.goto('https://example.com/a');
  await page.bringToFront();
  await expect.poll(() => previewCount(panel), { timeout: 10_000 }).toBeGreaterThan(0);

  await panel.bringToFront();
  const rows = panel.locator('[data-group="example.com"]').getByTestId('tab-row');
  const card = panel.getByTestId('preview');

  await rows.first().hover();
  await expect(card.locator('img')).toHaveAttribute('src', /^blob:/);
  await expect(card).toContainText('example.com/a');
  await panel.screenshot({ path: 'test-results/preview.png' });

  // A tab that was never captured still gets the title card.
  await panel.locator('[data-group="about:"]').getByTestId('tab-row').first().hover();
  await expect(card).toContainText('about:blank');
  await expect(card.locator('img')).toHaveCount(0);

  await panel.getByRole('search').or(panel.getByLabel('Search tabs')).hover();
  await expect(card).toHaveCount(0);

  await rows.first().hover();
  await rows.first().getByTitle('Close tab').click();
  await expect(rows).toHaveCount(0);
  await expect.poll(() => previewCount(panel)).toBe(0);
});

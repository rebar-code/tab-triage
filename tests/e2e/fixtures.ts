import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '../../dist');

// Header StateLabel as github.com serves it.
const prStatus: Record<string, string> = { '1': 'pullMerged', '2': 'pullOpened', '3': 'draft' };

function pageFor(url: URL): string {
  // Pages for element filters; github.com is already readable by the extension.
  if (url.hostname === 'github.com' && url.pathname.startsWith('/tab-triage-status/')) {
    const status = url.pathname.split('/').at(-1) ?? '';
    return `<title>Status ${status}</title><p>Status <span id="s">${status}</span></p>`;
  }
  if (url.hostname === 'github.com') {
    const n = url.pathname.split('/').at(-1) ?? '';
    const status = prStatus[n] ?? 'pullOpened';
    return `<title>PR ${n}</title><span data-component="StateLabel" data-status="${status}">x</span>`;
  }
  if (url.hostname === 'supabase.com')
    return '<title>Table Editor | Acme | Rebar | Supabase</title>';
  return `<title>${url.hostname}${url.pathname}</title><p>${url.href}</p>`;
}

export const test = base.extend<{ context: BrowserContext; panel: Page }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
    await context.route(/^https:\/\/(?!.*\/_favicon)/, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: pageFor(new URL(route.request().url())),
      }),
    );
    await use(context);
    await context.close();
  },
  panel: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 380, height: 720 });
    await panel.goto(`chrome-extension://${id}/sidepanel.html`);
    await use(panel);
  },
});

export async function openTabs(context: BrowserContext, urls: string[]): Promise<void> {
  for (const url of urls) {
    const page = await context.newPage();
    await page.goto(url);
  }
}

export { expect } from '@playwright/test';

import { expect, openTabs, test } from './fixtures';

test('groups tabs, closes merged PRs, bulk closes with shift-click, undoes, saves', async ({
  context,
  panel,
}) => {
  await openTabs(context, [
    'https://example.com/a',
    'https://example.com/b',
    'https://docs.example.com/c',
    'https://example.org/x',
    'https://example.org/x#again',
    'https://github.com/tab-triage-test/repo/pull/1',
    'https://github.com/tab-triage-test/repo/pull/2',
    'https://github.com/tab-triage-test/repo/pull/3',
    'https://supabase.com/dashboard/project/abc123/editor',
  ]);
  // The GitHub page script has had time to report PR states.
  await panel.waitForTimeout(1500);
  await panel.bringToFront();
  await panel.reload();

  const group = (key: string) => panel.locator(`[data-testid="group"][data-group="${key}"]`);
  const rows = (key: string) => group(key).getByTestId('tab-row');

  // Root-domain grouping: docs.example.com sits under example.com.
  await expect(rows('example.com')).toHaveCount(3);
  await expect(rows('github.com')).toHaveCount(3);

  // PR states from the page script.
  const states = group('github.com').locator('[data-state]');
  await expect(states).toHaveCount(3);
  await expect(group('github.com').locator('[data-state="merged"]')).toHaveCount(1);
  await expect(group('github.com').locator('[data-state="draft"]')).toHaveCount(1);
  await expect(group('github.com').locator('[data-state="open"]')).toHaveCount(1);

  // Supabase project label from the tab title.
  await expect(
    group('supabase.com').getByRole('button', { name: 'Acme', exact: true }),
  ).toBeVisible();

  await expect(panel.getByRole('button', { name: 'Close duplicates (1)' })).toBeVisible();
  await panel.screenshot({ path: 'test-results/panel.png' });

  // Close merged PRs, then undo.
  await panel.getByRole('button', { name: 'Close merged PRs (1)' }).click();
  await expect(rows('github.com')).toHaveCount(2);
  await panel.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(rows('github.com')).toHaveCount(3);

  // Click the first checkbox, shift-click the third: all three selected.
  const boxes = rows('example.com').getByRole('checkbox');
  await rows('example.com').first().hover();
  await boxes.nth(0).click();
  await boxes.nth(2).click({ modifiers: ['Shift'] });
  await expect(panel.getByText('3 selected')).toBeVisible();
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(group('example.com')).toHaveCount(0);

  await panel.keyboard.press('ControlOrMeta+z');
  await expect(rows('example.com')).toHaveCount(3);

  // Save for later closes the tab and lists it.
  await rows('example.org').first().hover();
  await rows('example.org').first().getByRole('checkbox').click();
  await panel.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rows('example.org')).toHaveCount(1);
  await panel.getByRole('button', { name: /^Saved/ }).click();
  await expect(panel.getByTestId('saved-row')).toHaveCount(1);
});

test('trash closes one tab and pinned tabs cannot be selected', async ({ context, panel }) => {
  await openTabs(context, ['https://a.example.net/1', 'https://a.example.net/2']);
  const pinned = (
    await panel.evaluate(() => chrome.tabs.query({ url: 'https://a.example.net/1' }))
  )[0];
  await panel.evaluate((id) => chrome.tabs.update(id, { pinned: true }), pinned?.id ?? -1);

  const rows = panel.locator('[data-group="example.net"]').getByTestId('tab-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().getByTitle('Pinned')).toBeVisible();
  await expect(rows.first().getByRole('checkbox')).toHaveCount(0);

  await rows.nth(1).hover();
  await rows.nth(1).getByTitle('Close tab').click();
  await expect(rows).toHaveCount(1);
});

test('checkboxes show their checked state', async ({ context, panel }) => {
  await openTabs(context, ['https://b.example.net/1', 'https://b.example.net/2']);
  const rows = panel.locator('[data-group="example.net"]').getByTestId('tab-row');
  const boxes = rows.getByRole('checkbox');
  await expect(boxes).toHaveCount(2);

  await rows.first().hover();
  await boxes.first().click();
  await expect(boxes.first()).toBeChecked();
  await boxes.nth(1).click();
  await expect(boxes.nth(1)).toBeChecked();
  await boxes.first().click();
  await expect(boxes.first()).not.toBeChecked();
  await expect(boxes.nth(1)).toBeChecked();

  await panel.keyboard.press('Escape');
  await expect(boxes.nth(1)).not.toBeChecked();

  const all = panel.locator('[data-group="example.net"]').getByRole('checkbox', {
    name: 'Select group',
  });
  await all.click();
  await expect(all).toBeChecked();
  await expect(boxes.first()).toBeChecked();
  await expect(boxes.nth(1)).toBeChecked();
  await all.click();
  await expect(all).not.toBeChecked();
  await expect(boxes.first()).not.toBeChecked();
});

test('search box has focus with its kept text selected', async ({ panel }) => {
  const search = panel.getByRole('searchbox', { name: 'Search tabs' });
  await search.fill('github');
  await panel.reload();

  await expect(search).toBeFocused();
  await expect(search).toHaveValue('github');
  const selection = await search.evaluate((el: HTMLInputElement) => [
    el.selectionStart,
    el.selectionEnd,
  ]);
  expect(selection).toEqual([0, 6]);

  await panel.keyboard.type('x');
  await expect(search).toHaveValue('x');
});

test('settings show the shortcut and a link to change it', async ({ panel }) => {
  await panel.getByTitle('Settings').click();
  const row = panel.getByTestId('shortcut');
  await expect(row).toContainText(/T|Not set/);
  await expect(row.getByRole('button', { name: 'Change' })).toBeVisible();
});

test('settings offer access to all sites until it is granted', async ({ panel }) => {
  await panel.getByTitle('Settings').click();
  await expect(
    panel.getByTestId('site-access').getByRole('button', { name: 'Allow all sites' }),
  ).toBeVisible();
});

const statusFilter = {
  id: 'status-done',
  name: 'Status done',
  domain: 'github.com',
  urlContains: 'tab-triage-status',
  titleContains: '',
  idleDays: 0,
  selector: '#s',
  textOp: 'is',
  text: 'Done',
  pinned: true,
};

test('element filter closes only the tabs whose page matches', async ({ context, panel }) => {
  await openTabs(context, [
    'https://github.com/tab-triage-status/Done',
    'https://github.com/tab-triage-status/Pending',
  ]);
  await panel.bringToFront();
  await panel.evaluate(
    (filters) => chrome.storage.local.set({ filters }),
    [
      statusFilter,
      {
        ...statusFilter,
        id: 'no-access',
        name: 'Other site',
        domain: 'example.com',
        pinned: false,
      },
    ],
  );

  const rows = panel.locator('[data-group="github.com"]').getByTestId('tab-row');
  await expect(rows).toHaveCount(2);

  // Pinned filter shows as a chip; hovering its trash marks the tab it closes.
  const chip = panel.getByRole('group', { name: 'Status done' });
  await expect(chip.getByRole('button', { name: 'Status done (1)' })).toBeVisible();
  await chip.getByTitle('Close 1').hover();
  await expect(panel.locator('[data-testid="tab-row"].hl-close')).toHaveCount(1);
  await expect(panel.locator('.hl-close')).toContainText('Status Done');

  // Menu: counts, no access for a site the extension cannot read, Esc closes it.
  await panel.getByTitle('Filters').click();
  const item = (name: string) =>
    panel.locator(`[data-testid="filter-item"][data-filter="${name}"]`);
  await expect(item('Status done')).toContainText('1');
  await expect(item('Other site').getByRole('button', { name: 'No access' })).toBeVisible();
  await panel.keyboard.press('Escape');
  await expect(item('Status done')).toHaveCount(0);

  // Show lists the matches, all checked.
  await chip.getByRole('button', { name: 'Status done (1)' }).click();
  await expect(rows).toHaveCount(1);
  await expect(panel.getByRole('button', { name: 'Close 1' })).toBeVisible();
  await panel.getByTitle('Cancel').click();
  await expect(rows).toHaveCount(2);

  await chip.getByTitle('Close 1').click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('Status Pending');
  await panel.screenshot({ path: 'test-results/filters.png' });
});

test('pick fills the selector and text from a clicked element', async ({ context, panel }) => {
  const page = await context.newPage();
  await page.goto('https://github.com/tab-triage-status/Done');
  await panel.bringToFront();

  await panel.getByTitle('Filters').click();
  await panel.getByRole('button', { name: 'Filter', exact: true }).click();
  const editor = panel.getByTestId('filter-editor').last();
  await expect(editor).toHaveClass(/focused/);
  await editor.getByLabel('Site').fill('github.com');
  await editor.getByLabel('Site').blur();
  await expect(editor.getByLabel('Site')).toHaveValue('github.com');

  await editor.getByRole('button', { name: 'Pick' }).click();
  await expect(editor.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await page.locator('#s').click();

  await expect(editor.getByLabel('Element')).toHaveValue('#s');
  await expect(editor.getByLabel('Text match')).toHaveValue('is');
  await expect(editor.locator('input[id$="-text"]')).toHaveValue('Done');
  await panel.screenshot({ path: 'test-results/filter-editor.png' });

  await panel.getByTitle('Close').click();
  await expect(panel.getByRole('searchbox', { name: 'Search tabs' })).toBeVisible();
});

test('cmd-click on a title selects the tab instead of opening it', async ({ context, panel }) => {
  await openTabs(context, ['https://c.example.net/1', 'https://c.example.net/2']);
  await panel.bringToFront();
  const rows = panel.locator('[data-group="example.net"]').getByTestId('tab-row');
  await expect(rows).toHaveCount(2);

  await rows
    .first()
    .getByRole('button')
    .first()
    .click({ modifiers: ['ControlOrMeta'] });
  await expect(panel.getByText('1 selected')).toBeVisible();
  await rows
    .nth(1)
    .getByRole('button')
    .first()
    .click({ modifiers: ['ControlOrMeta'] });
  await expect(panel.getByText('2 selected')).toBeVisible();
  await rows
    .first()
    .getByRole('button')
    .first()
    .click({ modifiers: ['ControlOrMeta'] });
  await expect(panel.getByText('1 selected')).toBeVisible();
  expect(await panel.evaluate(() => document.visibilityState)).toBe('visible');
});

test('cmd-z puts closed tabs back, wherever the focus is', async ({ context, panel }) => {
  await openTabs(context, ['https://d.example.net/1', 'https://d.example.net/2']);
  await panel.bringToFront();
  await panel.reload();
  const rows = panel.locator('[data-group="example.net"]').getByTestId('tab-row');
  const search = panel.getByRole('searchbox', { name: 'Search tabs' });
  await expect(rows).toHaveCount(2);

  // Checkbox has focus: Delete closes, cmd-z reopens.
  await rows.first().hover();
  await rows.first().getByRole('checkbox').click();
  await panel.keyboard.press('Delete');
  await expect(rows).toHaveCount(1);
  await panel.keyboard.press('ControlOrMeta+z');
  await expect(rows).toHaveCount(2);

  // Search has focus, as it does on open: cmd-z still reopens the last close.
  await rows.first().hover();
  await rows.first().getByTitle('Close tab').click();
  await expect(rows).toHaveCount(1);
  await search.focus();
  await panel.keyboard.press('ControlOrMeta+z');
  await expect(rows).toHaveCount(2);

  // Typing after the close: cmd-z edits the search text instead.
  await rows.first().hover();
  await rows.first().getByTitle('Close tab').click();
  await search.fill('');
  await search.pressSequentially('d.ex');
  await panel.keyboard.press('ControlOrMeta+z');
  await expect(rows).toHaveCount(1);
});

test('hovering a discarded tab loads it in the background', async ({ context, panel }) => {
  await openTabs(context, ['https://c.example.net/1', 'https://c.example.net/2']);
  await panel.bringToFront();
  const discard = (url: string): Promise<number> =>
    panel.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url });
      return (await chrome.tabs.discard(tab?.id ?? -1))?.id ?? -1;
    }, url);
  const state = (id: number): Promise<chrome.tabs.Tab> =>
    panel.evaluate((id) => chrome.tabs.get(id), id);
  const row = (id: number) => panel.locator(`[data-tab-id="${id}"]`);
  const away = panel.getByTitle('By domain');

  // A pass over the row shorter than the hover delay loads nothing.
  const quick = await discard('https://c.example.net/1');
  await expect(row(quick)).toHaveClass(/discarded/);
  await row(quick).hover();
  await away.hover();
  await panel.waitForTimeout(400);
  expect((await state(quick)).discarded).toBe(true);

  // Resting on the row loads the tab without activating it.
  const slow = await discard('https://c.example.net/2');
  await expect(row(slow)).toHaveClass(/discarded/);
  await row(slow).hover();
  await expect.poll(async () => (await state(slow)).discarded).toBe(false);
  expect((await state(slow)).active).toBe(false);
  expect((await panel.evaluate(() => chrome.tabs.getCurrent()))?.active).toBe(true);
});

test('hovering a tab on screen frames it, and a background tab frames nothing', async ({
  context,
  panel,
}) => {
  const opened = context.waitForEvent('page');
  const windowId = await panel.evaluate(
    async () => (await chrome.windows.create({ url: 'about:blank' }))?.id ?? -1,
  );
  const other = await opened;
  // Navigate from Playwright so the route serves the page.
  await other.goto('https://github.com/acme/app/pull/2');
  const background = await panel.evaluate(
    async (windowId) => (await chrome.tabs.create({ windowId, active: false })).id,
    windowId,
  );
  const visible = panel.locator('[data-tab-id]', { hasText: 'PR 2' });
  const hidden = panel.locator(`[data-tab-id="${background}"]`);
  await expect(visible).toHaveCount(1);
  await expect(hidden).toHaveCount(1);
  const frame = other.locator('#tab-triage-window-frame');

  await hidden.hover();
  await panel.waitForTimeout(500);
  await expect(frame).toHaveCount(0);

  await visible.hover();
  await expect(frame).toHaveCount(1);
  await panel.getByTitle('By domain').hover();
  await expect(frame).toHaveCount(0);
});

test('resting on a row previews its tab in the page the main window shows', async ({
  context,
  panel,
}) => {
  await openTabs(context, [
    'https://github.com/acme/app/pull/1',
    'https://github.com/acme/app/pull/2',
  ]);
  const host = context.pages().find((p) => p.url().endsWith('/pull/1'));
  if (!host) throw new Error('no host page');
  await host.bringToFront();
  const row = (title: string) => panel.locator('[data-tab-id]', { hasText: title });
  const card = host.locator('#tab-triage-preview');
  const stored = (): Promise<Record<string, unknown>> =>
    panel.evaluate(() => chrome.storage.session.get(null));

  // A quick pass over the row shows nothing.
  await row('PR 2').hover();
  await panel.getByTitle('By domain').hover();
  await panel.waitForTimeout(700);
  await expect(card).toHaveCount(0);

  await row('PR 2').hover();
  await expect(card).toHaveCount(1);
  await expect(host.frameLocator('#tab-triage-preview').getByText('PR 2')).toBeVisible();

  // The page on screen needs no preview of itself.
  await row('PR 1').hover();
  await expect(card).toHaveCount(0);

  await row('PR 2').hover();
  await expect(card).toHaveCount(1);
  await panel.getByTitle('By domain').hover();
  await expect(card).toHaveCount(0);
  expect(await stored()).toEqual({});
});

test('pinning a filter in the menu shows it as a chip only while it has matches', async ({
  context,
  panel,
}) => {
  await openTabs(context, ['https://e.example.net/1', 'https://e.example.net/2']);
  await panel.bringToFront();
  await panel.evaluate(
    (filters) => chrome.storage.local.set({ filters }),
    [
      { ...statusFilter, id: 'e-tabs', name: 'E tabs', domain: 'example.net', selector: '' },
      { ...statusFilter, id: 'none', name: 'Nothing open', domain: 'nowhere.test', selector: '' },
    ].map((f) => ({ ...f, urlContains: '', pinned: false })),
  );
  await expect(panel.locator('[data-group="example.net"]').getByTestId('tab-row')).toHaveCount(2);

  await panel.getByTitle('Filters').click();
  const item = (name: string) =>
    panel.locator(`[data-testid="filter-item"][data-filter="${name}"]`);
  await item('E tabs').getByTitle('Pin as chip').click();
  await item('Nothing open').getByTitle('Pin as chip').click();
  await panel.keyboard.press('Escape');

  await expect(panel.getByRole('group', { name: 'E tabs' })).toContainText('E tabs (2)');
  // A pinned filter with no matching tabs hides its chip.
  await expect(panel.getByRole('group', { name: 'Nothing open' })).toHaveCount(0);
});

test('element filters re-check pages that change without a reload', async ({ context, panel }) => {
  const open = async (path: string) => {
    const page = await context.newPage();
    await page.goto(`https://github.com/tab-triage-status/${path}`);
    return page;
  };
  const setStatus = (page: import('@playwright/test').Page, text: string) =>
    page.evaluate((t) => (document.querySelector('#s')!.textContent = t), text);
  const [a, b, c] = [await open('Pending'), await open('Pending'), await open('Pending')];
  await panel.bringToFront();
  await panel.evaluate((filters) => chrome.storage.local.set({ filters }), [statusFilter]);
  const chip = panel.getByRole('group', { name: 'Status done' });
  await expect(chip).toHaveCount(0);

  // Switching to a tab re-checks it, and the tab you are on counts.
  await setStatus(a, 'Done');
  await a.bringToFront();
  await expect(chip).toContainText('Status done (1)');

  // An in-app navigation (URL change, no load) re-checks.
  await b.evaluate(() => history.pushState({}, '', '/tab-triage-status/moved'));
  await setStatus(b, 'Done');
  await b.evaluate(() => history.pushState({}, '', '/tab-triage-status/moved-again'));
  await expect(chip).toContainText('Status done (2)');

  // Opening the filter menu re-checks.
  await panel.bringToFront();
  await setStatus(c, 'Done');
  await panel.getByTitle('Filters').click();
  await expect(
    panel.locator('[data-testid="filter-item"][data-filter="Status done"]'),
  ).toContainText('3');
});

test('a new filter offers the current page as one-click values', async ({ context, panel }) => {
  await openTabs(context, ['https://github.com/tab-triage-status/Other']);
  const page = await context.newPage();
  await page.goto('https://github.com/tab-triage-status/Done');

  await panel.getByTitle('Filters').click();
  await panel.getByRole('button', { name: 'Filter', exact: true }).click();
  const editor = panel.getByTestId('filter-editor').last();

  await editor.getByTitle('^github\\.com$').click();
  await expect(editor.getByLabel('Site')).toHaveValue('^github\\.com$');
  await expect(editor.getByTitle('^github\\.com$')).toHaveCount(0);
  await editor.getByRole('button', { name: '/tab-triage-status/Done' }).click();
  await expect(editor.getByLabel('URL contains')).toHaveValue('/tab-triage-status/Done');
  await editor.getByRole('button', { name: 'Status Done' }).click();
  await expect(editor.getByLabel('Title contains')).toHaveValue('Status Done');

  await editor.getByLabel('Site').fill('(');
  await editor.getByLabel('Site').blur();
  await expect(editor.getByLabel('Site')).toHaveAttribute('aria-invalid', 'true');
  await editor.getByLabel('Site').fill('github');
  await editor.getByLabel('Site').blur();
  await panel.screenshot({ path: 'test-results/filter-suggestions.png' });

  await panel.getByTitle('Close').click();
  await panel.getByTitle('Filters').click();
  await expect(
    panel.locator('[data-testid="filter-item"][data-filter="New filter"]'),
  ).toContainText('1');
});

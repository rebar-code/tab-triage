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

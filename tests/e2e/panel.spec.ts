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

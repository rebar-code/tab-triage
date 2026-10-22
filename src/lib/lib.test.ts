import { describe, expect, it, vi } from 'vitest';
import {
  matchesStatic,
  newFilter,
  pageSuggestions,
  siteMatches,
  siteOrigins,
  textMatches,
} from './filters';
import { formatAge, groupTabs } from './group';
import { toItems, learnedSupabaseNames, type RawTab } from './items';
import { createPrewarm, needsLoad, type Prewarm, type TabState } from './prewarm';
import { DEFAULT_RULES, dueRule } from './rules';
import { rangeIds } from './selection';
import { emptySnapshot } from './storage';
import type { Rules } from './types';
import { groupKey, normalizeUrl } from './url';

const NOW = new Date('2026-10-19T15:00:00').getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let nextId = 1;
function tab(url: string, extra: Partial<RawTab> = {}): RawTab {
  return {
    id: nextId++,
    windowId: 1,
    index: 0,
    url,
    title: url,
    pinned: false,
    audible: false,
    active: false,
    discarded: false,
    lastAccessed: NOW - HOUR,
    ...extra,
  };
}

describe('url', () => {
  it('groups by root domain', () => {
    expect(groupKey('https://docs.github.com/en')).toBe('github.com');
    expect(groupKey('https://www.bbc.co.uk/news')).toBe('bbc.co.uk');
    expect(groupKey('https://app-abc-team.vercel.app/')).toBe('vercel.com');
    expect(groupKey('http://localhost:5173/')).toBe('localhost');
    expect(groupKey('chrome://extensions/')).toBe('chrome://');
    expect(groupKey('not a url')).toBe('other');
  });

  it('normalizes away hash and trailing slash', () => {
    expect(normalizeUrl('https://a.com/x/#top')).toBe('https://a.com/x');
    expect(normalizeUrl('https://a.com/')).toBe('https://a.com/');
  });
});

describe('items', () => {
  it('marks extra copies as duplicates and keeps the active one', () => {
    const items = toItems(
      [
        tab('https://a.com/x', { lastAccessed: NOW }),
        tab('https://a.com/x#y', { active: true, lastAccessed: NOW - DAY }),
        tab('https://a.com/z'),
      ],
      emptySnapshot(),
      NOW,
    );
    expect(items.map((i) => i.duplicate)).toEqual([true, false, false]);
  });

  it('keeps the latest viewed copy when none is active', () => {
    const items = toItems(
      [tab('https://a.com/x', { lastAccessed: NOW - DAY }), tab('https://a.com/x')],
      emptySnapshot(),
      NOW,
    );
    expect(items.map((i) => i.duplicate)).toEqual([true, false]);
  });

  it('labels Supabase tabs, preferring a manual name', () => {
    const snap = emptySnapshot();
    const t = tab('https://supabase.com/dashboard/project/ref1/editor', {
      title: 'Table Editor | Acme | Rebar | Supabase',
    });
    expect(toItems([t], snap, NOW)[0]?.label).toBe('Acme');
    expect(learnedSupabaseNames(toItems([t], snap, NOW), snap).get('ref1')).toBe('Acme');
    snap.supabase.ref1 = { name: 'PW prod', manual: true };
    expect(toItems([t], snap, NOW)[0]?.label).toBe('PW prod');
    expect(learnedSupabaseNames(toItems([t], snap, NOW), snap).size).toBe(0);
  });

  it('attaches GitHub state by PR key', () => {
    const snap = emptySnapshot();
    snap.github['a/b#3'] = { kind: 'pr', state: 'merged', since: NOW, checkedAt: NOW };
    expect(toItems([tab('https://github.com/A/B/pull/3/files')], snap, NOW)[0]?.github?.state).toBe(
      'merged',
    );
  });
});

describe('groupTabs', () => {
  it('groups by domain, biggest first, oldest tab first', () => {
    const snap = emptySnapshot();
    snap.opened['https://a.com/old'] = NOW - 5 * DAY;
    const items = toItems(
      [
        tab('https://b.com/1'),
        tab('https://a.com/new', { lastAccessed: NOW }),
        tab('https://a.com/old'),
      ],
      snap,
      NOW,
    );
    const groups = groupTabs(items, 'domain', NOW);
    expect(groups.map((g) => g.key)).toEqual(['a.com', 'b.com']);
    expect(groups[0]?.tabs.map((t) => t.url)).toEqual(['https://a.com/old', 'https://a.com/new']);
  });

  it('groups by last viewed', () => {
    const items = toItems(
      [
        tab('https://a.com/1', { lastAccessed: NOW - 40 * DAY }),
        tab('https://a.com/2', { lastAccessed: NOW - HOUR }),
        tab('https://a.com/3', { lastAccessed: NOW - DAY }),
      ],
      emptySnapshot(),
      NOW,
    );
    expect(groupTabs(items, 'recent', NOW).map((g) => g.key)).toEqual([
      'Today',
      'Yesterday',
      'Older',
    ]);
  });
});

describe('rules', () => {
  const rules = (patch: Partial<Rules>): Rules => ({ ...structuredClone(DEFAULT_RULES), ...patch });

  it('closes merged PRs after the delay', () => {
    const snap = emptySnapshot();
    snap.github['a/b#1'] = { kind: 'pr', state: 'merged', since: NOW - 2 * HOUR, checkedAt: NOW };
    const [item] = toItems([tab('https://github.com/a/b/pull/1')], snap, NOW);
    if (!item) throw new Error('no item');
    expect(dueRule(item, DEFAULT_RULES, NOW)).toBeNull();
    expect(dueRule(item, rules({ mergedPr: { on: true, hours: 3 } }), NOW)).toBeNull();
    expect(dueRule(item, rules({ mergedPr: { on: true, hours: 1 } }), NOW)).toBe('mergedPr');
  });

  it('never closes pinned, audible or active tabs', () => {
    const r = rules({ idle: { on: true, days: 1 } });
    const old = { lastAccessed: NOW - 30 * DAY };
    const items = toItems(
      [
        tab('https://a.com/1', { ...old, pinned: true }),
        tab('https://a.com/2', { ...old, audible: true }),
        tab('https://a.com/3', { ...old, active: true }),
        tab('https://a.com/4', old),
      ],
      emptySnapshot(),
      NOW,
    );
    expect(items.map((i) => dueRule(i, r, NOW))).toEqual([null, null, null, 'idle']);
  });

  it('applies domain rules', () => {
    const r = rules({ domains: [{ domain: 'Example.com', days: 2, on: true }] });
    const items = toItems(
      [
        tab('https://www.example.com/', { lastAccessed: NOW - 3 * DAY }),
        tab('https://other.com/', { lastAccessed: NOW - 3 * DAY }),
      ],
      emptySnapshot(),
      NOW,
    );
    expect(items.map((i) => dueRule(i, r, NOW))).toEqual(['domain:Example.com', null]);
  });
});

describe('selection and formatting', () => {
  it('selects a range in either direction', () => {
    expect(rangeIds([1, 2, 3, 4], 2, 4)).toEqual([2, 3, 4]);
    expect(rangeIds([1, 2, 3, 4], 4, 2)).toEqual([2, 3, 4]);
    expect(rangeIds([1, 2, 3, 4], null, 3)).toEqual([3]);
    expect(rangeIds([1, 2, 3, 4], 9, 3)).toEqual([3]);
  });

  it('formats ages', () => {
    expect(formatAge(5 * 60_000)).toBe('5m');
    expect(formatAge(3 * HOUR)).toBe('3h');
    expect(formatAge(3 * DAY)).toBe('3d');
    expect(formatAge(21 * DAY)).toBe('3w');
    expect(formatAge(90 * DAY)).toBe('3mo');
  });
});

describe('quick filters', () => {
  const items = (raw: RawTab[]) => toItems(raw, emptySnapshot(), NOW);

  it('needs every set condition to match', () => {
    const [a, b, c, d] = items([
      tab('https://linear.app/rebar/issue/REB-1', {
        title: 'REB-1 Fix',
        lastAccessed: NOW - 3 * DAY,
      }),
      tab('https://linear.app/rebar/issue/REB-2', { title: 'REB-2 Fix', lastAccessed: NOW - HOUR }),
      tab('https://github.com/rebar/issue/1', { title: 'Fix', lastAccessed: NOW - 3 * DAY }),
      tab('https://app.linear.app/rebar/view', { title: 'View', lastAccessed: NOW - 3 * DAY }),
    ]);
    const f = newFilter({
      domain: 'linear.app',
      urlContains: '/ISSUE/',
      titleContains: 'fix',
      idleDays: 2,
    });
    expect([a, b, c, d].map((t) => matchesStatic(t!, f, NOW))).toEqual([true, false, false, false]);
    expect(matchesStatic(d!, newFilter({ domain: 'linear.app' }), NOW)).toBe(true);
    expect(matchesStatic(c!, newFilter(), NOW)).toBe(true);
  });

  it('counts idle days from the last view', () => {
    const [old, fresh] = items([
      tab('https://a.com/1', { lastAccessed: NOW - 2 * DAY }),
      tab('https://a.com/2', { lastAccessed: NOW - 2 * DAY + HOUR }),
    ]);
    const f = newFilter({ idleDays: 2 });
    expect(matchesStatic(old!, f, NOW)).toBe(true);
    expect(matchesStatic(fresh!, f, NOW)).toBe(false);
  });

  it('never matches pinned or audible tabs, but does match the active one', () => {
    const tabs = items([
      tab('https://a.com/1', { pinned: true }),
      tab('https://a.com/2', { audible: true }),
      tab('https://a.com/3', { active: true }),
    ]);
    expect(tabs.map((t) => matchesStatic(t, newFilter(), NOW))).toEqual([false, false, true]);
  });

  it('compares element text', () => {
    expect(textMatches(null, 'missing', '')).toBe(true);
    expect(textMatches('Done', 'missing', '')).toBe(false);
    expect(textMatches(null, 'exists', '')).toBe(false);
    expect(textMatches('', 'exists', '')).toBe(true);
    expect(textMatches(' Done ', 'is', 'done')).toBe(true);
    expect(textMatches('Done', 'isNot', 'Done')).toBe(false);
    expect(textMatches(null, 'isNot', 'Done')).toBe(false);
    expect(textMatches('In Progress', 'contains', 'prog')).toBe(true);
    expect(textMatches('In Progress', 'notContains', 'prog')).toBe(false);
    expect(textMatches('Done today', 'startsWith', 'done')).toBe(true);
    expect(textMatches('Todo', 'regex', '^(done|todo)$')).toBe(true);
    expect(textMatches('Todo', 'regex', '(')).toBe(false);
  });

  it('matches the site as a regex on the host name', () => {
    expect(siteMatches('https://app.linear.app/x', 'linear.app')).toBe(true);
    expect(siteMatches('https://app.linear.app/x', '^linear\\.app$')).toBe(false);
    expect(siteMatches('https://LINEAR.app/x', '^linear\\.app$')).toBe(true);
    expect(siteMatches('https://a.com/x', '(')).toBe(false);
  });

  it('suggests exact values from the current page', () => {
    const s = pageSuggestions('https://app.examplewindows.com/calendar?w=1', 'Calendar | EXW');
    expect(s.site.map((x) => x.value)).toEqual([
      '^app\\.examplewindows\\.com$',
      '(^|\\.)examplewindows\\.com$',
    ]);
    expect(siteMatches('https://app.examplewindows.com/', s.site[0]!.value)).toBe(true);
    expect(siteMatches('https://evil-examplewindows.com/', s.site[1]!.value)).toBe(false);
    expect(s.url).toEqual([{ label: '/calendar', value: '/calendar' }]);
    expect(s.title).toEqual([{ label: 'Calendar | EXW', value: 'Calendar | EXW' }]);
    expect(pageSuggestions('chrome://newtab/', 'New Tab').site).toEqual([]);
  });

  it('asks access for the hosts of the open tabs the site matches', () => {
    const tabs = items([
      tab('https://app.linear.app/1'),
      tab('https://app.linear.app/2'),
      tab('https://linear.app/x'),
      tab('https://github.com/x'),
    ]);
    expect(siteOrigins(newFilter({ domain: 'linear\\.app$' }), tabs)).toEqual([
      'https://app.linear.app/*',
      'https://linear.app/*',
    ]);
    expect(siteOrigins(newFilter(), tabs)).toEqual(['https://*/*']);
    expect(siteOrigins(newFilter({ domain: '^example\\.com$' }), tabs)).toEqual([
      'https://example.com/*',
    ]);
    expect(siteOrigins(newFilter({ domain: '(^|\\.)x\\.com$' }), tabs)).toEqual([]);
  });
});

describe('prewarm', () => {
  const idle: TabState = { active: false, discarded: false, status: 'complete' };

  function setup(states: Record<number, TabState>): {
    warm: Prewarm;
    reload: ReturnType<typeof vi.fn>;
  } {
    const reload = vi.fn(async (id: number) => {
      states[id] = { active: false, discarded: false, status: 'loading' };
    });
    return { warm: createPrewarm({ get: async (id) => states[id]!, reload }, 150), reload };
  }

  it('loads only discarded or unloaded background tabs', () => {
    expect(needsLoad({ ...idle, discarded: true })).toBe(true);
    expect(needsLoad({ ...idle, status: 'unloaded' })).toBe(true);
    expect(needsLoad(idle)).toBe(false);
    expect(needsLoad({ ...idle, active: true, discarded: true })).toBe(false);
  });

  it('waits for the hover delay and cancels on leave', async () => {
    vi.useFakeTimers();
    const { warm, reload } = setup({ 1: { ...idle, discarded: true } });
    warm.enter(1);
    await vi.advanceTimersByTimeAsync(100);
    warm.leave();
    await vi.advanceTimersByTimeAsync(200);
    expect(reload).not.toHaveBeenCalled();
    warm.enter(1);
    await vi.advanceTimersByTimeAsync(150);
    expect(reload).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('skips loaded tabs and keeps one load in flight', async () => {
    vi.useFakeTimers();
    const states: Record<number, TabState> = {
      1: { ...idle, discarded: true },
      2: { ...idle, status: 'unloaded' },
      3: idle,
    };
    const { warm, reload } = setup(states);
    warm.enter(3);
    await vi.advanceTimersByTimeAsync(150);
    expect(reload).not.toHaveBeenCalled();
    warm.enter(1);
    await vi.advanceTimersByTimeAsync(150);
    warm.enter(2);
    await vi.advanceTimersByTimeAsync(150);
    expect(reload.mock.calls).toEqual([[1]]);
    states[1] = idle;
    warm.enter(2);
    await vi.advanceTimersByTimeAsync(150);
    expect(reload.mock.calls).toEqual([[1], [2]]);
    vi.useRealTimers();
  });
});

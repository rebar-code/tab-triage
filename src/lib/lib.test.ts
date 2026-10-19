import { describe, expect, it } from 'vitest';
import { formatAge, groupTabs } from './group';
import { toItems, learnedSupabaseNames, type RawTab } from './items';
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

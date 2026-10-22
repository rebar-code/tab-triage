import { isProtected } from './rules';
import type { QuickFilter, TabItem, TextOp } from './types';
import { groupKey } from './url';

const DAY = 24 * 3_600_000;

export const TEXT_OPS: { op: TextOp; label: string }[] = [
  { op: 'exists', label: 'exists' },
  { op: 'missing', label: 'is missing' },
  { op: 'is', label: 'is' },
  { op: 'isNot', label: 'is not' },
  { op: 'contains', label: 'contains' },
  { op: 'notContains', label: "doesn't contain" },
  { op: 'startsWith', label: 'starts with' },
  { op: 'regex', label: 'matches regex' },
];

/** Ops that only look at whether the element is there. */
export const NO_TEXT: TextOp[] = ['exists', 'missing'];

export function newFilter(patch: Partial<QuickFilter> = {}): QuickFilter {
  return {
    id: crypto.randomUUID(),
    name: 'New filter',
    domain: '',
    urlContains: '',
    titleContains: '',
    idleDays: 0,
    selector: '',
    textOp: 'exists',
    text: '',
    pinned: false,
    ...patch,
  };
}

export const DEFAULT_FILTERS: QuickFilter[] = [
  newFilter({ id: 'not-viewed-2d', name: 'Not viewed 2d', idleDays: 2 }),
];

/** True when the filter also checks the live page. */
export function needsPage(filter: QuickFilter): boolean {
  return filter.selector !== '';
}

/** Every condition except the page element. Never matches protected or active tabs. */
export function matchesStatic(tab: TabItem, filter: QuickFilter, now: number): boolean {
  if (isProtected(tab) || tab.active) return false;
  if (filter.domain && tab.domain !== filter.domain) return false;
  if (filter.urlContains && !tab.url.toLowerCase().includes(filter.urlContains.toLowerCase()))
    return false;
  if (filter.titleContains && !tab.title.toLowerCase().includes(filter.titleContains.toLowerCase()))
    return false;
  if (filter.idleDays > 0 && now - tab.lastAccessed < filter.idleDays * DAY) return false;
  return true;
}

/** Compares the element's text with the filter. `value` is null when the element is missing. */
export function textMatches(value: string | null, op: TextOp, text: string): boolean {
  if (op === 'missing') return value === null;
  if (value === null) return false;
  const a = value.trim().toLowerCase();
  const b = text.trim().toLowerCase();
  switch (op) {
    case 'exists':
      return true;
    case 'is':
      return a === b;
    case 'isNot':
      return a !== b;
    case 'contains':
      return a.includes(b);
    case 'notContains':
      return !a.includes(b);
    case 'startsWith':
      return a.startsWith(b);
    case 'regex':
      try {
        return new RegExp(text, 'i').test(value);
      } catch {
        return false;
      }
  }
}

/** Root domain from what the user typed: `https://app.linear.app/x` → `linear.app`. */
export function normalizeSite(input: string): string {
  const s = input.trim().toLowerCase();
  if (!s) return '';
  const key = groupKey(s.includes('://') ? s : `https://${s}`);
  return key === 'other' || key.endsWith(':') || key.endsWith('//') ? '' : key;
}

/** Host permissions to ask for: the site and its subdomains. */
export function siteOrigins(domain: string): string[] {
  return domain ? [`https://*.${domain}/*`] : ['https://*/*'];
}

/** Origins that show the extension can read the site. `github.com` is granted without subdomains. */
export function accessOrigins(domain: string): string[] {
  return domain ? [`https://${domain}/*`] : ['https://*/*'];
}

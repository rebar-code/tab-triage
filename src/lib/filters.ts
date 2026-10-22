import { getDomain } from 'tldts';
import { isProtected } from './rules';
import type { QuickFilter, TabItem, TextOp } from './types';
import { isWebUrl } from './url';

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

/** Every condition except the page element. Never matches pinned or audible tabs. */
export function matchesStatic(tab: TabItem, filter: QuickFilter, now: number): boolean {
  // The tab you are on counts: a quick close is a deliberate click. Auto-close rules skip it.
  if (isProtected(tab)) return false;
  if (filter.domain && !siteMatches(tab.url, filter.domain)) return false;
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

/** Site is a regex on the host name, without case. `linear.app` also matches `app.linear.app`. */
export function siteMatches(url: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface Suggestion {
  label: string;
  value: string;
}

export interface PageSuggestions {
  site: Suggestion[];
  url: Suggestion[];
  title: Suggestion[];
}

/** One-click values from the page the user is on. Site values are exact regexes. */
export function pageSuggestions(url: string, title: string): PageSuggestions {
  if (!isWebUrl(url)) return { site: [], url: [], title: [] };
  const u = new URL(url);
  const root = getDomain(u.hostname) ?? u.hostname;
  const site = [{ label: u.hostname, value: `^${escapeRegex(u.hostname)}$` }];
  if (root !== u.hostname) site.push({ label: `*.${root}`, value: `(^|\\.)${escapeRegex(root)}$` });
  return {
    site,
    url: u.pathname.length > 1 ? [{ label: u.pathname, value: u.pathname }] : [],
    title: title ? [{ label: title, value: title }] : [],
  };
}

/** Host permissions for the open tabs the filter's site matches; every site when it has none. */
export function siteOrigins(filter: QuickFilter, tabs: TabItem[]): string[] {
  if (!filter.domain) return ['https://*/*'];
  const origins = tabs
    .filter((t) => isWebUrl(t.url) && siteMatches(t.url, filter.domain))
    .map((t) => `${new URL(t.url).origin}/*`);
  // No open tab to learn hosts from: a plain host such as `^linear\.app$` still names one.
  const plain = /^\^?[a-z0-9.\\-]+\$?$/i.test(filter.domain);
  if (origins.length === 0 && plain) return [`https://${filter.domain.replace(/[\^$\\]/g, '')}/*`];
  return [...new Set(origins)];
}

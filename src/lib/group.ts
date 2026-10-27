import type { TabItem } from './types';

export type GroupMode = 'domain' | 'recent' | 'opened';

export interface TabGroup {
  key: string;
  label: string;
  tabs: TabItem[];
}

const DAY = 86_400_000;

export function groupTabs(items: TabItem[], mode: GroupMode, now: number): TabGroup[] {
  if (mode === 'opened') return byOpened(items);
  return mode === 'domain' ? byDomain(items) : byRecent(items, now);
}

/** `seen`, then the keys of `groups` it lacks, in their order. Known keys never move. */
export function keepOrder(groups: TabGroup[], seen: readonly string[]): string[] {
  const known = new Set(seen);
  return [...seen, ...groups.map((g) => g.key).filter((k) => !known.has(k))];
}

/** `groups` sorted by their place in `order`; keys not in it go last. */
export function inOrder(groups: TabGroup[], order: readonly string[]): TabGroup[] {
  const rank = new Map(order.map((k, i) => [k, i]));
  const at = (g: TabGroup): number => rank.get(g.key) ?? order.length;
  return [...groups].sort((a, b) => at(a) - at(b));
}

/** Every tab in one list, oldest opened first. */
function byOpened(items: TabItem[]): TabGroup[] {
  if (items.length === 0) return [];
  const tabs = [...items].sort((a, b) => a.openedAt - b.openedAt || a.id - b.id);
  return [{ key: 'opened', label: 'All tabs', tabs }];
}

/** `account` for `account.rebar.is` under `rebar.is`; empty for the root itself. */
function subdomain(host: string, domain: string): string {
  return host === domain ? '' : host.slice(0, -domain.length - 1);
}

/** One group per host. Roots sort biggest first; under a root, the root itself, then subdomains A to Z. */
function byDomain(items: TabItem[]): TabGroup[] {
  const groups = new Map<string, TabItem[]>();
  const rootSize = new Map<string, number>();
  for (const item of items) {
    const list = groups.get(item.host);
    if (list) list.push(item);
    else groups.set(item.host, [item]);
    rootSize.set(item.domain, (rootSize.get(item.domain) ?? 0) + 1);
  }
  return [...groups]
    .map(([key, tabs]) => ({
      key,
      label: key,
      domain: tabs[0]?.domain ?? key,
      // Project label first so each Supabase / Vercel project sits together, then oldest first.
      tabs: tabs.sort(
        (a, b) => (a.label ?? '').localeCompare(b.label ?? '') || a.openedAt - b.openedAt,
      ),
    }))
    .sort(
      (a, b) =>
        (rootSize.get(b.domain) ?? 0) - (rootSize.get(a.domain) ?? 0) ||
        a.domain.localeCompare(b.domain) ||
        subdomain(a.key, a.domain).localeCompare(subdomain(b.key, b.domain)),
    )
    .map(({ key, label, tabs }) => ({ key, label, tabs }));
}

const BUCKETS = ['Today', 'Yesterday', 'This week', 'This month', 'Older'] as const;

function bucketOf(lastAccessed: number, now: number): (typeof BUCKETS)[number] {
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  if (lastAccessed >= midnight) return 'Today';
  if (lastAccessed >= midnight - DAY) return 'Yesterday';
  if (lastAccessed >= midnight - 6 * DAY) return 'This week';
  if (lastAccessed >= midnight - 29 * DAY) return 'This month';
  return 'Older';
}

function byRecent(items: TabItem[], now: number): TabGroup[] {
  const buckets = new Map<string, TabItem[]>(BUCKETS.map((b) => [b, []]));
  for (const item of items) buckets.get(bucketOf(item.lastAccessed, now))?.push(item);
  return [...buckets]
    .filter(([, tabs]) => tabs.length > 0)
    .map(([key, tabs]) => ({
      key,
      label: key,
      tabs: tabs.sort((a, b) => b.lastAccessed - a.lastAccessed),
    }));
}

export function matchesQuery(item: TabItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    item.url.toLowerCase().includes(q) ||
    (item.label?.toLowerCase().includes(q) ?? false)
  );
}

export function formatAge(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d}d`;
  if (d < 60) return `${Math.round(d / 7)}w`;
  return `${Math.round(d / 30)}mo`;
}

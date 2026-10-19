import type { TabItem } from './types';

export type GroupMode = 'domain' | 'recent';

export interface TabGroup {
  key: string;
  label: string;
  tabs: TabItem[];
}

const DAY = 86_400_000;

export function groupTabs(items: TabItem[], mode: GroupMode, now: number): TabGroup[] {
  return mode === 'domain' ? byDomain(items) : byRecent(items, now);
}

function byDomain(items: TabItem[]): TabGroup[] {
  const groups = new Map<string, TabItem[]>();
  for (const item of items) {
    const list = groups.get(item.domain);
    if (list) list.push(item);
    else groups.set(item.domain, [item]);
  }
  return [...groups]
    .map(([key, tabs]) => ({
      key,
      label: key,
      // Project label first so each Supabase / Vercel project sits together, then oldest first.
      tabs: tabs.sort(
        (a, b) => (a.label ?? '').localeCompare(b.label ?? '') || a.openedAt - b.openedAt,
      ),
    }))
    .sort((a, b) => b.tabs.length - a.tabs.length || a.key.localeCompare(b.key));
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

import { parseGithubUrl } from './sites/github';
import { parseSupabaseRef, projectFromTitle } from './sites/supabase';
import { vercelProject } from './sites/vercel';
import type { Snapshot } from './storage';
import type { TabItem } from './types';
import { groupHost, groupKey, normalizeUrl } from './url';

/** The fields of chrome.tabs.Tab this module reads. */
export type RawTab = Pick<
  chrome.tabs.Tab,
  'id' | 'windowId' | 'index' | 'url' | 'title' | 'pinned' | 'audible' | 'active' | 'discarded'
> & { lastAccessed?: number };

export function toItems(tabs: RawTab[], snap: Snapshot, now: number): TabItem[] {
  const items: TabItem[] = [];
  for (const t of tabs) {
    if (t.id === undefined) continue;
    const url = t.url ?? '';
    const title = t.title || url;
    const lastAccessed = t.lastAccessed ?? now;
    const item: TabItem = {
      id: t.id,
      windowId: t.windowId,
      index: t.index,
      url,
      title,
      pinned: t.pinned,
      audible: t.audible ?? false,
      active: t.active,
      discarded: t.discarded,
      lastAccessed,
      openedAt: snap.opened[normalizeUrl(url)] ?? lastAccessed,
      domain: groupKey(url),
      host: groupHost(url),
      duplicate: false,
    };
    const gh = parseGithubUrl(url);
    if (gh) item.github = snap.github[gh.key];
    const ref = parseSupabaseRef(url);
    if (ref) {
      item.supabaseRef = ref;
      item.label = snap.supabase[ref]?.name ?? projectFromTitle(title) ?? ref;
    }
    const vercel = vercelProject(url);
    if (vercel) item.label = vercel;
    items.push(item);
  }
  markDuplicates(items);
  return items;
}

/** Flags every copy of a URL except the one to keep: the active tab, else the latest viewed. */
export function markDuplicates(items: TabItem[]): void {
  const byUrl = new Map<string, TabItem[]>();
  for (const item of items) {
    if (!item.url) continue;
    const key = normalizeUrl(item.url);
    const list = byUrl.get(key);
    if (list) list.push(item);
    else byUrl.set(key, [item]);
  }
  for (const list of byUrl.values()) {
    if (list.length < 2) continue;
    const keep = list.reduce((best, t) => {
      if (t.active !== best.active) return t.active ? t : best;
      return t.lastAccessed > best.lastAccessed ? t : best;
    });
    for (const t of list) t.duplicate = t !== keep;
  }
}

/** Project names learned from Supabase tab titles that storage does not have yet. */
export function learnedSupabaseNames(items: TabItem[], snap: Snapshot): Map<string, string> {
  const learned = new Map<string, string>();
  for (const item of items) {
    if (!item.supabaseRef) continue;
    const name = projectFromTitle(item.title);
    const stored = snap.supabase[item.supabaseRef];
    if (name && !stored?.manual && stored?.name !== name) learned.set(item.supabaseRef, name);
  }
  return learned;
}

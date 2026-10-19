import { CLOSED, SAVED } from './storage';
import type { ClosedEntry, SavedEntry, TabItem } from './types';

const CLOSED_LIMIT = 500;

type Closable = Pick<TabItem, 'id' | 'url' | 'title' | 'windowId' | 'index'>;

async function readList<T>(key: string): Promise<T[]> {
  return ((await chrome.storage.local.get(key))[key] as T[] | undefined) ?? [];
}

/** Closes tabs and records them as one undo batch. */
export async function closeTabs(
  tabs: Closable[],
  reason: ClosedEntry['reason'] = 'manual',
): Promise<void> {
  if (tabs.length === 0) return;
  const batch = crypto.randomUUID();
  const closedAt = Date.now();
  const entries: ClosedEntry[] = tabs.map((t) => ({
    url: t.url,
    title: t.title,
    windowId: t.windowId,
    index: t.index,
    closedAt,
    batch,
    reason,
  }));
  const log = await readList<ClosedEntry>(CLOSED);
  await chrome.storage.local.set({ [CLOSED]: [...log, ...entries].slice(-CLOSED_LIMIT) });
  await chrome.tabs.remove(tabs.map((t) => t.id));
}

async function openAt(entry: Pick<ClosedEntry, 'url' | 'windowId' | 'index'>): Promise<void> {
  const windowId = await chrome.windows
    .get(entry.windowId)
    .then((w) => w.id)
    .catch(() => undefined);
  await chrome.tabs.create({
    url: entry.url,
    windowId,
    index: windowId === undefined ? undefined : entry.index,
    active: false,
  });
}

/** Reopens the most recent close batch. Returns how many tabs came back. */
export async function undoLastClose(): Promise<number> {
  const log = await readList<ClosedEntry>(CLOSED);
  const last = log.at(-1);
  if (!last) return 0;
  const batch = log.filter((e) => e.batch === last.batch).sort((a, b) => a.index - b.index);
  await chrome.storage.local.set({ [CLOSED]: log.filter((e) => e.batch !== last.batch) });
  for (const entry of batch) await openAt(entry);
  return batch.length;
}

export async function reopenClosed(entry: ClosedEntry): Promise<void> {
  const log = await readList<ClosedEntry>(CLOSED);
  await chrome.storage.local.set({
    [CLOSED]: log.filter((e) => !(e.batch === entry.batch && e.url === entry.url)),
  });
  await openAt(entry);
}

export async function clearClosed(): Promise<void> {
  await chrome.storage.local.set({ [CLOSED]: [] });
}

/** Adds tabs to the saved list, then closes them. */
export async function saveTabs(tabs: Closable[]): Promise<void> {
  if (tabs.length === 0) return;
  const saved = await readList<SavedEntry>(SAVED);
  const known = new Set(saved.map((s) => s.url));
  const savedAt = Date.now();
  const added = tabs
    .filter((t) => !known.has(t.url))
    .map((t) => ({ url: t.url, title: t.title, savedAt }));
  await chrome.storage.local.set({ [SAVED]: [...saved, ...added] });
  await chrome.tabs.remove(tabs.map((t) => t.id));
}

export async function removeSaved(urls: string[]): Promise<void> {
  const drop = new Set(urls);
  const saved = await readList<SavedEntry>(SAVED);
  await chrome.storage.local.set({ [SAVED]: saved.filter((s) => !drop.has(s.url)) });
}

export async function openSaved(entry: SavedEntry): Promise<void> {
  await chrome.tabs.create({ url: entry.url, active: false });
  await removeSaved([entry.url]);
}

export async function focusTab(tab: Pick<TabItem, 'id' | 'windowId'>): Promise<void> {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

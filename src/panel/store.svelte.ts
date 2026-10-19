import { learnedSupabaseNames, toItems, type RawTab } from '../lib/items';
import { emptySnapshot, loadSnapshot, writeSupabaseName, type Snapshot } from '../lib/storage';
import type { TabItem } from '../lib/types';

const ownPages = chrome.runtime.getURL('');

/** Live view of every tab in every window, plus what the extension has stored about them. */
class PanelStore {
  tabs = $state.raw<RawTab[]>([]);
  snap = $state.raw<Snapshot>(emptySnapshot());
  now = $state(Date.now());

  items: TabItem[] = $derived(
    toItems(
      this.tabs.filter((t) => !t.url?.startsWith(ownPages)),
      this.snap,
      this.now,
    ),
  );

  /** 1-based window numbers, in Chrome's window order. Empty when there is one window. */
  windowNumbers: Map<number, number> = $derived.by(() => {
    const ids = [...new Set(this.tabs.map((t) => t.windowId))];
    return ids.length > 1 ? new Map(ids.map((id, i) => [id, i + 1])) : new Map();
  });

  #tabsTimer: ReturnType<typeof setTimeout> | undefined;
  #snapTimer: ReturnType<typeof setTimeout> | undefined;

  async start(): Promise<void> {
    await Promise.all([this.#loadTabs(), this.#loadSnap()]);
    const onTabs = (): void => {
      clearTimeout(this.#tabsTimer);
      this.#tabsTimer = setTimeout(() => void this.#loadTabs(), 120);
    };
    chrome.tabs.onCreated.addListener(onTabs);
    chrome.tabs.onRemoved.addListener(onTabs);
    chrome.tabs.onUpdated.addListener(onTabs);
    chrome.tabs.onMoved.addListener(onTabs);
    chrome.tabs.onActivated.addListener(onTabs);
    chrome.tabs.onAttached.addListener(onTabs);
    chrome.tabs.onDetached.addListener(onTabs);
    chrome.tabs.onReplaced.addListener(onTabs);
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area !== 'local') return;
      clearTimeout(this.#snapTimer);
      this.#snapTimer = setTimeout(() => void this.#loadSnap(), 120);
    });
    setInterval(() => (this.now = Date.now()), 30_000);
    chrome.runtime.sendMessage({ type: 'refresh-github' }).catch(() => {});
  }

  async #loadTabs(): Promise<void> {
    this.tabs = await chrome.tabs.query({});
    this.now = Date.now();
    for (const [ref, name] of learnedSupabaseNames(this.items, this.snap))
      await writeSupabaseName(ref, { name, manual: false });
  }

  async #loadSnap(): Promise<void> {
    this.snap = await loadSnapshot();
  }
}

export const store = new PanelStore();

import { accessOrigins, matchesStatic, needsPage } from '../lib/filters';
import { learnedSupabaseNames, toItems, type RawTab } from '../lib/items';
import { pageMatchIds } from '../lib/page-check';
import { emptySnapshot, loadSnapshot, writeSupabaseName, type Snapshot } from '../lib/storage';
import type { TabItem } from '../lib/types';

const ownPages = chrome.runtime.getURL('');

/** Live view of every tab in every window, plus what the extension has stored about them. */
class PanelStore {
  tabs = $state.raw<RawTab[]>([]);
  snap = $state.raw<Snapshot>(emptySnapshot());
  now = $state(Date.now());
  /** Key that opens the panel, as Chrome shows it; '' when none is set. */
  shortcut = $state('');
  /** Tab ids whose page element matches, per filter id. */
  pageMatches = $state.raw(new Map<string, Set<number>>());
  /** Ids of element filters whose site the extension cannot read. */
  noAccess = $state.raw(new Set<string>());

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

  /** Tabs each filter would close now, by filter id. */
  filterTabs: Map<string, TabItem[]> = $derived(
    new Map(
      this.snap.filters.map((f) => [
        f.id,
        this.items.filter(
          (t) =>
            matchesStatic(t, f, this.now) &&
            (!needsPage(f) || (this.pageMatches.get(f.id)?.has(t.id) ?? false)),
        ),
      ]),
    ),
  );

  #tabsTimer: ReturnType<typeof setTimeout> | undefined;
  #snapTimer: ReturnType<typeof setTimeout> | undefined;
  #pageTimer: ReturnType<typeof setTimeout> | undefined;
  #pageRun = 0;

  async start(): Promise<void> {
    await Promise.all([this.#loadTabs(), this.#loadSnap(), this.#loadShortcut()]);
    void this.#checkPages();
    // The shortcut is changed on chrome://extensions/shortcuts; pick it up on return.
    window.addEventListener('focus', () => void this.#loadShortcut());
    const onTabs = (): void => {
      clearTimeout(this.#tabsTimer);
      this.#tabsTimer = setTimeout(() => void this.#loadTabs(), 120);
    };
    chrome.tabs.onCreated.addListener(onTabs);
    chrome.tabs.onRemoved.addListener(onTabs);
    chrome.tabs.onUpdated.addListener(onTabs);
    chrome.tabs.onUpdated.addListener((_id, change) => {
      if (change.status === 'complete') this.schedulePageCheck();
    });
    chrome.permissions.onAdded.addListener(() => this.schedulePageCheck());
    chrome.permissions.onRemoved.addListener(() => this.schedulePageCheck());
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
    const before = JSON.stringify(this.snap.filters);
    this.snap = await loadSnapshot();
    if (JSON.stringify(this.snap.filters) !== before) this.schedulePageCheck();
  }

  async #loadShortcut(): Promise<void> {
    const commands = await chrome.commands.getAll();
    this.shortcut = commands.find((c) => c.name === '_execute_action')?.shortcut ?? '';
  }

  schedulePageCheck(): void {
    clearTimeout(this.#pageTimer);
    this.#pageTimer = setTimeout(() => void this.#checkPages(), 300);
  }

  async #checkPages(): Promise<void> {
    const run = ++this.#pageRun;
    const checks = await Promise.all(
      this.snap.filters.filter(needsPage).map(async (f) => {
        const access = await chrome.permissions.contains({ origins: accessOrigins(f.domain) });
        const tabs = this.items.filter((t) => matchesStatic(t, f, this.now));
        return { id: f.id, access, ids: access ? await pageMatchIds(f, tabs) : null };
      }),
    );
    // A newer check started while this one waited on the tabs.
    if (run !== this.#pageRun) return;
    this.pageMatches = new Map(checks.flatMap((c) => (c.ids ? [[c.id, c.ids] as const] : [])));
    this.noAccess = new Set(checks.filter((c) => !c.access).map((c) => c.id));
  }
}

export const store = new PanelStore();

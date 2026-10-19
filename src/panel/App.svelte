<script lang="ts">
  import {
    BookmarkPlus,
    ChevronRight,
    Clock,
    Copy,
    GitMerge,
    Globe,
    Search,
    Settings,
    Trash,
    Undo2,
    X,
  } from '@lucide/svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { closeTabs, focusTab, saveTabs, undoLastClose } from '../lib/actions';
  import { groupTabs, matchesQuery, type GroupMode, type TabGroup } from '../lib/group';
  import { isProtected } from '../lib/rules';
  import { rangeIds } from '../lib/selection';
  import { writeSupabaseName } from '../lib/storage';
  import type { TabItem } from '../lib/types';
  import { normalizeUrl } from '../lib/url';
  import PreviewCard from './components/PreviewCard.svelte';
  import ClosedView from './components/ClosedView.svelte';
  import SavedView from './components/SavedView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import TabRow from './components/TabRow.svelte';
  import { faviconUrl } from './favicon';
  import { store } from './store.svelte';

  type View = 'tabs' | 'saved' | 'closed' | 'settings';

  let view = $state<View>('tabs');
  let mode = $state<GroupMode>('domain');
  let query = $state('');
  let anchor = $state<number | null>(null);
  let toast = $state<{ text: string; undo: boolean } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let search: HTMLInputElement | undefined = $state();
  let hover = $state<{ id: number; top: number; bottom: number } | null>(null);
  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  const selected = new SvelteSet<number>();
  const collapsed = new SvelteSet<string>();

  const visible = $derived(store.items.filter((t) => matchesQuery(t, query)));
  const groups = $derived(groupTabs(visible, mode, store.now));
  const order = $derived(
    groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.tabs.map((t) => t.id))),
  );
  const selectedItems = $derived(store.items.filter((t) => selected.has(t.id)));
  const merged = $derived(
    store.items.filter(
      (t) => t.github?.kind === 'pr' && t.github.state === 'merged' && !isProtected(t),
    ),
  );
  const duplicates = $derived(store.items.filter((t) => t.duplicate && !isProtected(t)));
  const closable = (tabs: TabItem[]): TabItem[] => tabs.filter((t) => !isProtected(t));
  const hoverItem = $derived(hover && store.items.find((t) => t.id === hover?.id));

  // First card waits a beat so sweeping the mouse across the list stays quiet;
  // once a card is up, moving between rows switches it at once.
  function onHover(item: TabItem, row: HTMLElement | null): void {
    clearTimeout(hoverTimer);
    if (!row) {
      hoverTimer = setTimeout(() => (hover = null), 60);
      return;
    }
    const { top, bottom } = row.getBoundingClientRect();
    const next = { id: item.id, top, bottom };
    if (hover) hover = next;
    else hoverTimer = setTimeout(() => (hover = next), 120);
  }

  function hideHover(): void {
    clearTimeout(hoverTimer);
    hover = null;
  }

  function showToast(text: string, undo: boolean): void {
    clearTimeout(toastTimer);
    toast = { text, undo };
    toastTimer = setTimeout(() => (toast = null), 6000);
  }

  async function close(tabs: TabItem[]): Promise<void> {
    if (tabs.length === 0) return;
    for (const t of tabs) selected.delete(t.id);
    await closeTabs(tabs);
    showToast(`Closed ${tabs.length} ${tabs.length === 1 ? 'tab' : 'tabs'}`, true);
  }

  async function save(tabs: TabItem[]): Promise<void> {
    if (tabs.length === 0) return;
    selected.clear();
    await saveTabs(tabs);
    showToast(`Saved ${tabs.length} for later`, false);
  }

  async function undo(): Promise<void> {
    const n = await undoLastClose();
    showToast(n ? `Reopened ${n} ${n === 1 ? 'tab' : 'tabs'}` : 'Nothing to undo', false);
  }

  function toggle(item: TabItem, event: MouseEvent): void {
    if (event.shiftKey && anchor !== null) {
      const ids = rangeIds(order, anchor, item.id);
      const byId = new Map(store.items.map((t) => [t.id, t]));
      for (const id of ids) {
        const t = byId.get(id);
        if (t && !isProtected(t)) selected.add(id);
      }
    } else if (selected.has(item.id)) {
      selected.delete(item.id);
    } else {
      selected.add(item.id);
    }
    anchor = item.id;
  }

  function toggleGroup(group: TabGroup): void {
    const tabs = closable(group.tabs);
    const all = tabs.length > 0 && tabs.every((t) => selected.has(t.id));
    for (const t of tabs) {
      if (all) selected.delete(t.id);
      else selected.add(t.id);
    }
  }

  function toggleCollapse(key: string): void {
    if (collapsed.has(key)) collapsed.delete(key);
    else collapsed.add(key);
  }

  function rename(item: TabItem, name: string): void {
    if (!item.supabaseRef) return;
    void writeSupabaseName(item.supabaseRef, name ? { name, manual: true } : null);
  }

  function onKeydown(event: KeyboardEvent): void {
    const typing = event.target instanceof HTMLInputElement;
    if (event.key === 'Escape') {
      if (typing && event.target === search && query) query = '';
      else selected.clear();
    } else if (typing) {
      return;
    } else if (event.key === 'z' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void undo();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItems.length) {
      void close(closable(selectedItems));
    } else if (event.key === '/') {
      event.preventDefault();
      view = 'tabs';
      search?.focus();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} onmousedown={hideHover} />

<div class="shell">
  {#if view === 'tabs'}
    <header>
      <div class="bar">
        <label class="search">
          <Search size={14} />
          <input
            bind:this={search}
            bind:value={query}
            type="search"
            placeholder="Search {store.items.length} tabs"
            aria-label="Search tabs"
          />
        </label>
        <div class="modes" role="group" aria-label="Group by">
          <button
            class="icon-button"
            class:on={mode === 'domain'}
            title="By domain"
            aria-pressed={mode === 'domain'}
            onclick={() => (mode = 'domain')}><Globe size={15} /></button
          >
          <button
            class="icon-button"
            class:on={mode === 'recent'}
            title="By last viewed"
            aria-pressed={mode === 'recent'}
            onclick={() => (mode = 'recent')}><Clock size={15} /></button
          >
        </div>
      </div>
      {#if selectedItems.length}
        <div class="bar actions selection">
          <span class="count">{selectedItems.length} selected</span>
          <button class="chip-button" onclick={() => save(closable(selectedItems))}>
            <BookmarkPlus size={13} /> Save
          </button>
          <button class="chip-button danger" onclick={() => close(closable(selectedItems))}>
            <Trash size={13} /> Close
          </button>
          <button class="icon-button" title="Clear selection" onclick={() => selected.clear()}>
            <X size={14} />
          </button>
        </div>
      {:else if merged.length || duplicates.length}
        <div class="bar actions">
          {#if merged.length}
            <button class="chip-button merged" onclick={() => close(merged)}>
              <GitMerge size={13} /> Close merged PRs ({merged.length})
            </button>
          {/if}
          {#if duplicates.length}
            <button class="chip-button" onclick={() => close(duplicates)}>
              <Copy size={13} /> Close duplicates ({duplicates.length})
            </button>
          {/if}
        </div>
      {/if}
    </header>
  {/if}

  <main onscroll={hideHover}>
    {#if view === 'tabs'}
      {#each groups as group (group.key)}
        {@const tabs = closable(group.tabs)}
        {@const allSelected = tabs.length > 0 && tabs.every((t) => selected.has(t.id))}
        <section data-testid="group" data-group={group.key}>
          <div class="group-head" class:selecting={selectedItems.length > 0}>
            <span class="check">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={tabs.length === 0}
                aria-label="Select group"
                onclick={(e) => {
                  e.preventDefault();
                  toggleGroup(group);
                }}
              />
            </span>
            <button class="group-title" onclick={() => toggleCollapse(group.key)}>
              <span class="chevron" class:open={!collapsed.has(group.key)}>
                <ChevronRight size={13} />
              </span>
              {#if mode === 'domain' && group.tabs[0]}
                <img src={faviconUrl(group.tabs[0].url)} alt="" width="14" height="14" />
              {/if}
              <span class="name">{group.label}</span>
              <span class="n">{group.tabs.length}</span>
            </button>
            {#if tabs.length}
              <button
                class="icon-button danger close-group"
                title="Close all {tabs.length}"
                onclick={() => close(tabs)}><Trash size={14} /></button
              >
            {/if}
          </div>
          {#if !collapsed.has(group.key)}
            <div role="list">
              {#each group.tabs as item (item.id)}
                <TabRow
                  {item}
                  selected={selected.has(item.id)}
                  selecting={selectedItems.length > 0}
                  now={store.now}
                  windowNumber={store.windowNumbers.get(item.windowId)}
                  onToggle={(e) => toggle(item, e)}
                  onOpen={() => focusTab(item)}
                  onClose={() => close([item])}
                  onRename={(name) => rename(item, name)}
                  onHover={(row) => onHover(item, row)}
                />
              {/each}
            </div>
          {/if}
        </section>
      {:else}
        <p class="empty">No tabs</p>
      {/each}
    {:else if view === 'saved'}
      <SavedView saved={store.snap.saved} now={store.now} />
    {:else if view === 'closed'}
      <ClosedView closed={store.snap.closed} now={store.now} />
    {:else}
      <SettingsView rules={store.snap.rules} />
    {/if}
  </main>

  {#if view === 'tabs' && hover && hoverItem}
    <PreviewCard
      item={hoverItem}
      image={store.previews.get(normalizeUrl(hoverItem.url))}
      row={hover}
      now={store.now}
    />
  {/if}

  {#if toast}
    <div class="toast" role="status">
      <span>{toast.text}</span>
      {#if toast.undo}
        <button onclick={undo}>Undo</button>
      {/if}
    </div>
  {/if}

  <nav>
    <button class:on={view === 'tabs'} onclick={() => (view = 'tabs')}>
      Tabs <span class="n">{store.items.length}</span>
    </button>
    <button class:on={view === 'saved'} onclick={() => (view = 'saved')}>
      Saved <span class="n">{store.snap.saved.length}</span>
    </button>
    <button class:on={view === 'closed'} onclick={() => (view = 'closed')}>
      <Undo2 size={13} /> Closed
    </button>
    <button
      class="icon-button"
      class:on={view === 'settings'}
      title="Auto-close rules"
      onclick={() => (view = 'settings')}><Settings size={15} /></button
    >
  </nav>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  header {
    border-bottom: 1px solid var(--border);
    padding: 8px;
    display: grid;
    gap: 6px;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .actions {
    flex-wrap: wrap;
    font-size: 12px;
  }

  .selection .count {
    font-weight: 600;
    margin-right: auto;
  }

  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg-muted);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: none;
  }

  .modes {
    display: flex;
    gap: 2px;
  }

  .icon-button.on {
    background: var(--bg-selected);
    color: var(--accent);
  }

  .chip-button.merged {
    color: var(--merged);
    border-color: var(--merged);
  }

  .chip-button.danger {
    color: var(--danger);
  }

  main {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 8px;
  }

  .group-head {
    position: sticky;
    top: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) 22px;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 6px 0 10px;
    background: var(--bg-soft);
    border-bottom: 1px solid var(--border);
  }

  .group-head .check {
    display: grid;
    place-items: center;
  }

  .group-head .check input {
    margin: 0;
    opacity: 0;
  }

  .group-head:hover .check input,
  .group-head.selecting .check input {
    opacity: 1;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-weight: 600;
  }

  .group-title .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    display: grid;
    color: var(--fg-muted);
    transition: transform 0.1s;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .n {
    color: var(--fg-muted);
    font-weight: 400;
    font-size: 11px;
  }

  .close-group {
    opacity: 0;
  }

  .group-head:hover .close-group {
    opacity: 1;
  }

  .empty {
    color: var(--fg-muted);
    text-align: center;
    padding: 24px;
  }

  .toast {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--fg);
    color: var(--bg);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
  }

  .toast button {
    font-weight: 600;
    color: inherit;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-top: 1px solid var(--border);
  }

  nav button:not(.icon-button) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
  }

  nav button.on:not(.icon-button) {
    background: var(--bg-selected);
    color: var(--accent);
  }

  nav .icon-button {
    margin-left: auto;
  }
</style>

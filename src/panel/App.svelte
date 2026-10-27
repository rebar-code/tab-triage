<script lang="ts">
  import {
    BookmarkPlus,
    ChevronDown,
    Clock,
    Copy,
    GitMerge,
    Globe,
    List,
    ListFilter,
    Search,
    Settings,
    Trash,
    Undo2,
    X,
  } from '@lucide/svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { closeTabs, focusTab, saveTabs, undoLastClose } from '../lib/actions';
  import { needsPage, newFilter } from '../lib/filters';
  import { pageMatchIds } from '../lib/page-check';
  import {
    groupTabs,
    inOrder,
    keepOrder,
    matchesQuery,
    type GroupMode,
    type TabGroup,
  } from '../lib/group';
  import { isProtected } from '../lib/rules';
  import { rangeIds } from '../lib/selection';
  import { writeSupabaseName } from '../lib/storage';
  import type { TabItem } from '../lib/types';
  import ClosedView from './components/ClosedView.svelte';
  import FilterChip from './components/FilterChip.svelte';
  import FilterList from './components/FilterList.svelte';
  import FilterMenu from './components/FilterMenu.svelte';
  import SavedView from './components/SavedView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import TabRow from './components/TabRow.svelte';
  import { faviconUrl } from './favicon';
  import type { FilterHover } from './hover';
  import { store } from './store.svelte';

  type View = 'tabs' | 'saved' | 'closed' | 'settings' | 'filters';

  let view = $state<View>('tabs');
  let mode = $state<GroupMode>('domain');
  // Kept across opens, so a new search can replace it in one keystroke.
  let query = $state(localStorage.getItem('query') ?? '');
  let anchor = $state<number | null>(null);
  let menuOpen = $state(false);
  let hover = $state<FilterHover | null>(null);
  /** Filter whose tabs are listed alone, with the ids it matched when shown. */
  let preview = $state<{ id: string; ids: Set<number> } | null>(null);
  let editId = $state<string | null>(null);
  // When the last close and the last search edit happened; Cmd-Z picks the later one.
  let closedAt = 0;
  let typedAt = 0;
  let toast = $state<{ text: string; undo: boolean } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let search: HTMLInputElement | undefined = $state();
  const selected = new SvelteSet<number>();
  const collapsed = new SvelteSet<string>();

  const filters = $derived(store.snap.filters);
  const counts = $derived(
    new Map([...store.filterTabs].map(([id, tabs]) => [id, tabs.length] as const)),
  );
  const pinned = $derived(filters.filter((f) => f.pinned && (counts.get(f.id) ?? 0) > 0));
  const hoverIds = $derived(
    hover ? new Set(store.filterTabs.get(hover.id)?.map((t) => t.id)) : null,
  );
  const previewName = $derived(filters.find((f) => f.id === preview?.id)?.name ?? '');
  const visible = $derived(
    store.items.filter((t) => (preview ? preview.ids.has(t.id) : matchesQuery(t, query))),
  );
  // Domain order as first shown, so closing tabs never moves a group. Reset on a mode change.
  let seen: string[] = [];
  const groups = $derived.by(() => {
    const shown = groupTabs(visible, mode, store.now);
    if (mode !== 'domain') return shown;
    seen = keepOrder(groupTabs(store.items, mode, store.now), seen);
    return inOrder(shown, seen);
  });
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

  function showToast(text: string, undo: boolean): void {
    clearTimeout(toastTimer);
    toast = { text, undo };
    toastTimer = setTimeout(() => (toast = null), 6000);
  }

  async function close(tabs: TabItem[]): Promise<void> {
    if (tabs.length === 0) return;
    closedAt = Date.now();
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

  function setMode(next: GroupMode): void {
    seen = [];
    mode = next;
  }

  function toggleCollapse(key: string): void {
    if (collapsed.has(key)) collapsed.delete(key);
    else collapsed.add(key);
  }

  function setQuery(value: string): void {
    query = value;
    typedAt = Date.now();
    localStorage.setItem('query', value);
  }

  /** Keys pressed here edit text. Checkboxes and buttons do not count. */
  function isTextField(target: EventTarget | null): boolean {
    if (target instanceof HTMLInputElement) return !['checkbox', 'radio'].includes(target.type);
    return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }

  function isUndoKey(event: KeyboardEvent): boolean {
    return event.key === 'z' && !event.shiftKey && (event.metaKey || event.ctrlKey);
  }

  /** Cmd-Z reopens the last close, unless the search text changed after it. */
  function wantsUndo(event: KeyboardEvent, typing: boolean): boolean {
    const searchIsStale = event.target === search && closedAt > typedAt;
    return isUndoKey(event) && (!typing || searchIsStale);
  }

  function selectAll(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  function toggleMenu(): void {
    if (menuOpen) {
      dismissMenu();
    } else {
      menuOpen = true;
      store.schedulePageCheck();
    }
  }

  function dismissMenu(): void {
    menuOpen = false;
    hover = null;
  }

  function showFilter(id: string): void {
    const tabs = store.filterTabs.get(id) ?? [];
    preview = { id, ids: new Set(tabs.map((t) => t.id)) };
    selected.clear();
    for (const t of tabs) selected.add(t.id);
    dismissMenu();
  }

  function endPreview(): void {
    preview = null;
    selected.clear();
  }

  async function closePreview(): Promise<void> {
    await close(closable(selectedItems));
    endPreview();
  }

  async function closeFilter(id: string): Promise<void> {
    dismissMenu();
    const filter = filters.find((f) => f.id === id);
    let tabs = store.filterTabs.get(id) ?? [];
    if (!filter) return;
    // The page may have changed since the last check.
    if (needsPage(filter)) {
      const ids = await pageMatchIds(filter, tabs);
      tabs = tabs.filter((t) => ids.has(t.id));
    }
    await close(tabs);
  }

  function editFilter(id: string): void {
    dismissMenu();
    editId = id;
    view = 'filters';
  }

  function pinFilter(id: string): void {
    store.setFilters(filters.map((f) => (f.id === id ? { ...f, pinned: !f.pinned } : f)));
  }

  function addFilter(): void {
    const filter = newFilter();
    store.setFilters([...filters, filter]);
    editFilter(filter.id);
  }

  function rename(item: TabItem, name: string): void {
    if (!item.supabaseRef) return;
    void writeSupabaseName(item.supabaseRef, name ? { name, manual: true } : null);
  }

  // One step per Escape, innermost first; each is driven by an e2e test.
  // fallow-ignore-next-line complexity
  function onEscape(typing: boolean, target: EventTarget | null): void {
    if (menuOpen) dismissMenu();
    else if (typing && target === search && query) setQuery('');
    else if (preview) endPreview();
    else if (view === 'filters' && !typing) view = 'tabs';
    else selected.clear();
  }

  function onKeydown(event: KeyboardEvent): void {
    const typing = isTextField(event.target);
    if (event.key === 'Escape') {
      onEscape(typing, event.target);
    } else if (wantsUndo(event, typing)) {
      event.preventDefault();
      void undo();
    } else if (typing) {
      return;
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedItems.length) {
      void close(closable(selectedItems));
    } else if (event.key === '/') {
      event.preventDefault();
      view = 'tabs';
      search?.focus();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet tabsHeader()}
  <header>
    <div class="bar">
      <button
        class="icon-button"
        class:on={menuOpen}
        title="Filters"
        aria-expanded={menuOpen}
        onclick={toggleMenu}><ListFilter size={15} /></button
      >
      <label class="search">
        <Search size={14} />
        <input
          bind:this={search}
          value={query}
          oninput={(e) => setQuery(e.currentTarget.value)}
          type="search"
          placeholder="Search {store.items.length} tabs"
          aria-label="Search tabs"
          {@attach selectAll}
        />
      </label>
      <div class="modes" role="group" aria-label="Group by">
        <button
          class="icon-button"
          class:on={mode === 'domain'}
          title="By domain"
          aria-pressed={mode === 'domain'}
          onclick={() => setMode('domain')}><Globe size={15} /></button
        >
        <button
          class="icon-button"
          class:on={mode === 'recent'}
          title="By last viewed"
          aria-pressed={mode === 'recent'}
          onclick={() => setMode('recent')}><Clock size={15} /></button
        >
        <button
          class="icon-button"
          class:on={mode === 'opened'}
          title="All tabs, oldest first"
          aria-pressed={mode === 'opened'}
          onclick={() => setMode('opened')}><List size={15} /></button
        >
      </div>
    </div>
    {#if menuOpen}
      <FilterMenu
        {filters}
        {counts}
        noAccess={store.noAccess}
        onShow={showFilter}
        onClose={(id) => void closeFilter(id)}
        onEdit={editFilter}
        onPin={pinFilter}
        onAdd={addFilter}
        onHover={(h) => (hover = h)}
        onDismiss={dismissMenu}
      />
    {/if}
    {#if preview}
      <div class="bar actions selection">
        <span class="count">{previewName}</span>
        <button
          class="chip-button solid"
          disabled={selectedItems.length === 0}
          onclick={() => void closePreview()}
        >
          <Trash size={13} /> Close {selectedItems.length}
        </button>
        <button class="icon-button" title="Cancel" onclick={endPreview}>
          <X size={14} />
        </button>
      </div>
    {:else if selectedItems.length}
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
    {:else if merged.length || duplicates.length || pinned.length}
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
        {#each pinned as filter (filter.id)}
          <FilterChip
            {filter}
            count={counts.get(filter.id) ?? 0}
            onShow={() => showFilter(filter.id)}
            onClose={() => void closeFilter(filter.id)}
            onEdit={() => editFilter(filter.id)}
            onHover={(h) => (hover = h)}
          />
        {/each}
      </div>
    {/if}
  </header>
{/snippet}

<div class="shell">
  {#if view === 'tabs'}
    {@render tabsHeader()}
  {/if}

  <main>
    {#if view === 'tabs'}
      {#each groups as group (group.key)}
        {@const tabs = closable(group.tabs)}
        {@const allSelected = tabs.length > 0 && tabs.every((t) => selected.has(t.id))}
        <section data-testid="group" data-group={group.key}>
          {#if mode !== 'opened'}
            <div class="group-head" class:selecting={selectedItems.length > 0}>
              <span class="check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={tabs.length === 0}
                  aria-label="Select group"
                  onclick={(e) => {
                    toggleGroup(group);
                    e.currentTarget.checked = allSelected;
                  }}
                />
              </span>
              <button class="group-title" onclick={() => toggleCollapse(group.key)}>
                {#if mode === 'domain' && group.tabs[0]}
                  <img src={faviconUrl(group.tabs[0].url)} alt="" width="14" height="14" />
                {/if}
                <span class="name">{group.label}</span>
                <span class="n">{group.tabs.length}</span>
                <span class="chevron" class:collapsed={collapsed.has(group.key)}>
                  <ChevronDown size={13} />
                </span>
              </button>
              {#if tabs.length}
                <button
                  class="icon-button danger close-group"
                  title="Close all {tabs.length}"
                  onclick={() => close(tabs)}><Trash size={14} /></button
                >
              {/if}
            </div>
          {/if}
          {#if !collapsed.has(group.key)}
            {#each group.tabs as item (item.id)}
              <TabRow
                {item}
                selected={selected.has(item.id)}
                selecting={selectedItems.length > 0}
                now={store.now}
                windowNumber={store.windowNumbers.get(item.windowId)}
                highlight={hover && hoverIds?.has(item.id) ? hover.kind : null}
                onToggle={(e) => toggle(item, e)}
                onOpen={() => focusTab(item)}
                onClose={() => close([item])}
                onRename={(name) => rename(item, name)}
              />
            {/each}
          {/if}
        </section>
      {:else}
        <p class="empty">No tabs</p>
      {/each}
    {:else if view === 'saved'}
      <SavedView saved={store.snap.saved} now={store.now} />
    {:else if view === 'closed'}
      <ClosedView closed={store.snap.closed} now={store.now} />
    {:else if view === 'filters'}
      <div class="filters-view">
        <div class="view-head">
          <h2>Filters</h2>
          <button class="icon-button" title="Close" onclick={() => (view = 'tabs')}>
            <X size={14} />
          </button>
        </div>
        <FilterList {filters} focusId={editId} />
      </div>
    {:else}
      <SettingsView rules={store.snap.rules} {filters} shortcut={store.shortcut} />
    {/if}
  </main>

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
      title="Settings"
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
    position: relative;
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

  .chip-button.solid {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }

  .chip-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .filters-view {
    padding: 8px 12px;
    display: grid;
    gap: 6px;
  }

  .view-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .view-head h2 {
    margin: 4px 0;
    font-size: 13px;
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

  .chevron.collapsed {
    transform: rotate(-90deg);
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

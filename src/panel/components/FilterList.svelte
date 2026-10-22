<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import {
    escapeRegex,
    matchesStatic,
    needsPage,
    newFilter,
    pageSuggestions,
    siteMatches,
    siteOrigins,
  } from '../../lib/filters';
  import type { QuickFilter, TabItem } from '../../lib/types';
  import { isWebUrl } from '../../lib/url';
  import { pickInTab, stopPicking } from '../../lib/page-check';
  import { store } from '../store.svelte';
  import FilterEditor from './FilterEditor.svelte';

  let { filters, focusId = null }: { filters: QuickFilter[]; focusId?: string | null } = $props();

  let added = $state<string | null>(null);
  let picking = $state<{ filterId: string; tabId: number } | null>(null);

  const suggestions = $derived(
    store.current ? pageSuggestions(store.current.url, store.current.title) : null,
  );

  function save(next: QuickFilter[]): void {
    store.setFilters(next);
  }

  async function requestAccess(filter: QuickFilter): Promise<boolean> {
    const origins = siteOrigins(filter, store.items);
    if (origins.length === 0 || (await chrome.permissions.contains({ origins }))) return true;
    return chrome.permissions.request({ origins }).catch(() => false);
  }

  function change(filter: QuickFilter, patch: Partial<QuickFilter>): void {
    const next = { ...filter, ...patch };
    save(filters.map((f) => (f.id === filter.id ? next : f)));
    // Chrome only asks while the click or keystroke behind this change is fresh.
    if (needsPage(next) && ('selector' in patch || 'domain' in patch)) void requestAccess(next);
  }

  function add(): void {
    const filter = newFilter();
    save([...filters, filter]);
    added = filter.id;
  }

  /** Tab to pick in: the page you are on if the site fits, else one the filter already matches. */
  function pickTarget(filter: QuickFilter): TabItem | undefined {
    const tabs = store.items.filter(
      (t) =>
        isWebUrl(t.url) && !t.discarded && (!filter.domain || siteMatches(t.url, filter.domain)),
    );
    return (
      tabs.find((t) => t.id === store.current?.id) ??
      tabs.find((t) => matchesStatic(t, filter, store.now)) ??
      tabs[0]
    );
  }

  // Drives a live tab through chrome.scripting; covered by the e2e pick test.
  // fallow-ignore-next-line complexity
  async function pick(filter: QuickFilter): Promise<void> {
    const tab = pickTarget(filter);
    if (!tab) return;
    const domain = filter.domain || `^${escapeRegex(new URL(tab.url).hostname)}$`;
    if (!(await requestAccess({ ...filter, domain }))) return;
    picking = { filterId: filter.id, tabId: tab.id };
    const result = await pickInTab(tab);
    if (picking?.filterId === filter.id) picking = null;
    const current = filters.find((f) => f.id === filter.id);
    if (!result || !current) return;
    change(current, {
      domain,
      selector: result.selector,
      textOp: result.text ? 'is' : 'exists',
      text: result.text,
    });
  }

  function cancelPick(): void {
    if (picking) void stopPicking(picking.tabId);
    picking = null;
  }
</script>

<div class="filters">
  {#each filters as filter (filter.id)}
    <FilterEditor
      {filter}
      noAccess={store.noAccess.has(filter.id)}
      suggestions={filter.id === (added ?? focusId) ? suggestions : null}
      focused={filter.id === (added ?? focusId)}
      picking={picking?.filterId === filter.id}
      pickBlocked={pickTarget(filter) ? '' : `No open tab on ${filter.domain || 'a website'}`}
      onChange={(patch) => change(filter, patch)}
      onRemove={() => save(filters.filter((f) => f.id !== filter.id))}
      onPick={() => void pick(filter)}
      onCancelPick={cancelPick}
      onGrant={() => void requestAccess(filter)}
    />
  {/each}
  <button class="chip-button add" onclick={add}><Plus size={13} /> Filter</button>
</div>

<style>
  .filters {
    display: grid;
    gap: 6px;
  }

  .add {
    justify-self: start;
    font-size: 12px;
  }
</style>

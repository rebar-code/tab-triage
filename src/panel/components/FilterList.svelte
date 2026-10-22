<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import {
    accessOrigins,
    matchesStatic,
    needsPage,
    newFilter,
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

  function save(next: QuickFilter[]): void {
    store.setFilters(next);
  }

  async function requestAccess(domain: string): Promise<boolean> {
    if (await chrome.permissions.contains({ origins: accessOrigins(domain) })) return true;
    return chrome.permissions.request({ origins: siteOrigins(domain) }).catch(() => false);
  }

  function change(filter: QuickFilter, patch: Partial<QuickFilter>): void {
    const next = { ...filter, ...patch };
    save(filters.map((f) => (f.id === filter.id ? next : f)));
    // Chrome only asks while the click or keystroke behind this change is fresh.
    if (needsPage(next) && ('selector' in patch || 'domain' in patch))
      void requestAccess(next.domain);
  }

  function add(): void {
    const filter = newFilter();
    save([...filters, filter]);
    added = filter.id;
  }

  /** Tab to pick in: the active one on the site, else one the filter already matches. */
  function pickTarget(filter: QuickFilter): TabItem | undefined {
    const tabs = store.items.filter(
      (t) => isWebUrl(t.url) && !t.discarded && (!filter.domain || t.domain === filter.domain),
    );
    return (
      tabs.find((t) => t.active) ?? tabs.find((t) => matchesStatic(t, filter, store.now)) ?? tabs[0]
    );
  }

  // Drives a live tab through chrome.scripting; covered by the e2e pick test.
  // fallow-ignore-next-line complexity
  async function pick(filter: QuickFilter): Promise<void> {
    const tab = pickTarget(filter);
    if (!tab) return;
    const domain = filter.domain || tab.domain;
    if (!(await requestAccess(domain))) return;
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
      focused={filter.id === (added ?? focusId)}
      picking={picking?.filterId === filter.id}
      pickBlocked={pickTarget(filter) ? '' : `No open tab on ${filter.domain || 'a website'}`}
      onChange={(patch) => change(filter, patch)}
      onRemove={() => save(filters.filter((f) => f.id !== filter.id))}
      onPick={() => void pick(filter)}
      onCancelPick={cancelPick}
      onGrant={() => void requestAccess(filter.domain)}
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

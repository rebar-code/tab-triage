<script lang="ts">
  import { Plus, Trash } from '@lucide/svelte';
  import { writeRules } from '../../lib/storage';
  import type { DomainRule, QuickFilter, Rules } from '../../lib/types';
  import FilterList from './FilterList.svelte';

  let { rules, filters, shortcut }: { rules: Rules; filters: QuickFilter[]; shortcut: string } =
    $props();

  type AgeKey = 'mergedPr' | 'closedPr' | 'closedIssue';
  const ageRules: { key: AgeKey; label: string }[] = [
    { key: 'mergedPr', label: 'Merged PRs' },
    { key: 'closedPr', label: 'Closed PRs' },
    { key: 'closedIssue', label: 'Closed issues' },
  ];

  function update(patch: Partial<Rules>): void {
    void writeRules({ ...rules, ...patch });
  }

  function amount(event: Event): number {
    return Math.max(1, Number((event.currentTarget as HTMLInputElement).value) || 1);
  }

  function checked(event: Event): boolean {
    return (event.currentTarget as HTMLInputElement).checked;
  }

  // Page filters and the hover frame only reach sites the extension has access to.
  const ALL_SITES = { origins: ['https://*/*', 'http://*/*'] };
  let allSites = $state(false);
  void chrome.permissions.contains(ALL_SITES).then((granted) => (allSites = granted));

  async function allowAllSites(): Promise<void> {
    allSites = await chrome.permissions.request(ALL_SITES).catch(() => false);
  }

  function updateDomain(i: number, patch: Partial<DomainRule>): void {
    update({ domains: rules.domains.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  }
</script>

<div class="settings">
  <div class="rule" data-testid="shortcut">
    <span class="name label">Shortcut</span>
    {#if shortcut}
      <kbd>{shortcut}</kbd>
    {:else}
      <span class="unset">Not set</span>
    {/if}
    <button
      class="chip-button"
      onclick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
    >
      Change
    </button>
  </div>

  <div class="rule" data-testid="site-access">
    <span class="name label">Site access</span>
    {#if allSites}
      <span class="unset">All sites</span>
    {:else}
      <button class="chip-button" onclick={allowAllSites}>Allow all sites</button>
    {/if}
  </div>

  <h2>Filters</h2>
  <FilterList {filters} />

  <h2>Auto-close</h2>

  {#each ageRules as { key, label } (key)}
    <div class="rule">
      <input
        type="checkbox"
        aria-label={label}
        checked={rules[key].on}
        onchange={(e) => update({ [key]: { ...rules[key], on: checked(e) } })}
      />
      <span class="name">{label}</span>
      <input
        type="number"
        min="1"
        aria-label="{label} delay in hours"
        value={rules[key].hours}
        onchange={(e) => update({ [key]: { ...rules[key], hours: amount(e) } })}
      />
      <span class="unit">h</span>
    </div>
  {/each}

  <div class="rule">
    <input
      type="checkbox"
      aria-label="Not viewed"
      checked={rules.idle.on}
      onchange={(e) => update({ idle: { ...rules.idle, on: checked(e) } })}
    />
    <span class="name">Not viewed</span>
    <input
      type="number"
      min="1"
      aria-label="Not viewed for days"
      value={rules.idle.days}
      onchange={(e) => update({ idle: { ...rules.idle, days: amount(e) } })}
    />
    <span class="unit">d</span>
  </div>

  <h3>Domains not viewed</h3>
  {#each rules.domains as rule, i (i)}
    <div class="rule">
      <input
        type="checkbox"
        aria-label="{rule.domain} rule"
        checked={rule.on}
        onchange={(e) => updateDomain(i, { on: checked(e) })}
      />
      <input
        class="domain"
        placeholder="example.com"
        aria-label="Domain"
        value={rule.domain}
        onchange={(e) => updateDomain(i, { domain: e.currentTarget.value.trim().toLowerCase() })}
      />
      <input
        type="number"
        min="1"
        aria-label="Days"
        value={rule.days}
        onchange={(e) => updateDomain(i, { days: amount(e) })}
      />
      <span class="unit">d</span>
      <button
        class="icon-button danger"
        title="Remove"
        onclick={() => update({ domains: rules.domains.filter((_, j) => j !== i) })}
      >
        <Trash size={14} />
      </button>
    </div>
  {/each}
  <button
    class="chip-button add"
    onclick={() => update({ domains: [...rules.domains, { domain: '', days: 7, on: true }] })}
  >
    <Plus size={13} /> Domain
  </button>
</div>

<style>
  .settings {
    padding: 8px 12px;
    display: grid;
    gap: 6px;
  }

  h2,
  h3 {
    margin: 8px 0 2px;
    font-size: 13px;
  }

  h3 {
    color: var(--fg-muted);
    font-weight: 500;
  }

  .rule {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .name {
    flex: 1;
  }

  .label {
    font-weight: 600;
  }

  kbd {
    font:
      12px ui-monospace,
      monospace;
    padding: 1px 6px;
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--bg-soft);
  }

  .unset {
    color: var(--fg-muted);
  }

  .domain {
    flex: 1;
    min-width: 0;
  }

  input[type='number'] {
    width: 56px;
  }

  input:not([type='checkbox']) {
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
  }

  .unit {
    color: var(--fg-muted);
    width: 10px;
  }

  .add {
    justify-self: start;
    font-size: 12px;
  }
</style>

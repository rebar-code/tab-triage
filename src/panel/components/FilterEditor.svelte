<script lang="ts">
  import { Pin, Trash } from '@lucide/svelte';
  import { NO_TEXT, TEXT_OPS, normalizeSite } from '../../lib/filters';
  import type { QuickFilter, TextOp } from '../../lib/types';

  interface Props {
    filter: QuickFilter;
    noAccess: boolean;
    focused: boolean;
    picking: boolean;
    /** Why Pick is off, or '' when it can run. */
    pickBlocked: string;
    onChange: (patch: Partial<QuickFilter>) => void;
    onRemove: () => void;
    onPick: () => void;
    onCancelPick: () => void;
    onGrant: () => void;
  }

  let {
    filter,
    noAccess,
    focused,
    picking,
    pickBlocked,
    onChange,
    onRemove,
    onPick,
    onCancelPick,
    onGrant,
  }: Props = $props();

  const id = $derived(`filter-${filter.id}`);

  function value(event: Event): string {
    return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value.trim();
  }

  function reveal(node: HTMLElement): void {
    node.scrollIntoView({ block: 'center' });
    node.querySelector('input')?.focus();
  }
</script>

<div
  class="filter"
  class:focused
  data-testid="filter-editor"
  data-filter={filter.name}
  {@attach focused ? reveal : undefined}
>
  <div class="head">
    <input
      class="name"
      aria-label="Name"
      value={filter.name}
      onchange={(e) => onChange({ name: value(e) || 'Filter' })}
    />
    <button
      class="icon-button"
      class:on={filter.pinned}
      title={filter.pinned ? 'Unpin' : 'Pin as chip'}
      aria-pressed={filter.pinned}
      onclick={() => onChange({ pinned: !filter.pinned })}><Pin size={13} /></button
    >
    <button class="icon-button danger" title="Remove" onclick={onRemove}>
      <Trash size={14} />
    </button>
  </div>

  <label for="{id}-site">Site</label>
  <input
    id="{id}-site"
    class="wide"
    placeholder="any"
    value={filter.domain}
    onchange={(e) => {
      const domain = normalizeSite(value(e));
      e.currentTarget.value = domain;
      onChange({ domain });
    }}
  />

  <label for="{id}-url">URL contains</label>
  <input
    id="{id}-url"
    class="wide"
    value={filter.urlContains}
    onchange={(e) => onChange({ urlContains: value(e) })}
  />

  <label for="{id}-title">Title contains</label>
  <input
    id="{id}-title"
    class="wide"
    value={filter.titleContains}
    onchange={(e) => onChange({ titleContains: value(e) })}
  />

  <label for="{id}-idle">Not viewed</label>
  <span class="days">
    <input
      id="{id}-idle"
      type="number"
      min="0"
      value={filter.idleDays || ''}
      onchange={(e) => onChange({ idleDays: Math.max(0, Number(value(e)) || 0) })}
    />
    <span class="unit">d</span>
  </span>
  <span></span>

  <label for="{id}-selector">Element</label>
  <input
    id="{id}-selector"
    placeholder="CSS selector"
    value={filter.selector}
    onchange={(e) => onChange({ selector: value(e) })}
  />
  {#if picking}
    <button class="chip-button" onclick={onCancelPick}>Cancel</button>
  {:else}
    <button
      class="chip-button"
      disabled={pickBlocked !== ''}
      title={pickBlocked || undefined}
      onclick={onPick}>Pick</button
    >
  {/if}

  <label for="{id}-text">Text</label>
  <span class="op">
    <select
      aria-label="Text match"
      value={filter.textOp}
      onchange={(e) => onChange({ textOp: value(e) as TextOp })}
    >
      {#each TEXT_OPS as { op, label } (op)}
        <option value={op}>{label}</option>
      {/each}
    </select>
    <input
      id="{id}-text"
      value={filter.text}
      disabled={NO_TEXT.includes(filter.textOp)}
      onchange={(e) => onChange({ text: value(e) })}
    />
  </span>
  {#if noAccess}
    <button class="no-access" onclick={onGrant}>No access</button>
  {:else}
    <span></span>
  {/if}
</div>

<style>
  .filter {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) auto;
    gap: 5px 8px;
    align-items: center;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .filter.focused {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--bg-selected);
  }

  .head {
    grid-column: 1 / 4;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name {
    flex: 1;
    font-weight: 600;
  }

  label {
    color: var(--fg-muted);
    font-size: 12px;
  }

  .wide {
    grid-column: 2 / 4;
  }

  input,
  select {
    min-width: 0;
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg);
    font: inherit;
    color: inherit;
  }

  input:disabled {
    opacity: 0.4;
  }

  .days {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .days input {
    width: 56px;
  }

  .unit {
    color: var(--fg-muted);
  }

  .op {
    display: flex;
    gap: 4px;
    min-width: 0;
  }

  .op select {
    flex: none;
    padding: 2px 4px;
  }

  .op input {
    flex: 1;
  }

  .chip-button {
    font-size: 12px;
  }

  .chip-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .icon-button.on {
    background: var(--bg-selected);
    color: var(--accent);
  }

  .no-access {
    font-size: 11px;
    color: var(--danger);
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 0 6px;
    white-space: nowrap;
  }
</style>

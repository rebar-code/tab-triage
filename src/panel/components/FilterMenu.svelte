<script lang="ts">
  import { Pencil, Pin, Plus, Trash } from '@lucide/svelte';
  import type { QuickFilter } from '../../lib/types';
  import type { FilterHover } from '../hover';

  interface Props {
    filters: QuickFilter[];
    counts: Map<string, number>;
    noAccess: Set<string>;
    onShow: (id: string) => void;
    onClose: (id: string) => void;
    onEdit: (id: string) => void;
    onPin: (id: string) => void;
    onAdd: () => void;
    onHover: (hover: FilterHover | null) => void;
    onDismiss: () => void;
  }

  let {
    filters,
    counts,
    noAccess,
    onShow,
    onClose,
    onEdit,
    onPin,
    onAdd,
    onHover,
    onDismiss,
  }: Props = $props();
</script>

<button class="backdrop" aria-label="Close filters" onclick={onDismiss}></button>
<div class="menu" role="menu" tabindex="-1" onmouseleave={() => onHover(null)}>
  {#each filters as filter (filter.id)}
    {@const n = counts.get(filter.id) ?? 0}
    <div class="item" data-testid="filter-item" data-filter={filter.name}>
      <button
        class="icon-button"
        class:on={filter.pinned}
        title={filter.pinned ? 'Unpin' : 'Pin as chip'}
        aria-pressed={filter.pinned}
        onclick={() => onPin(filter.id)}><Pin size={13} /></button
      >
      {#if noAccess.has(filter.id)}
        <span class="show" aria-disabled="true">{filter.name}</span>
        <button class="no-access" onclick={() => onEdit(filter.id)}>No access</button>
      {:else}
        <button
          class="show"
          disabled={n === 0}
          onclick={() => onShow(filter.id)}
          onmouseenter={() => onHover({ id: filter.id, kind: 'show' })}
        >
          <span class="name">{filter.name}</span>
          <span class="n">{n}</span>
        </button>
        <button
          class="icon-button danger"
          title="Close {n}"
          disabled={n === 0}
          onclick={() => onClose(filter.id)}
          onmouseenter={() => onHover({ id: filter.id, kind: 'close' })}><Trash size={14} /></button
        >
      {/if}
      <button
        class="icon-button"
        title="Edit"
        onclick={() => onEdit(filter.id)}
        onmouseenter={() => onHover(null)}><Pencil size={13} /></button
      >
    </div>
  {/each}
  <hr />
  <button class="add" onclick={onAdd}><Plus size={13} /> Filter</button>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 4;
    cursor: default;
  }

  .menu {
    position: absolute;
    z-index: 5;
    top: 40px;
    left: 8px;
    right: 8px;
    padding: 4px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.18);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 2px;
    border-radius: 5px;
  }

  .item:hover {
    background: var(--bg-hover);
  }

  .show {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 6px 4px;
    text-align: left;
  }

  .show:disabled,
  .show[aria-disabled] {
    cursor: default;
    color: var(--fg-muted);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .n {
    margin-left: auto;
    color: var(--fg-muted);
    font-size: 11px;
  }

  .icon-button.on {
    background: var(--bg-selected);
    color: var(--accent);
  }

  .icon-button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .no-access {
    font-size: 11px;
    color: var(--danger);
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 0 6px;
    white-space: nowrap;
  }

  hr {
    border: 0;
    border-top: 1px solid var(--border);
    margin: 4px 0;
  }

  .add {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 5px;
  }

  .add:hover {
    background: var(--bg-hover);
  }
</style>

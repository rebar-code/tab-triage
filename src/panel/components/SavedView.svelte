<script lang="ts">
  import { Trash } from '@lucide/svelte';
  import { openSaved, removeSaved } from '../../lib/actions';
  import { formatAge } from '../../lib/group';
  import type { SavedEntry } from '../../lib/types';
  import { faviconUrl } from '../favicon';

  let { saved, now }: { saved: SavedEntry[]; now: number } = $props();

  const newest = $derived([...saved].reverse());
</script>

{#each newest as entry (entry.url)}
  <div class="row" data-testid="saved-row">
    <img src={faviconUrl(entry.url)} alt="" width="16" height="16" />
    <button class="title" title={entry.url} onclick={() => openSaved(entry)}>{entry.title}</button>
    <span class="age" title="Saved">{formatAge(now - entry.savedAt)}</span>
    <button class="icon-button danger" title="Remove" onclick={() => removeSaved([entry.url])}>
      <Trash size={14} />
    </button>
  </div>
{:else}
  <p class="empty">Nothing saved</p>
{/each}

<style>
  .row {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto 22px;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 6px 0 10px;
  }

  .row:hover {
    background: var(--bg-hover);
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .age {
    color: var(--fg-muted);
    font-size: 11px;
  }

  .empty {
    color: var(--fg-muted);
    text-align: center;
    padding: 24px;
  }
</style>

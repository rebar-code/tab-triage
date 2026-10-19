<script lang="ts">
  import { Zap } from '@lucide/svelte';
  import { clearClosed, reopenClosed } from '../../lib/actions';
  import { formatAge } from '../../lib/group';
  import type { ClosedEntry } from '../../lib/types';
  import { faviconUrl } from '../favicon';

  let { closed, now }: { closed: ClosedEntry[]; now: number } = $props();

  const newest = $derived([...closed].reverse());
</script>

{#if newest.length}
  <div class="head">
    <button class="chip-button" onclick={clearClosed}>Clear</button>
  </div>
{/if}
{#each newest as entry (entry.batch + entry.url)}
  <div class="row" data-testid="closed-row">
    <img src={faviconUrl(entry.url)} alt="" width="16" height="16" />
    <button class="title" title="Reopen {entry.url}" onclick={() => reopenClosed(entry)}>
      {entry.title}
    </button>
    {#if entry.reason === 'rule'}
      <span class="rule" title="Closed by a rule"><Zap size={12} /></span>
    {/if}
    <span class="age">{formatAge(now - entry.closedAt)}</span>
  </div>
{:else}
  <p class="empty">Nothing closed</p>
{/each}

<style>
  .head {
    display: flex;
    justify-content: flex-end;
    padding: 8px;
    font-size: 12px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
  }

  .row:hover {
    background: var(--bg-hover);
  }

  .title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .rule {
    display: grid;
    color: var(--fg-muted);
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

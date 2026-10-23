<script lang="ts">
  import { Copy, Pin, Trash, Volume2 } from '@lucide/svelte';
  import { formatAge } from '../../lib/group';
  import { warmOnHover } from '../../lib/prewarm';
  import { isProtected } from '../../lib/rules';
  import type { TabItem } from '../../lib/types';
  import { frameOnHover } from '../../lib/window-frame';
  import { faviconUrl } from '../favicon';
  import GithubBadge from './GithubBadge.svelte';

  interface Props {
    item: TabItem;
    selected: boolean;
    selecting: boolean;
    now: number;
    windowNumber?: number;
    /** A hovered filter would show or close this tab. */
    highlight?: 'show' | 'close' | null;
    onToggle: (event: MouseEvent) => void;
    onOpen: () => void;
    onClose: () => void;
    onRename: (name: string) => void;
  }

  let {
    item,
    selected,
    selecting,
    now,
    windowNumber,
    highlight = null,
    onToggle,
    onOpen,
    onClose,
    onRename,
  }: Props = $props();

  let renaming = $state(false);

  const merged = $derived(item.github?.kind === 'pr' && item.github.state === 'merged');
  const locked = $derived(isProtected(item));

  function startRename(event: MouseEvent): void {
    event.stopPropagation();
    renaming = true;
  }

  function finishRename(event: KeyboardEvent & { currentTarget: HTMLInputElement }): void {
    if (event.key === 'Enter') {
      onRename(event.currentTarget.value.trim());
      renaming = false;
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      renaming = false;
    }
  }

  function focusOnMount(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }
</script>

<div
  class="row"
  class:selected
  class:selecting
  class:merged
  class:active={item.active}
  class:discarded={item.discarded}
  class:hl-show={highlight === 'show'}
  class:hl-close={highlight === 'close'}
  data-testid="tab-row"
  data-tab-id={item.id}
  {@attach warmOnHover(item.id)}
  {@attach windowNumber && item.active && frameOnHover(item.id)}
>
  <span class="check">
    {#if item.pinned}
      <span class="lock" title="Pinned"><Pin size={13} /></span>
    {:else if item.audible}
      <span class="lock" title="Playing audio"><Volume2 size={13} /></span>
    {:else}
      <input
        type="checkbox"
        checked={selected}
        disabled={locked}
        aria-label="Select tab"
        onclick={(e) => {
          // No preventDefault: Chrome reverts a cancelled click after Svelte has
          // already set `checked`, so the box never showed the selection.
          onToggle(e);
          e.currentTarget.checked = selected;
        }}
      />
    {/if}
  </span>
  <img class="favicon" src={faviconUrl(item.url)} alt="" width="16" height="16" />
  <button
    class="title"
    title={item.url}
    onclick={(e) => ((e.shiftKey || e.metaKey || e.ctrlKey) && !locked ? onToggle(e) : onOpen())}
    >{item.title}</button
  >
  <span class="meta">
    {#if item.label}
      {#if renaming}
        <input
          class="rename"
          value={item.label}
          aria-label="Project name"
          onkeydown={finishRename}
          onblur={() => (renaming = false)}
          {@attach focusOnMount}
        />
      {:else if item.supabaseRef}
        <button class="label" title="Rename" onclick={startRename}>{item.label}</button>
      {:else}
        <span class="label">{item.label}</span>
      {/if}
    {/if}
    {#if item.duplicate}
      <span class="dup" title="Duplicate"><Copy size={12} /></span>
    {/if}
    {#if item.github}
      <GithubBadge status={item.github} />
    {/if}
    {#if windowNumber}
      <span class="window" title="Window {windowNumber}">W{windowNumber}</span>
    {/if}
    <span class="age" title="Opened">{formatAge(now - item.openedAt)}</span>
  </span>
  <button class="icon-button danger trash" title="Close tab" onclick={onClose}>
    <Trash size={14} />
  </button>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 18px 16px minmax(0, 1fr) auto 22px;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 6px 0 26px;
  }

  .row:hover {
    background: var(--bg-hover);
  }

  .row.selected {
    background: var(--bg-selected);
  }

  .row.merged {
    box-shadow: inset 3px 0 0 var(--merged);
  }

  .row.merged:not(.selected) {
    background: var(--merged-bg);
  }

  .row.hl-show,
  .row.merged.hl-show:not(.selected) {
    background: var(--bg-selected);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .row.hl-close,
  .row.merged.hl-close:not(.selected) {
    background: var(--danger-bg);
    box-shadow: inset 3px 0 0 var(--danger);
  }

  .check {
    display: grid;
    place-items: center;
  }

  .check input {
    margin: 0;
    opacity: 0;
  }

  .row:hover .check input,
  .row.selecting .check input,
  .row.selected .check input {
    opacity: 1;
  }

  .lock {
    color: var(--fg-muted);
    display: grid;
  }

  .discarded .favicon,
  .discarded .title {
    opacity: 0.6;
  }

  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    min-width: 0;
  }

  .active .title {
    font-weight: 600;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--fg-muted);
    font-size: 11px;
  }

  .label {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--bg-soft);
    border: 1px solid var(--border);
    color: var(--fg);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rename {
    width: 120px;
    font-size: 11px;
    padding: 1px 4px;
  }

  .dup {
    display: grid;
  }

  .window {
    font-variant-numeric: tabular-nums;
  }

  .age {
    min-width: 24px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .trash {
    opacity: 0;
  }

  .row:hover .trash {
    opacity: 1;
  }
</style>

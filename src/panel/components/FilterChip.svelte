<script lang="ts">
  import { Trash } from '@lucide/svelte';
  import type { QuickFilter } from '../../lib/types';
  import type { FilterHover } from '../hover';

  interface Props {
    filter: QuickFilter;
    count: number;
    onShow: () => void;
    onClose: () => void;
    onEdit: () => void;
    onHover: (hover: FilterHover | null) => void;
  }

  let { filter, count, onShow, onClose, onEdit, onHover }: Props = $props();

  function edit(event: MouseEvent): void {
    event.preventDefault();
    onEdit();
  }
</script>

<span
  class="split"
  role="group"
  aria-label={filter.name}
  oncontextmenu={edit}
  onmouseleave={() => onHover(null)}
>
  <button
    class="chip-button"
    onclick={onShow}
    onmouseenter={() => onHover({ id: filter.id, kind: 'show' })}>{filter.name} ({count})</button
  >
  <button
    class="chip-button close"
    title="Close {count}"
    onclick={onClose}
    onmouseenter={() => onHover({ id: filter.id, kind: 'close' })}><Trash size={12} /></button
  >
</span>

<style>
  .split {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
  }

  .split .chip-button {
    border: 0;
    border-radius: 0;
  }

  .split .close {
    border-left: 1px solid var(--border);
    padding: 3px 6px 3px 5px;
    color: var(--danger);
  }
</style>

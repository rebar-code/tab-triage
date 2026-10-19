<script lang="ts">
  import { Camera } from '@lucide/svelte';
  import { formatAge } from '../../lib/group';
  import { cardTop } from '../../lib/placement';
  import type { TabItem } from '../../lib/types';
  import type { PreviewImage } from '../store.svelte';

  interface Props {
    item: TabItem;
    image?: PreviewImage;
    row: { top: number; bottom: number };
    now: number;
  }

  let { item, image, row, now }: Props = $props();

  let innerWidth = $state(window.innerWidth);
  let innerHeight = $state(window.innerHeight);

  const TEXT_HEIGHT = 48;
  const width = $derived(innerWidth - 16);
  const imageHeight = $derived(
    image ? Math.min(Math.round((width * image.height) / image.width), innerHeight * 0.6) : 0,
  );
  const top = $derived(cardTop(row, imageHeight + TEXT_HEIGHT, innerHeight));
  const where = $derived.by(() => {
    try {
      const u = new URL(item.url);
      return u.host + u.pathname + u.search;
    } catch {
      return item.url;
    }
  });
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div class="card" style:top="{top}px" data-testid="preview">
  {#if image}
    <img src={image.src} alt="" style:height="{imageHeight}px" />
  {/if}
  <div class="text">
    <div class="title">{item.title}</div>
    <div class="url">
      <span class="where">{where}</span>
      {#if image}
        <span class="age"><Camera size={11} />{formatAge(now - image.capturedAt)}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .card {
    position: fixed;
    left: 8px;
    right: 8px;
    z-index: 10;
    pointer-events: none;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
  }

  img {
    display: block;
    width: 100%;
    object-fit: cover;
    object-position: top;
    border-bottom: 1px solid var(--border);
  }

  .text {
    padding: 6px 10px;
    display: grid;
    gap: 2px;
  }

  .title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .url {
    display: flex;
    gap: 8px;
    color: var(--fg-muted);
    font-size: 11px;
  }

  .where {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .age {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
</style>

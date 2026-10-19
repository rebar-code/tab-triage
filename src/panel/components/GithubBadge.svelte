<script lang="ts">
  import {
    CircleCheck,
    CircleDot,
    GitMerge,
    GitPullRequest,
    GitPullRequestClosed,
    GitPullRequestDraft,
  } from '@lucide/svelte';
  import type { GithubStatus } from '../../lib/types';

  let { status }: { status: GithubStatus } = $props();

  const view = $derived.by(() => {
    if (status.kind === 'issue')
      return status.state === 'closed'
        ? { Icon: CircleCheck, color: 'var(--merged)', text: 'Closed issue' }
        : { Icon: CircleDot, color: 'var(--open)', text: 'Open issue' };
    switch (status.state) {
      case 'merged':
        return { Icon: GitMerge, color: 'var(--merged)', text: 'Merged' };
      case 'draft':
        return { Icon: GitPullRequestDraft, color: 'var(--draft)', text: 'Draft' };
      case 'closed':
        return { Icon: GitPullRequestClosed, color: 'var(--closed)', text: 'Closed' };
      default:
        return { Icon: GitPullRequest, color: 'var(--open)', text: 'Open' };
    }
  });
</script>

<span class="badge" style:color={view.color} title={view.text} data-state={status.state}>
  <view.Icon size={14} strokeWidth={2.25} />
</span>

<style>
  .badge {
    display: inline-grid;
    place-items: center;
  }
</style>

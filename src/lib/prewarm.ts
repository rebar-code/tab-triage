import type { Attachment } from 'svelte/attachments';

/** How long the pointer rests on a row before its tab starts loading. */
const HOVER_DELAY = 150;

export type TabState = Pick<chrome.tabs.Tab, 'active' | 'discarded' | 'status'>;

export interface TabLoader {
  get: (id: number) => Promise<TabState>;
  /** Must load the tab without activating it. `chrome.tabs.reload` does. */
  reload: (id: number) => Promise<void>;
}

export interface Prewarm {
  enter: (id: number) => void;
  leave: () => void;
}

/** A discarded or never-loaded tab reloads when activated; that reload is the click lag. */
export function needsLoad(tab: TabState): boolean {
  return !tab.active && (tab.discarded || tab.status === 'unloaded');
}

/** Loads a hovered tab in the background so a click on it shows the page at once. */
export function createPrewarm(loader: TabLoader, delay = HOVER_DELAY): Prewarm {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let loading: number | undefined;

  async function warm(id: number): Promise<void> {
    // One load at a time: skip while the previous one still runs.
    if (loading !== undefined) {
      const prev = await loader.get(loading).catch(() => undefined);
      if (prev?.status === 'loading') return;
      loading = undefined;
    }
    const tab = await loader.get(id).catch(() => undefined);
    if (!tab || !needsLoad(tab)) return;
    loading = id;
    await loader.reload(id).catch(() => {});
  }

  return {
    enter(id) {
      clearTimeout(timer);
      timer = setTimeout(() => void warm(id), delay);
    },
    leave() {
      clearTimeout(timer);
    },
  };
}

const prewarm = createPrewarm({
  get: (id) => chrome.tabs.get(id),
  reload: (id) => chrome.tabs.reload(id),
});

/** Row attachment: starts loading the tab while the pointer rests on the row. */
export function warmOnHover(id: number): Attachment<HTMLElement> {
  return (node) => {
    const enter = (): void => prewarm.enter(id);
    node.addEventListener('mouseenter', enter);
    node.addEventListener('mouseleave', prewarm.leave);
    return () => {
      node.removeEventListener('mouseenter', enter);
      node.removeEventListener('mouseleave', prewarm.leave);
    };
  };
}

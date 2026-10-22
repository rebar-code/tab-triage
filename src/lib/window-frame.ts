import type { Attachment } from 'svelte/attachments';
import { hideWindowFrame, showWindowFrame } from './page-scripts';

/** How long the pointer rests on a row before its window lights up. */
const HOVER_DELAY = 150;

export interface FrameTarget {
  /** The tab the window shows now. */
  activeTab: (windowId: number) => Promise<number | undefined>;
  show: (tabId: number) => Promise<void>;
  hide: (tabId: number) => Promise<void>;
}

export interface WindowFrame {
  enter: (windowId: number) => void;
  leave: () => void;
}

/** Frames the window of a hovered row, so the user can see which window holds the tab. */
export function createWindowFrame(target: FrameTarget, delay = HOVER_DELAY): WindowFrame {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown: { windowId: number; tabId: number } | undefined;
  // Bumped on every enter and leave, so a slow lookup cannot frame a window the pointer left.
  let generation = 0;

  function hide(): void {
    if (shown) void target.hide(shown.tabId).catch(() => {});
    shown = undefined;
  }

  async function show(windowId: number, gen: number): Promise<void> {
    const tabId = await target.activeTab(windowId).catch(() => undefined);
    if (tabId === undefined || gen !== generation) return;
    shown = { windowId, tabId };
    await target.show(tabId).catch(() => {});
  }

  return {
    enter(windowId) {
      clearTimeout(timer);
      // Moving between rows of the framed window keeps the frame up.
      if (shown?.windowId === windowId) return;
      const gen = ++generation;
      timer = setTimeout(() => {
        hide();
        void show(windowId, gen);
      }, delay);
    },
    leave() {
      clearTimeout(timer);
      generation++;
      timer = setTimeout(hide, delay);
    },
  };
}

const frame = createWindowFrame({
  activeTab: async (windowId) => (await chrome.tabs.query({ active: true, windowId }))[0]?.id,
  // Fails on chrome:// pages and on sites without host access; those stay unframed.
  show: async (tabId) => {
    await chrome.scripting.executeScript({ target: { tabId }, func: showWindowFrame });
  },
  hide: async (tabId) => {
    await chrome.scripting.executeScript({ target: { tabId }, func: hideWindowFrame });
  },
});

/** Row attachment: frames the tab's window while the pointer rests on the row. */
export function frameOnHover(windowId: number): Attachment<HTMLElement> {
  return (node) => {
    const enter = (): void => frame.enter(windowId);
    node.addEventListener('mouseenter', enter);
    node.addEventListener('mouseleave', frame.leave);
    // Tab updates re-run this attachment under a resting pointer, with no new mouseenter.
    if (node.matches(':hover')) enter();
    return () => {
      node.removeEventListener('mouseenter', enter);
      node.removeEventListener('mouseleave', frame.leave);
      // A row removed under the pointer (tab closed) never gets mouseleave.
      if (node.matches(':hover')) frame.leave();
    };
  };
}

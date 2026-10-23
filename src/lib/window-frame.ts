import type { Attachment } from 'svelte/attachments';
import { hideWindowFrame, showWindowFrame } from './page-scripts';

/** How long the pointer rests on a row before its page lights up. */
const HOVER_DELAY = 150;

export interface FrameTarget {
  show: (tabId: number) => Promise<void>;
  hide: (tabId: number) => Promise<void>;
}

export interface WindowFrame {
  enter: (tabId: number) => void;
  leave: () => void;
}

/** Frames the page of a hovered row, so the user can see which window shows the tab. */
export function createWindowFrame(target: FrameTarget, delay = HOVER_DELAY): WindowFrame {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown: number | undefined;

  function hide(): void {
    if (shown !== undefined) void target.hide(shown).catch(() => {});
    shown = undefined;
  }

  return {
    enter(tabId) {
      clearTimeout(timer);
      // A row re-rendered under the pointer keeps its frame up.
      if (shown === tabId) return;
      timer = setTimeout(() => {
        hide();
        shown = tabId;
        void target.show(tabId).catch(() => {});
      }, delay);
    },
    leave() {
      clearTimeout(timer);
      timer = setTimeout(hide, delay);
    },
  };
}

const frame = createWindowFrame({
  // Fails on chrome:// pages and on sites without host access; those stay unframed.
  show: async (tabId) => {
    await chrome.scripting.executeScript({ target: { tabId }, func: showWindowFrame });
  },
  hide: async (tabId) => {
    await chrome.scripting.executeScript({ target: { tabId }, func: hideWindowFrame });
  },
});

/** Row attachment: frames the tab's page while the pointer rests on the row. */
export function frameOnHover(tabId: number): Attachment<HTMLElement> {
  return (node) => {
    const enter = (): void => frame.enter(tabId);
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

import type { Attachment } from 'svelte/attachments';
import {
  hidePreviewFrame,
  pageSummary,
  PREVIEW_KEY,
  showPreviewFrame,
  type PageSummary,
} from './page-scripts';
import { onRowHover, type WindowFrame } from './window-frame';

/** How long the pointer rests on a row before its preview opens. Longer than the frame's,
 * so a quick pass over the list shows nothing. */
const HOVER_DELAY = 400;

export interface PreviewTarget {
  show: (tabId: number) => Promise<void>;
  hide: () => Promise<void>;
}

/** Previews a hovered row's tab. Moving to another row swaps the card's content in place. */
export function createPreview(target: PreviewTarget, delay = HOVER_DELAY): WindowFrame {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown: number | undefined;

  return {
    enter(tabId) {
      clearTimeout(timer);
      // A row re-rendered under the pointer keeps its card up.
      if (shown === tabId) return;
      timer = setTimeout(() => {
        shown = tabId;
        void target.show(tabId).catch(() => {});
      }, delay);
    },
    leave() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (shown === undefined) return;
        shown = undefined;
        void target.hide().catch(() => {});
      }, delay);
    },
  };
}

async function summaryOf(tabId: number): Promise<PageSummary> {
  const tab = await chrome.tabs.get(tabId);
  const fallback: PageSummary = {
    title: tab.title ?? '',
    url: tab.url ?? '',
    image: null,
    description: null,
    headings: [],
    text: '',
  };
  if (tab.discarded) return fallback;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: pageSummary });
    return res?.result ?? fallback;
  } catch {
    // No access, or a page Chrome does not let extensions read.
    return fallback;
  }
}

/** Draws the card in the page the panel's window shows. Steps run in order, so a quick
 * leave cannot remove the card before it is drawn. */
function chromeTarget(): PreviewTarget {
  let host: number | undefined;
  let queue = Promise.resolve();
  const run = (job: () => Promise<void>): Promise<void> => (queue = queue.then(job, job));

  async function removeFrame(): Promise<void> {
    if (host === undefined) return;
    const tabId = host;
    host = undefined;
    await chrome.scripting
      .executeScript({ target: { tabId }, func: hidePreviewFrame })
      .catch(() => {});
  }

  async function hide(): Promise<void> {
    await removeFrame();
    await chrome.storage.session.remove(PREVIEW_KEY);
  }

  async function draw(tabId: number): Promise<void> {
    const { id: windowId } = await chrome.windows.getCurrent();
    const [active] = await chrome.tabs.query({ active: true, windowId });
    // The page on screen needs no preview of itself.
    if (active?.id === undefined || active.id === tabId) return hide();
    if (host !== active.id) await removeFrame();
    await chrome.storage.session.set({ [PREVIEW_KEY]: await summaryOf(tabId) });
    // Fails on chrome:// pages and on sites without host access; those get no card.
    await chrome.scripting.executeScript({ target: { tabId: active.id }, func: showPreviewFrame });
    host = active.id;
  }

  return { show: (tabId) => run(() => draw(tabId)), hide: () => run(hide) };
}

const preview = createPreview(chromeTarget());

/** Row attachment: previews the tab in the main window while the pointer rests on the row. */
export function previewOnHover(tabId: number): Attachment<HTMLElement> {
  return onRowHover(preview, tabId);
}

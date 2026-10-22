import { textMatches } from './filters';
import { cancelPick, pageText, pickElement, type Picked } from './page-scripts';
import type { QuickFilter, TabItem } from './types';

/** Ids of the tabs whose live page matches the filter's element. Unloaded tabs never match. */
export async function pageMatchIds(filter: QuickFilter, tabs: TabItem[]): Promise<Set<number>> {
  const ids = new Set<number>();
  await Promise.all(
    tabs
      .filter((t) => !t.discarded)
      // Runs chrome.scripting against live tabs; covered by the e2e filter test.
      // fallow-ignore-next-line complexity
      .map(async (t) => {
        try {
          const [res] = await chrome.scripting.executeScript({
            target: { tabId: t.id },
            func: pageText,
            args: [filter.selector],
          });
          if (textMatches(res?.result ?? null, filter.textOp, filter.text)) ids.add(t.id);
        } catch {
          // No access, or a page Chrome does not let extensions read.
        }
      }),
  );
  return ids;
}

/** Brings `tab` to the front and lets the user click an element in it. Null on Esc or no access. */
export async function pickInTab(tab: TabItem): Promise<Picked | null> {
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pickElement,
    });
    return res?.result ?? null;
  } catch {
    return null;
  }
}

export async function stopPicking(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, func: cancelPick }).catch(() => {});
}

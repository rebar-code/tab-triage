// Screenshots the visible tab of a window so the panel can preview it on hover.
// Chrome can only capture the tab that is showing, so this runs whenever that
// tab or its scroll position changes.
import { putPreview } from './lib/previews';
import { isWebUrl, normalizeUrl } from './lib/url';

// captureVisibleTab allows two calls per second for the whole extension.
const MIN_GAP = 600;
const WIDTH = 720;

const timers = new Map<number, ReturnType<typeof setTimeout>>();
let lastRun = 0;

/** Captures the window's active tab after `delay` ms, merging bursts of requests. */
export function requestCapture(windowId: number, delay = 400): void {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  clearTimeout(timers.get(windowId));
  const gap = MIN_GAP - (Date.now() - lastRun);
  timers.set(
    windowId,
    setTimeout(() => void capture(windowId), Math.max(delay, gap)),
  );
}

async function shrink(dataUrl: string): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { blob: await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 }), width, height };
}

async function capture(windowId: number, retry = true): Promise<void> {
  timers.delete(windowId);
  if (Date.now() - lastRun < MIN_GAP) return requestCapture(windowId, 0);
  lastRun = Date.now();
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab?.id === undefined || !tab.url || !isWebUrl(tab.url)) return;
  const win = await chrome.windows.get(windowId).catch(() => null);
  if (!win || win.state === 'minimized') return;
  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 80 });
  } catch (error) {
    // Over the rate limit: try once more. Anything else is a page Chrome
    // refuses to capture, such as the Web Store.
    if (retry && String(error).includes('MAX_CAPTURE_VISIBLE_TAB'))
      setTimeout(() => void capture(windowId, false), 1000);
    return;
  }
  // The user may have switched tabs or navigated while the capture ran.
  const after = await chrome.tabs.get(tab.id).catch(() => null);
  if (!after?.active || after.url !== tab.url) return;
  const url = normalizeUrl(tab.url);
  await putPreview({ url, tabId: tab.id, capturedAt: Date.now(), ...(await shrink(dataUrl)) });
  chrome.runtime.sendMessage({ type: 'preview', url }).catch(() => {});
}

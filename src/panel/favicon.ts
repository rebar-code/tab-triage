/** Chrome's cached favicon for a page. Works for unloaded tabs too. */
export function faviconUrl(pageUrl: string): string {
  return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`);
}

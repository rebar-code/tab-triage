// Functions run in a tab with `chrome.scripting.executeScript`. Chrome serializes each one,
// so they must not use anything from outside their own body.

/** Text of the first element that matches `selector`, or null when there is none. */
export function pageText(selector: string): string | null {
  try {
    const el = document.querySelector(selector);
    return el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
  } catch {
    return null;
  }
}

export interface Picked {
  selector: string;
  text: string;
}

/** Outlines the element under the mouse; a click resolves with its selector and text, Esc with null. */
export function pickElement(): Promise<Picked | null> {
  const STABLE = ['data-testid', 'data-test', 'data-qa', 'data-cy', 'aria-label', 'name'];

  function unique(selector: string): boolean {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  // Runs inside a tab; covered by the e2e pick test, which fallow cannot see.
  // fallow-ignore-next-line complexity
  function part(el: Element): string {
    if (el.id) return `#${CSS.escape(el.id)}`;
    for (const attr of STABLE) {
      const value = el.getAttribute(attr);
      if (value) return `${el.localName}[${attr}=${JSON.stringify(value)}]`;
    }
    const same = [...(el.parentElement?.children ?? [])].filter(
      (c) => c.localName === el.localName,
    );
    return same.length > 1 ? `${el.localName}:nth-of-type(${same.indexOf(el) + 1})` : el.localName;
  }

  // Prefers id and test attributes, then walks up until the selector matches one element.
  function selectorFor(el: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      parts.unshift(part(node));
      const selector = parts.join(' > ');
      if (unique(selector)) return selector;
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  document.dispatchEvent(new Event('tab-triage-pick-cancel'));

  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;outline:2px solid #0969da;background:rgb(9 105 218 / .08);border-radius:2px;display:none';
  const tip = document.createElement('div');
  tip.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;background:#1f2328;color:#fff;font:11px ui-monospace,monospace;padding:2px 6px;border-radius:4px;white-space:nowrap;display:none';
  document.documentElement.append(box, tip);

  let current: Element | null = null;

  return new Promise((resolve) => {
    function finish(result: Picked | null): void {
      box.remove();
      tip.remove();
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('tab-triage-pick-cancel', onCancel);
      resolve(result);
    }

    // Runs inside a tab; covered by the e2e pick test, which fallow cannot see.
    // fallow-ignore-next-line complexity
    function onMove(event: MouseEvent): void {
      const el = event.target instanceof Element ? event.target : null;
      if (!el || el === current) return;
      current = el;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, {
        display: 'block',
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
      tip.textContent = selectorFor(el);
      Object.assign(tip.style, {
        display: 'block',
        left: `${Math.max(0, r.left)}px`,
        top: `${r.bottom + 4 > innerHeight - 20 ? Math.max(0, r.top - 22) : r.bottom + 4}px`,
      });
    }

    function onClick(event: MouseEvent): void {
      const el = event.target instanceof Element ? event.target : null;
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
      finish({ selector: selectorFor(el), text });
    }

    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish(null);
    }

    function onCancel(): void {
      finish(null);
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('tab-triage-pick-cancel', onCancel);
  });
}

/** Stops a running picker in this tab. */
export function cancelPick(): void {
  document.dispatchEvent(new Event('tab-triage-pick-cancel'));
}

/** Draws a frame inside the page edges, so the user can see which window shows it. */
export function showWindowFrame(): void {
  if (document.getElementById('tab-triage-window-frame')) return;
  const frame = document.createElement('div');
  frame.id = 'tab-triage-window-frame';
  frame.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;box-shadow:inset 0 0 0 4px #0969da,inset 0 0 32px 6px rgb(9 105 218 / .5)';
  document.documentElement.append(frame);
}

export function hideWindowFrame(): void {
  document.getElementById('tab-triage-window-frame')?.remove();
}

/** `chrome.storage.session` key that hands a `PageSummary` to the preview card. Memory only. */
export const PREVIEW_KEY = 'preview';

export interface PageSummary {
  title: string;
  url: string;
  image: string | null;
  description: string | null;
  headings: string[];
  text: string;
}

/** What a preview card shows of a page. Reads the live page; nothing is kept. */
export function pageSummary(): PageSummary {
  const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
  const meta = (selector: string): string =>
    clean(document.querySelector<HTMLMetaElement>(selector)?.content);

  function absolute(src: string): string | null {
    try {
      const url = new URL(src, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  const image = meta('meta[property="og:image"]');
  return {
    title: clean(document.title),
    url: location.href,
    image: image ? absolute(image) : null,
    description:
      meta('meta[property="og:description"]') || meta('meta[name="description"]') || null,
    headings: [...document.querySelectorAll('h1, h2')]
      .map((h) => clean(h.textContent))
      .filter(Boolean)
      .slice(0, 3),
    text: clean(document.body?.innerText).slice(0, 400),
  };
}

/** Puts the preview card at the right edge of the page. The page cannot read into it. */
export function showPreviewFrame(): void {
  if (document.getElementById('tab-triage-preview')) return;
  const frame = document.createElement('iframe');
  frame.id = 'tab-triage-preview';
  frame.src = chrome.runtime.getURL('preview.html');
  frame.style.cssText =
    'position:fixed;top:0;right:0;width:396px;height:75vh;border:0;z-index:2147483647;pointer-events:none;color-scheme:normal;background:transparent';
  document.documentElement.append(frame);
}

export function hidePreviewFrame(): void {
  document.getElementById('tab-triage-preview')?.remove();
}

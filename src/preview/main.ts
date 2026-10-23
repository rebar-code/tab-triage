import { PREVIEW_KEY, type PageSummary } from '../lib/page-scripts';
import { faviconUrl } from '../panel/favicon';
import './preview.css';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function setText(id: string, text: string | null): void {
  const node = el(id);
  node.textContent = text ?? '';
  node.hidden = !text;
}

function draw(summary: PageSummary | undefined): void {
  el('card').hidden = !summary;
  if (!summary) return;
  el<HTMLImageElement>('favicon').src = faviconUrl(summary.url);
  setText('title', summary.title || summary.url);
  setText('url', summary.url.replace(/^https?:\/\//, ''));
  const image = el<HTMLImageElement>('image');
  image.hidden = !summary.image;
  if (summary.image) image.src = summary.image;
  else image.removeAttribute('src');
  setText('description', summary.description);
  const headings = el('headings');
  headings.replaceChildren(
    ...summary.headings.map((h) => Object.assign(document.createElement('li'), { textContent: h })),
  );
  headings.hidden = summary.headings.length === 0;
  setText('text', summary.text);
}

// Sites that block outside use of their image get no image; the rest of the card stays.
el('image').addEventListener('error', (e) => ((e.currentTarget as HTMLElement).hidden = true));

chrome.storage.session.onChanged.addListener((changes) => {
  if (PREVIEW_KEY in changes) draw(changes[PREVIEW_KEY]?.newValue as PageSummary | undefined);
});
const stored = await chrome.storage.session.get(PREVIEW_KEY);
draw(stored[PREVIEW_KEY] as PageSummary | undefined);

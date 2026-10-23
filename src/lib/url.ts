import { getDomain } from 'tldts';

/** URL without its hash or a trailing slash, for age tracking and duplicate checks. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return url;
  }
}

/** Root domain a tab is grouped under. `docs.github.com` → `github.com`. */
export function groupKey(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'other';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:')
    return u.host ? `${u.protocol}//` : u.protocol;
  const domain = getDomain(u.hostname) ?? u.hostname;
  // Preview deployments live on vercel.app; keep them with the dashboard.
  if (domain === 'vercel.app') return 'vercel.com';
  return domain || 'other';
}

/** Host a tab is grouped under. `www.rebar.is` → `rebar.is`; other subdomains keep their own group. */
export function groupHost(url: string): string {
  const domain = groupKey(url);
  // Vercel previews and non-web pages stay grouped by their key.
  if (domain === 'vercel.com' || !isWebUrl(url)) return domain;
  return new URL(url).hostname.replace(/^www\./, '') || domain;
}

export function isWebUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

import type { GithubKind, GithubState } from '../types';

export interface GithubRef {
  owner: string;
  repo: string;
  kind: GithubKind;
  number: number;
  /** `owner/repo#123`, lower-cased. PRs and issues share one number space per repo. */
  key: string;
}

const PATH = /^\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)(?:\/|$)/;

export function parseGithubUrl(url: string): GithubRef | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname !== 'github.com') return null;
  const m = PATH.exec(u.pathname);
  if (!m) return null;
  const [, owner = '', repo = '', type, num = ''] = m;
  return {
    owner,
    repo,
    kind: type === 'pull' ? 'pr' : 'issue',
    number: Number(num),
    key: `${owner}/${repo}#${num}`.toLowerCase(),
  };
}

/** GitHub's header StateLabel `data-status`: pullMerged, draft, pullOpened, pullClosed, issueOpened, issueClosed… */
export function stateFromStatus(status: string): GithubState | null {
  if (status === 'pullMerged') return 'merged';
  if (status === 'draft') return 'draft';
  if (status.startsWith('pullClosed')) return 'closed';
  if (status.startsWith('pull')) return 'open';
  if (status.startsWith('issueOpen')) return 'open';
  if (status.startsWith('issue')) return 'closed';
  return null;
}

/** Reads the first StateLabel in a fetched page. The header label comes first. */
export function stateFromHtml(html: string): GithubState | null {
  const tag = /<[^>]*data-component="StateLabel"[^>]*>/.exec(html)?.[0];
  const status = tag && /data-status="([^"]+)"/.exec(tag)?.[1];
  return status ? stateFromStatus(status) : null;
}

export function stateFromDocument(doc: Document): GithubState | null {
  const status = doc
    .querySelector('[data-component="StateLabel"][data-status]')
    ?.getAttribute('data-status');
  return status ? stateFromStatus(status) : null;
}

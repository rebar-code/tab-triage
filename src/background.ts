import { closeTabs } from './lib/actions';
import { toItems } from './lib/items';
import { dueRule } from './lib/rules';
import { parseGithubUrl, stateFromHtml } from './lib/sites/github';
import { GITHUB, OPENED, loadSnapshot, writeGithub } from './lib/storage';
import type { GithubState } from './lib/types';
import { isWebUrl, normalizeUrl } from './lib/url';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// Merged PRs never change; open ones do.
const GITHUB_TTL: Record<GithubState, number> = {
  open: 10 * MINUTE,
  draft: 10 * MINUTE,
  closed: 60 * MINUTE,
  merged: DAY,
};
const GITHUB_FETCH_LIMIT = 25;
const PRUNE_AFTER = 7 * DAY;
const startedAt = Date.now();

async function setup(): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await chrome.alarms.create('tick', { periodInMinutes: 5 });
}
chrome.runtime.onInstalled.addListener(() => void setup());
chrome.runtime.onStartup.addListener(() => void setup());

async function recordOpened(url: string | undefined): Promise<void> {
  if (!url || !isWebUrl(url)) return;
  const key = OPENED + normalizeUrl(url);
  const existing = await chrome.storage.local.get(key);
  if (existing[key] === undefined) await chrome.storage.local.set({ [key]: Date.now() });
}
chrome.tabs.onCreated.addListener((tab) => void recordOpened(tab.pendingUrl ?? tab.url));
chrome.tabs.onUpdated.addListener((_id, change) => void recordOpened(change.url));

let refreshing = false;

/** Fetches PR and issue pages with the browser's GitHub session for tabs whose state is stale. */
async function refreshGithub(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const [tabs, snap] = await Promise.all([chrome.tabs.query({}), loadSnapshot()]);
    const now = Date.now();
    const due = new Map<string, { url: string; kind: 'pr' | 'issue' }>();
    for (const t of tabs) {
      const ref = t.url ? parseGithubUrl(t.url) : null;
      if (!ref || due.has(ref.key)) continue;
      const known = snap.github[ref.key];
      if (known && now - known.checkedAt < GITHUB_TTL[known.state]) continue;
      const base = `https://github.com/${ref.owner}/${ref.repo}/${ref.kind === 'pr' ? 'pull' : 'issues'}/${ref.number}`;
      due.set(ref.key, { url: base, kind: ref.kind });
    }
    for (const [key, { url, kind }] of [...due].slice(0, GITHUB_FETCH_LIMIT)) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) continue;
        const state = stateFromHtml(await res.text());
        if (state) await writeGithub(key, kind, state, Date.now());
      } catch {
        // Offline or blocked: try again next tick.
      }
    }
  } finally {
    refreshing = false;
  }
}

async function runRules(): Promise<void> {
  const [tabs, snap] = await Promise.all([chrome.tabs.query({}), loadSnapshot()]);
  const now = Date.now();
  const due = toItems(tabs, snap, now).filter((item) => dueRule(item, snap.rules, now));
  await closeTabs(due, 'rule');
}

/** Drops age and PR records for URLs that have not been open for a week. */
async function prune(): Promise<void> {
  // Right after a browser restart the tab list can still be filling in.
  if (Date.now() - startedAt < 10 * MINUTE) return;
  const [tabs, raw] = await Promise.all([chrome.tabs.query({}), chrome.storage.local.get(null)]);
  const urls = new Set(tabs.map((t) => normalizeUrl(t.url ?? '')));
  const keys = new Set(tabs.map((t) => (t.url ? parseGithubUrl(t.url)?.key : undefined)));
  const now = Date.now();
  const stale: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(OPENED) && !urls.has(key.slice(OPENED.length))) {
      if (now - (value as number) > PRUNE_AFTER) stale.push(key);
    } else if (key.startsWith(GITHUB) && !keys.has(key.slice(GITHUB.length))) {
      if (now - (value as { checkedAt: number }).checkedAt > PRUNE_AFTER) stale.push(key);
    }
  }
  if (stale.length) await chrome.storage.local.remove(stale);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tick') return;
  await refreshGithub();
  await runRules();
  await prune();
});

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message.type === 'refresh-github') void refreshGithub();
});

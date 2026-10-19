import type { Rules, TabItem } from './types';
import { groupKey } from './url';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DEFAULT_RULES: Rules = {
  mergedPr: { on: false, hours: 24 },
  closedPr: { on: false, hours: 24 },
  closedIssue: { on: false, hours: 72 },
  idle: { on: false, days: 14 },
  domains: [],
};

/** Pinned and audible tabs are never closed in bulk or by rules. */
export function isProtected(tab: Pick<TabItem, 'pinned' | 'audible'>): boolean {
  return tab.pinned || tab.audible;
}

/** The rule that closes this tab now, or null. Active tabs are left alone. */
export function dueRule(tab: TabItem, rules: Rules, now: number): string | null {
  if (isProtected(tab) || tab.active) return null;
  const gh = tab.github;
  if (gh) {
    const age = now - gh.since;
    if (gh.kind === 'pr' && gh.state === 'merged' && rules.mergedPr.on)
      if (age >= rules.mergedPr.hours * HOUR) return 'mergedPr';
    if (gh.kind === 'pr' && gh.state === 'closed' && rules.closedPr.on)
      if (age >= rules.closedPr.hours * HOUR) return 'closedPr';
    if (gh.kind === 'issue' && gh.state === 'closed' && rules.closedIssue.on)
      if (age >= rules.closedIssue.hours * HOUR) return 'closedIssue';
  }
  const idle = now - tab.lastAccessed;
  for (const d of rules.domains) {
    if (d.on && d.domain && tab.domain === groupKey(`https://${d.domain}`) && idle >= d.days * DAY)
      return `domain:${d.domain}`;
  }
  if (rules.idle.on && idle >= rules.idle.days * DAY) return 'idle';
  return null;
}

export type GithubKind = 'pr' | 'issue';
export type GithubState = 'open' | 'draft' | 'merged' | 'closed';

export interface GithubStatus {
  kind: GithubKind;
  state: GithubState;
  /** When this state was first seen. Auto-close delays count from here. */
  since: number;
  checkedAt: number;
}

export interface ProjectName {
  name: string;
  /** Set by the user; never overwritten from tab titles. */
  manual: boolean;
}

export interface TabItem {
  id: number;
  windowId: number;
  index: number;
  url: string;
  title: string;
  pinned: boolean;
  audible: boolean;
  active: boolean;
  discarded: boolean;
  lastAccessed: number;
  openedAt: number;
  /** Root domain, or a scheme such as `chrome://`. Orders groups and matches domain rules. */
  domain: string;
  /** Group key: host without `www.`, or `domain` for non-web pages and Vercel previews. */
  host: string;
  /** Project label for Supabase and Vercel tabs. */
  label?: string;
  /** Supabase project ref, when the label can be renamed. */
  supabaseRef?: string;
  github?: GithubStatus;
  /** Another tab with the same URL is kept instead of this one. */
  duplicate: boolean;
}

export interface ClosedEntry {
  url: string;
  title: string;
  windowId: number;
  index: number;
  closedAt: number;
  batch: string;
  reason: 'manual' | 'rule';
}

export interface SavedEntry {
  url: string;
  title: string;
  savedAt: number;
}

export interface AgeRule {
  on: boolean;
  hours: number;
}

export interface DomainRule {
  domain: string;
  days: number;
  on: boolean;
}

export interface Rules {
  mergedPr: AgeRule;
  closedPr: AgeRule;
  closedIssue: AgeRule;
  idle: { on: boolean; days: number };
  domains: DomainRule[];
}

export type TextOp =
  'exists' | 'missing' | 'is' | 'isNot' | 'contains' | 'notContains' | 'startsWith' | 'regex';

/** One-click close filter. Every set condition must match. */
export interface QuickFilter {
  id: string;
  name: string;
  /** Root domain; '' = any site. */
  domain: string;
  urlContains: string;
  titleContains: string;
  /** 0 = no idle condition. */
  idleDays: number;
  /** CSS selector checked on the live page; '' = none. */
  selector: string;
  textOp: TextOp;
  text: string;
  /** Shown as a chip in the action bar. */
  pinned: boolean;
}

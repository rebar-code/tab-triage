import type {
  ClosedEntry,
  GithubKind,
  GithubState,
  GithubStatus,
  ProjectName,
  QuickFilter,
  Rules,
  SavedEntry,
} from './types';
import { DEFAULT_FILTERS } from './filters';
import { DEFAULT_RULES } from './rules';

// One key per URL / PR / project so concurrent writers never clobber a shared map.
export const OPENED = 'opened:';
export const GITHUB = 'gh:';
export const SUPABASE = 'sb:';
export const CLOSED = 'closed';
export const SAVED = 'saved';
export const RULES = 'rules';
const FILTERS = 'filters';

export interface Snapshot {
  opened: Record<string, number>;
  github: Record<string, GithubStatus>;
  supabase: Record<string, ProjectName>;
  closed: ClosedEntry[];
  saved: SavedEntry[];
  rules: Rules;
  filters: QuickFilter[];
}

export function emptySnapshot(): Snapshot {
  return {
    opened: {},
    github: {},
    supabase: {},
    closed: [],
    saved: [],
    rules: structuredClone(DEFAULT_RULES),
    filters: structuredClone(DEFAULT_FILTERS),
  };
}

export function parseSnapshot(raw: Record<string, unknown>): Snapshot {
  const snap = emptySnapshot();
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(OPENED)) snap.opened[key.slice(OPENED.length)] = value as number;
    else if (key.startsWith(GITHUB)) snap.github[key.slice(GITHUB.length)] = value as GithubStatus;
    else if (key.startsWith(SUPABASE))
      snap.supabase[key.slice(SUPABASE.length)] = value as ProjectName;
  }
  snap.closed = (raw[CLOSED] as ClosedEntry[] | undefined) ?? [];
  snap.saved = (raw[SAVED] as SavedEntry[] | undefined) ?? [];
  snap.rules = { ...snap.rules, ...(raw[RULES] as Partial<Rules> | undefined) };
  snap.filters = (raw[FILTERS] as QuickFilter[] | undefined) ?? snap.filters;
  return snap;
}

export async function loadSnapshot(): Promise<Snapshot> {
  return parseSnapshot(await chrome.storage.local.get(null));
}

export async function writeGithub(
  key: string,
  kind: GithubKind,
  state: GithubState,
  now: number,
): Promise<void> {
  const k = GITHUB + key;
  const prev = (await chrome.storage.local.get(k))[k] as GithubStatus | undefined;
  const since = prev?.state === state ? prev.since : now;
  const next: GithubStatus = { kind, state, since, checkedAt: now };
  await chrome.storage.local.set({ [k]: next });
}

export async function writeSupabaseName(ref: string, name: ProjectName | null): Promise<void> {
  if (name) await chrome.storage.local.set({ [SUPABASE + ref]: name });
  else await chrome.storage.local.remove(SUPABASE + ref);
}

export async function writeRules(rules: Rules): Promise<void> {
  await chrome.storage.local.set({ [RULES]: rules });
}

export async function writeFilters(filters: QuickFilter[]): Promise<void> {
  await chrome.storage.local.set({ [FILTERS]: filters });
}

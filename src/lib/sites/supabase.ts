const PATH = /^\/dashboard\/project\/([a-z0-9]+)(?:\/|$)/;

export function parseSupabaseRef(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'supabase.com') return null;
    return PATH.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Studio surfaces. If one of these sits where the project should be, the
// project and org names were equal and Studio dropped the repeat.
const SURFACES = new Set([
  'advisors',
  'api docs',
  'authentication',
  'branches',
  'database',
  'edge functions',
  'home',
  'integrations',
  'logs',
  'observability',
  'project settings',
  'realtime',
  'reports',
  'settings',
  'sql editor',
  'storage',
  'table editor',
]);

/**
 * Studio titles are `entity | section | surface | project | org | Supabase`,
 * with empty parts and repeats of the previous part left out.
 */
export function projectFromTitle(title: string): string | null {
  const parts = title.split(' | ').map((p) => p.trim());
  if (parts.pop() !== 'Supabase') return null;
  if (parts.length === 1) return null;
  const project = parts[parts.length - 2];
  if (!project) return null;
  if (SURFACES.has(project.toLowerCase())) return parts[parts.length - 1] ?? null;
  return project;
}

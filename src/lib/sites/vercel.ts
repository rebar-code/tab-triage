// First path segments on vercel.com that are not team slugs.
const NOT_TEAMS = new Set([
  'account',
  'blog',
  'changelog',
  'contact',
  'customers',
  'dashboard',
  'docs',
  'enterprise',
  'guides',
  'home',
  'integrations',
  'legal',
  'login',
  'marketplace',
  'new',
  'pricing',
  'signup',
  'solutions',
  'templates',
]);

// Second segments under a team that are team pages, not projects.
const TEAM_PAGES = new Set([
  '~',
  'activity',
  'ai',
  'domains',
  'integrations',
  'logs',
  'monitoring',
  'observability',
  'settings',
  'storage',
  'support',
  'usage',
]);

/** Project name from a Vercel dashboard URL or a `*.vercel.app` deployment URL. */
export function vercelProject(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.hostname === 'vercel.com') {
    const [team, project] = u.pathname.split('/').filter(Boolean);
    if (!team || !project || NOT_TEAMS.has(team) || TEAM_PAGES.has(project)) return null;
    return project;
  }
  if (u.hostname.endsWith('.vercel.app')) {
    const sub = u.hostname.slice(0, -'.vercel.app'.length);
    const git = sub.indexOf('-git-');
    if (git > 0) return sub.slice(0, git);
    // <project>-<9-char hash>-<team>
    const hashed = /^(.+?)-[a-z0-9]{9}-[a-z0-9-]+$/.exec(sub);
    return hashed?.[1] ?? sub;
  }
  return null;
}

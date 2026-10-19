import { describe, expect, it } from 'vitest';
import { parseGithubUrl, stateFromHtml, stateFromStatus } from './github';
import { parseSupabaseRef, projectFromTitle } from './supabase';
import { vercelProject } from './vercel';

// Header labels as served by github.com (sveltejs/svelte, October 2026).
const label = (status: string): string =>
  `<div><span class="prc-StateLabel-StateLabel-Iawzp flex-self-start" data-component="StateLabel" data-size="medium" data-status="${status}"><svg></svg>Merged</span></div>`;

describe('github', () => {
  it('parses PR and issue URLs, including sub-pages', () => {
    expect(parseGithubUrl('https://github.com/Rebar/App/pull/12/files')).toMatchObject({
      kind: 'pr',
      number: 12,
      key: 'rebar/app#12',
    });
    expect(parseGithubUrl('https://github.com/a/b/issues/7#issuecomment-1')?.kind).toBe('issue');
    expect(parseGithubUrl('https://github.com/a/b/pulls')).toBeNull();
    expect(parseGithubUrl('https://gist.github.com/a/b/pull/1')).toBeNull();
  });

  it('maps StateLabel statuses', () => {
    expect(stateFromStatus('pullMerged')).toBe('merged');
    expect(stateFromStatus('draft')).toBe('draft');
    expect(stateFromStatus('pullOpened')).toBe('open');
    expect(stateFromStatus('pullClosed')).toBe('closed');
    expect(stateFromStatus('issueOpened')).toBe('open');
    expect(stateFromStatus('issueClosed')).toBe('closed');
    expect(stateFromStatus('issueClosedNotPlanned')).toBe('closed');
  });

  it('reads the first StateLabel from page HTML', () => {
    expect(stateFromHtml(label('pullMerged') + label('pullOpened'))).toBe('merged');
    expect(stateFromHtml(label('draft'))).toBe('draft');
    expect(stateFromHtml('<html>Sign in</html>')).toBeNull();
  });
});

describe('supabase', () => {
  it('reads the project ref', () => {
    expect(parseSupabaseRef('https://supabase.com/dashboard/project/abcxyz123/editor/1')).toBe(
      'abcxyz123',
    );
    expect(parseSupabaseRef('https://supabase.com/dashboard/projects')).toBeNull();
  });

  it('reads the project from Studio titles', () => {
    expect(projectFromTitle('users | Table Editor | Acme | Rebar | Supabase')).toBe('Acme');
    expect(projectFromTitle('Acme | Rebar | Supabase')).toBe('Acme');
    // Project and org share a name, so Studio drops the repeat.
    expect(projectFromTitle('Table Editor | Rebar | Supabase')).toBe('Rebar');
    expect(projectFromTitle('Rebar | Supabase')).toBeNull();
    expect(projectFromTitle('Supabase')).toBeNull();
    expect(projectFromTitle('Something else')).toBeNull();
  });
});

describe('vercel', () => {
  it('reads projects from dashboard and deployment URLs', () => {
    expect(vercelProject('https://vercel.com/rebar/acme/deployments')).toBe('acme');
    expect(vercelProject('https://vercel.com/rebar/settings')).toBeNull();
    expect(vercelProject('https://vercel.com/docs/functions')).toBeNull();
    expect(vercelProject('https://acme-git-feat-x-rebar.vercel.app/')).toBe('acme');
    expect(vercelProject('https://acme-a1b2c3d4e-rebar.vercel.app/')).toBe('acme');
    expect(vercelProject('https://acme.vercel.app/')).toBe('acme');
  });
});

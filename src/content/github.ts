// Reads the PR / issue state from the live page. GitHub navigates without
// reloading, so this watches the DOM instead of running once.
import { parseGithubUrl, stateFromDocument } from '../lib/sites/github';
import { writeGithub } from '../lib/storage';

let lastSeen = '';
let timer: ReturnType<typeof setTimeout> | undefined;

function check(): void {
  timer = undefined;
  const ref = parseGithubUrl(location.href);
  if (!ref) return;
  const state = stateFromDocument(document);
  if (!state) return;
  const seen = `${ref.key}:${state}`;
  if (seen === lastSeen) return;
  lastSeen = seen;
  void writeGithub(ref.key, ref.kind, state, Date.now());
}

function schedule(): void {
  timer ??= setTimeout(check, 1000);
}

new MutationObserver(schedule).observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['data-status'],
});
check();

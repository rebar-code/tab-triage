# tab-triage

## Deploy

Chrome loads the unpacked extension from `~/code/github/tab-triage/dist` (the primary checkout, not a worktree).

- After any commit or merge lands on `main`, run `pnpm build` in `~/code/github/tab-triage` with `main` checked out.
- Check the build output has no errors.
- Then tell the user to click reload on Tab Triage in `chrome://extensions`. Refreshing the panel does not load the new build.

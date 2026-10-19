# tab-triage v1

Chrome MV3 side-panel tab manager. No tokens in v1. Unpacked install.

Execution: inline. Milestones 1–2 set the data shape every reader uses; readers are small and follow.

## Milestones

- [ ] 1. Core panel: all windows, group by root domain then age, favicons, hover checkbox (left) + trash (right), shift-click range, bulk close, close group, undo, search, protect pinned/audible, shortcut
- [ ] 2. Tracking: record open time, group by last viewed, duplicates
- [ ] 3. GitHub: PR open/draft/merged/closed, closed issues; "Close merged PR tabs". Loaded tabs: content script. Unloaded tabs: background fetch with the browser's GitHub session
- [ ] 4. Supabase: one group, sub-group per project ref, name read from page and cached, manual rename. Vercel: one group, project label from URL, state from page when loaded
- [ ] 5. Save for later list
- [ ] 6. Auto-close rules: match + delay + on/off, all off by default, never protected tabs, every close goes to the undo log

## Verification

- Vitest: URL parsing, grouping, rules
- Playwright: load unpacked extension, select, bulk close, undo; screenshot of the panel

## v2

Tokens (GitHub/Vercel/Supabase APIs), state for all tabs, failing checks, review requested, "By project" grouping, Chrome tab-strip groups.

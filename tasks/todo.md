# tab-triage v1

Chrome MV3 side-panel tab manager. No tokens in v1. Unpacked install.

Execution: inline. Milestones 1–2 set the data shape every reader uses; readers are small and follow.

## Milestones

- [x] 1. Core panel: all windows, group by root domain then age, favicons, hover checkbox (left) + trash (right), shift-click range, bulk close, close group, undo, search, protect pinned/audible, shortcut
- [x] 2. Tracking: record open time, group by last viewed, duplicates
- [x] 3. GitHub: PR open/draft/merged/closed, closed issues; "Close merged PR tabs". Loaded tabs: content script. Unloaded tabs: background fetch with the browser's GitHub session
- [x] 4. Supabase: one group, sub-group per project ref, name read from page and cached, manual rename. Vercel: one group, project label from URL (deployment state moved to v2)
- [x] 5. Save for later list
- [x] 6. Auto-close rules: match + delay + on/off, all off by default, never protected tabs, every close goes to the undo log

## Verification

- Vitest: URL parsing, grouping, rules
- Playwright: load unpacked extension, select, bulk close, undo; screenshot of the panel

## To check by hand

- Background PR fetch on private repos uses the browser's GitHub login; e2e cannot cover it
- Supabase names on real Studio tabs

## v2

Vercel deployment state.
Tokens (GitHub/Vercel/Supabase APIs), state for all tabs, failing checks, review requested, "By project" grouping, Chrome tab-strip groups.

## Quick filters (branch `feat/quick-filters`)

Picked design: F (filter menu left of search + pinned split chips). Execution: inline; one shared `QuickFilter` type.

- [ ] Shortcut row in Settings (`chrome.commands.getAll`, Change opens `chrome://extensions/shortcuts`)
- [ ] Search box focused and its kept text selected on open
- [ ] `QuickFilter` data + matching (`src/lib/filters.ts`): site, URL, title, not viewed, element + text op (exists, is missing, is, is not, contains, doesn't contain, starts with, regex)
- [ ] Page check with `chrome.scripting` on loaded tabs; per-site optional host permission; "No access" state
- [ ] Filter menu: pin, show (blue), close (red), edit; "+ Filter"; Esc / icon / outside click close it
- [ ] Pinned filters as split chips: name shows, trash closes; right-click edits
- [ ] Filters view with X; Settings section "Filters"
- [ ] Element picker (was out of scope; added after the prototype review)
- [ ] Unit + e2e tests, screenshots

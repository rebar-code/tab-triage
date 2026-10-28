# Chrome Web Store listing

Paste these into the Developer Dashboard. Images are in this folder.

## Store listing

**Name:** Tab Triage (from the manifest)

**Summary** (manifest description, max 132 chars):
Group, sort and bulk-close tabs. Knows when your PRs merged.

**Category:** Tools

**Language:** English

**Description:**

Too many tabs? Tab Triage puts every open tab in a side panel, grouped by site, so you can see what you have and close what you are done with.

- Group by site or by last viewed. Search across every window.
- Select with click, Shift-click or Cmd-click, then close in one go.
- GitHub pull requests show their state. One click closes every merged PR tab.
- One click closes duplicate tabs.
- Filters close tabs by site, URL, title, days not viewed, or text on the page. Pin a filter to keep it as a button.
- Save tabs for later. Optional rules close stale tabs for you.
- Cmd-Z puts closed tabs back.

Open it with the toolbar icon or Alt+Shift+T.

Private by design: no servers, no analytics. Everything stays in your browser. Open source (MIT): https://github.com/rebar-code/tab-triage

**Images:** `icon-128.png` (store icon, from `public/icons/`), `screenshot-1.png` and `screenshot-2.png` (1280x800), `promo-small.png` (440x280).

**Homepage URL:** https://github.com/rebar-code/tab-triage
**Support URL:** https://github.com/rebar-code/tab-triage/issues

## Privacy practices

**Single purpose:**
Helps the user review, group and close their open browser tabs from a side panel.

**Permission justifications:**

- **tabs:** Lists every open tab's title and URL so the panel can group, search, sort and close them.
- **storage:** Keeps the user's settings, saved tabs, filters and cached PR states on their computer.
- **sidePanel:** The whole interface is a Chrome side panel.
- **alarms:** Every 5 minutes, refreshes GitHub PR states and runs the user's optional auto-close rules.
- **favicon:** Shows each tab's site icon in the list.
- **scripting:** When the user saves a filter that matches text on a page, reads that page's text to decide whether the tab matches. Runs only on sites the user grants.
- **Host permission (https://github.com/\*):** Loads open GitHub pull request and issue pages to read whether they are open, merged or closed.
- **Optional host permissions (all sites):** Requested at runtime, one site at a time, only when the user saves a page-text filter for that site.

**Remote code:** No, I am not using remote code. All JavaScript ships in the package.

**Data usage:** Collects none of the listed data types. Tab URLs, titles and page text are processed only in the browser and never transmitted. Tick the three certifications (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://github.com/rebar-code/tab-triage/blob/main/PRIVACY.md

## Distribution

**Visibility:** Public. **Regions:** All regions. **Pricing:** Free.

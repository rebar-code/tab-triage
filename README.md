# Tab Triage

Chrome side panel that groups every tab by site, shows GitHub PR state, and closes tabs in bulk.

- Group by site or by last viewed; search; select with click, Shift-click or Cmd-click.
- One click closes merged PRs or duplicates. Cmd-Z puts closed tabs back.
- Filters close tabs by site, URL, title, days not viewed, or text on the page. Pin a filter to keep it as a button.
- Save tabs for later; optional auto-close rules.

## Install

Tab Triage is not in the Chrome Web Store. You build it and load it yourself.

You need Chrome 121 or newer, [Node.js](https://nodejs.org) 22 or newer, and Git.

1. Get the code and build it:

   ```bash
   git clone https://github.com/rebar-code/tab-triage.git
   cd tab-triage
   corepack enable
   pnpm install
   pnpm build
   ```

2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `dist` folder inside `tab-triage`.
4. Open the panel with the toolbar icon or `Alt+Shift+T`.

To change the shortcut, open `chrome://extensions/shortcuts`, or use **Settings → Shortcut** in the panel.

## Update

```bash
git pull
pnpm install
pnpm build
```

Then click the reload icon on the Tab Triage card in `chrome://extensions`. Reopening the panel does not load a new build.

## Permissions

- **Tabs, storage, side panel, alarms, favicon:** to list, group and close tabs, and keep your settings on this computer.
- **github.com:** to read PR state from your open GitHub tabs.
- **Scripting, and other sites only when you ask:** a filter that checks text on a page asks Chrome for access to that site when you save it. The page text is read in your browser and is not sent anywhere.

## Develop

- `pnpm dev` rebuilds on change; click reload on the extension card.
- `pnpm test` runs unit tests; `pnpm e2e` runs Playwright against the built extension.
- `pnpm icons` renders the icon PNGs from `public/icons/icon.svg`.

## License

[MIT](LICENSE)

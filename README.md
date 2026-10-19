# Tab Triage

Chrome side panel that groups every tab by root domain, shows GitHub PR state, and bulk-closes.

## Install (unpacked)

```bash
pnpm install
pnpm build
```

Open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, pick `dist/`.
Chrome asks for access to all sites: the hover preview screenshots the visible tab.
Open with the toolbar icon or `Alt+Shift+T` (change it at `chrome://extensions/shortcuts`).

## Develop

- `pnpm dev` rebuilds on change; click reload on the extension card.
- `pnpm test` unit tests, `pnpm e2e` Playwright against the built extension.

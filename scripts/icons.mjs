// Renders public/icons/icon.svg to the PNG sizes Chrome uses. Run after editing the SVG:
// pnpm icons
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../public/icons');
const svg = await readFile(path.join(dir, 'icon.svg'), 'utf8');
const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0"><img src="${src}" width="${size}" height="${size}"></body>`,
  );
  await page.screenshot({ path: path.join(dir, `icon-${size}.png`), omitBackground: true });
  await page.close();
}
await browser.close();

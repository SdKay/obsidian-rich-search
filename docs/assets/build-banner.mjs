// Renders docs/banner.png from docs/assets/banner.html with Playwright's bundled Chromium.
// Run: node docs/assets/build-banner.mjs   (after `npx playwright install chromium` once)
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 320 } });
await page.goto('file://' + path.join(here, 'banner.html'));
await page.screenshot({ path: path.join(here, '..', 'banner.png') });
await browser.close();
console.log('wrote docs/banner.png');

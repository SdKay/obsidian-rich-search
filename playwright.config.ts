import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Browser tests for DOM and layout behaviour that vitest cannot see. One folder per issue or
// feature under test/e2e/issues/<name>/, shared helpers in test/e2e/common/. Not part of
// `npm run build` or `npm test`: run `npm run test:e2e` before a release.
//
// Run with --workers=1 and in batches by folder; the whole suite in parallel can exhaust memory.
//
// Everything runs at two devicePixelRatios. Obsidian is used on HiDPI laptops and on Windows
// with display scaling, where a hairline lands on a fractional device pixel and can vanish.
// 1.5 rather than 2: an integer ratio maps each CSS pixel onto whole device pixels and so
// misses exactly the rounding cases this exists to cover.
export default defineConfig({
	testDir: './test/e2e',
	fullyParallel: true,
	reporter: 'list',
	globalSetup: path.join(__dirname, 'test/e2e/common/global-setup.ts'),
	use: { trace: 'retain-on-failure' },
	projects: [
		{ name: 'dpr1', use: { deviceScaleFactor: 1 } },
		{ name: 'dpr1.5', use: { deviceScaleFactor: 1.5 } },
	],
});

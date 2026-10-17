import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(__dirname, 'real-bundle.generated.js');

type RichSearchReal = typeof import('./real-bundle-entry');
declare global {
	interface Window { RichSearchReal: RichSearchReal }
}

/** `loadReal`: opens a blank page with the real bundle on window.RichSearchReal. */
export const test = base.extend<{ loadReal: () => Promise<void> }>({
	loadReal: async ({ page }, use) => {
		await use(async () => {
			await page.setContent('<!doctype html><html><body></body></html>');
			await page.addScriptTag({ content: fs.readFileSync(bundle, 'utf8') });
		});
	},
});

export { expect };

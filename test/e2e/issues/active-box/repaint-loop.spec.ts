import { test, expect } from '../../common/test-base';

const PAGE = '<div id="sizer"><div><p id="p1">Both the DCF and PCF shall coexist</p><p>second DCF here, and DCF again</p></div></div>';

declare global {
	interface Window { __wired: { calls: () => number; late: () => void } }
}

/**
 * The page is watched for changes and painted on each one, the way main.ts does it. `dropOwnRecords` is the
 * step that stops the plugin's own box from being seen as a change; the test with it off shows what happens without.
 */
async function wire(page: import('@playwright/test').Page, dropOwnRecords: boolean): Promise<void> {
	await page.evaluate((drop) => {
		const sizer = document.getElementById('sizer')!;
		const opened = { path: 'a.md', text: 'Both the DCF and PCF shall coexist', index: 0 };
		let calls = 0;
		let queued = false;
		const observer = new MutationObserver(() => repaint());
		const run = (): void => {
			calls++;
			window.RichSearchReal.paintPage([{ kind: 'reading', path: 'a.md', root: sizer }], { query: 'DCF' }, opened);
			if (drop) observer.takeRecords();
		};
		const repaint = (): void => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => { queued = false; run(); });
		};
		observer.observe(sizer, { childList: true, subtree: true });
		window.__wired = {
			calls: () => calls,
			late: () => { const p = document.createElement('p'); p.textContent = 'late DCF section'; sizer.firstElementChild!.appendChild(p); },
		};
		repaint();
	}, dropOwnRecords);
}

const settle = (page: import('@playwright/test').Page, ms = 500) => page.waitForTimeout(ms);

test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	await page.setContent(PAGE);
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
});

test('paints once and then stays quiet, so the box does not flicker', async ({ page }) => {
	await wire(page, true);
	await settle(page, 800);
	expect(await page.evaluate(() => window.__wired.calls())).toBe(1);
	expect(await page.evaluate(() => document.querySelectorAll('.rs-active-box').length)).toBe(1);
});

test('keeps the box, once, after the page really changes', async ({ page }) => {
	await wire(page, true);
	await settle(page);
	await page.evaluate(() => window.__wired.late());
	await settle(page);
	expect(await page.evaluate(() => window.__wired.calls())).toBe(2);
	expect(await page.evaluate(() => document.querySelectorAll('.rs-active-box').length)).toBe(1);
	expect(await page.evaluate(() => document.getElementById('p1')!.textContent)).toBe('Both the DCF and PCF shall coexist');
});

test('without dropping its own records the page is painted again and again', async ({ page }) => {
	await wire(page, false);
	await settle(page, 800);
	expect(await page.evaluate(() => window.__wired.calls())).toBeGreaterThan(10);
});

test('takes the box away when the opened match is no longer on this page', async ({ page }) => {
	const boxes = await page.evaluate(() => {
		const sizer = document.getElementById('sizer')!;
		const sources = [{ kind: 'reading' as const, path: 'a.md', root: sizer }];
		const query = { query: 'DCF' };
		window.RichSearchReal.paintPage(sources, query, { path: 'a.md', text: 'Both the DCF and PCF shall coexist', index: 0 });
		const drawn = document.querySelectorAll('.rs-active-box').length;
		window.RichSearchReal.paintPage(sources, query, { path: 'b.md', text: 'elsewhere', index: 0 });
		return [drawn, document.querySelectorAll('.rs-active-box').length];
	});
	expect(boxes).toEqual([1, 0]);
});

test('takes the box away when the search is cleared', async ({ page }) => {
	const boxes = await page.evaluate(() => {
		const sizer = document.getElementById('sizer')!;
		const sources = [{ kind: 'reading' as const, path: 'a.md', root: sizer }];
		window.RichSearchReal.paintPage(sources, { query: 'DCF' }, { path: 'a.md', text: 'Both the DCF and PCF shall coexist', index: 0 });
		window.RichSearchReal.paintPage(sources, null, null);
		return document.querySelectorAll('.rs-active-box').length;
	});
	expect(boxes).toBe(0);
});

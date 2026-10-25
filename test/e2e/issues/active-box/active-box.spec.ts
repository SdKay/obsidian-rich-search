import { test, expect } from '../../common/test-base';

const PAGE = '<div id="r"><p id="a">Both the DCF and PCF</p><p id="b">second DCF here</p></div>';

test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	await page.setContent(PAGE);
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
});

/** Boxes the characters [start, end) of a paragraph's text and returns what the page looks like. */
const box = (page: import('@playwright/test').Page, id: string, start: number, end: number) => page.evaluate(([i, s, e]) => {
	const t = document.getElementById(i as string)!.firstChild!;
	const range = new Range();
	range.setStart(t, s as number);
	range.setEnd(t, e as number);
	window.RichSearchReal.boxRange(range);
	return { boxes: document.querySelectorAll('.rs-active-box').length, text: document.querySelector('.rs-active-box')?.textContent ?? null };
}, [id, start, end]);

test('boxes exactly the matched word', async ({ page }) => {
	expect(await box(page, 'a', 9, 12)).toEqual({ boxes: 1, text: 'DCF' });
});

test('keeps one box: boxing another match removes the first', async ({ page }) => {
	await box(page, 'a', 9, 12);
	expect(await box(page, 'b', 7, 10)).toEqual({ boxes: 1, text: 'DCF' });
	expect(await page.evaluate(() => document.getElementById('a')!.childNodes.length)).toBe(1);
});

test('leaves the page exactly as it was once the box is cleared, at the start and the end of a text node too', async ({ page }) => {
	const before = await page.evaluate(() => document.getElementById('r')!.innerHTML);
	for (const [s, e] of [[9, 12], [0, 4], [15, 18]] as const) {
		await box(page, 'a', s, e);
		await page.evaluate(() => window.RichSearchReal.clearBox());
		expect(await page.evaluate(() => document.getElementById('r')!.innerHTML)).toBe(before);
	}
});

test('clearing twice is harmless', async ({ page }) => {
	await box(page, 'a', 9, 12);
	await page.evaluate(() => { window.RichSearchReal.clearBox(); window.RichSearchReal.clearBox(); });
	expect(await page.evaluate(() => document.querySelectorAll('.rs-active-box').length)).toBe(0);
});

test('does not box a match that runs across two text nodes', async ({ page }) => {
	const boxes = await page.evaluate(() => {
		const range = new Range();
		range.setStart(document.getElementById('a')!.firstChild!, 3);
		range.setEnd(document.getElementById('b')!.firstChild!, 3);
		window.RichSearchReal.boxRange(range);
		return document.querySelectorAll('.rs-active-box').length;
	});
	expect(boxes).toBe(0);
});

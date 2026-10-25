import { test, expect } from '../../common/test-base';

test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
});

/** Opens a line of a reading page and reports the box: how many there are, and the text before it in its paragraph. */
async function open(page: import('@playwright/test').Page, html: string, line: string, index: number) {
	await page.setContent(`<div id="sizer">${html}</div>`);
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
	return page.evaluate(([l, i]) => {
		const sizer = document.getElementById('sizer')!;
		window.RichSearchReal.paintPage([{ kind: 'reading', path: 'a.md', root: sizer, note: l as string }], { query: (l as string).includes('license') ? '芯片' : 'DCF' }, { path: 'a.md', text: l as string, index: i as number, line: 0, column: (l as string).indexOf((l as string).includes('license') ? '芯片' : 'DCF') });
		const box = document.querySelector('.rs-active-box');
		return { boxes: document.querySelectorAll('.rs-active-box').length, before: box?.previousSibling?.textContent ?? null, marks: (() => { let n = 0; CSS.highlights.get('rs-match')?.forEach(() => { n++; }); return n; })() };
	}, [line, index]);
}

test('boxes the first of two matches in a paragraph', async ({ page }) => {
	const r = await open(page, '<p>the DCF and the DCF again</p>', 'the DCF and the DCF again', 0);
	expect(r).toMatchObject({ boxes: 1, before: 'the ' });
});

test('boxes the second when the second is the opened one', async ({ page }) => {
	const r = await open(page, '<p>the DCF and the DCF again</p>', 'the DCF and the DCF again', 1);
	expect(r).toMatchObject({ boxes: 1, before: 'the DCF and the ' });
});

test('boxes a match in a paragraph that has formatting around the matches', async ({ page }) => {
	const r = await open(page, '<p>the <strong>DCF</strong> and the <em>DCF</em> again</p>', 'the **DCF** and the *DCF* again', 0);
	expect(r.boxes).toBe(1);
});

test('boxes a match in a list item with two matches', async ({ page }) => {
	const r = await open(page, '<ul><li>one DCF and two DCF</li></ul>', '- one DCF and two DCF', 0);
	expect(r).toMatchObject({ boxes: 1, before: 'one ' });
});

test('boxes a match in a line that continues a paragraph, as in the note that was reported', async ({ page }) => {
	// Two source lines, the second indented, are one paragraph on the page; the line break is a real "\n" in the text.
	const html = '<p>设备绑定\nlicense 只能给某颗芯片或某类芯片使用，不能跨设备复用。</p>';
	const r = await open(page, html, '   license 只能给某颗芯片或某类芯片使用，不能跨设备复用。', 0);
	expect(r).toMatchObject({ boxes: 1 });
	expect(r.before).toBe('设备绑定\nlicense 只能给某颗');
});

test('boxes the second match of such a line when the second is the opened one', async ({ page }) => {
	const html = '<p>设备绑定\nlicense 只能给某颗芯片或某类芯片使用，不能跨设备复用。</p>';
	const r = await open(page, html, '   license 只能给某颗芯片或某类芯片使用，不能跨设备复用。', 1);
	expect(r.before).toBe('设备绑定\nlicense 只能给某颗芯片或某类');
});

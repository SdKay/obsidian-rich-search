import { test, expect } from '../../common/test-base';

// Reading view draws a Markdown table as a plain HTML table: every cell is a block of its own.
const SOURCE = ['| 项目 | DCF 说明 |', '| --- | --- |', '| a | DCF and DCF |', '', '| 项目 | DCF 说明 |', '| --- | --- |', '| b | other DCF |'];
const PAGE = `<div id="sizer"><div><table><thead><tr><th>项目</th><th>DCF 说明</th></tr></thead><tbody><tr><td>a</td><td>DCF and DCF</td></tr></tbody></table></div>
<div><table><thead><tr><th>项目</th><th>DCF 说明</th></tr></thead><tbody><tr><td>b</td><td>other DCF</td></tr></tbody></table></div></div>`;

test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	await page.setContent(PAGE);
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
});

/** Opens a line of the note in the page and reports where the box went: which table, which row of it, which cell, and the text before it. */
async function open(page: import('@playwright/test').Page, line: number, which: 'first' | 'last' = 'first') {
	return page.evaluate(([l, w, src]) => {
		const source = (src as string[])[l as number]!;
		const column = w === 'first' ? source.indexOf('DCF') : source.lastIndexOf('DCF');
		const sizer = document.getElementById('sizer')!;
		window.RichSearchReal.paintPage([{ kind: 'reading', path: 'a.md', root: sizer, note: (src as string[]).join('\n') }], { query: 'DCF' }, { path: 'a.md', text: source, index: 0, line: l as number, column });
		const box = document.querySelector('.rs-active-box');
		const cell = box?.closest('td, th');
		return {
			boxes: document.querySelectorAll('.rs-active-box').length,
			table: box ? Array.from(sizer.querySelectorAll('table')).indexOf(box.closest('table')!) : null,
			inHead: box ? box.closest('thead') !== null : null,
			cell: cell ? Array.from(cell.parentElement!.children).indexOf(cell) : null,
			before: box?.previousSibling?.textContent ?? null,
		};
	}, [line, which, SOURCE]);
}

test('boxes the match in a header cell when the header identifies the table', async ({ page }) => {
	await page.setContent('<div id="sizer"><div><table><thead><tr><th>项目</th><th>DCF 说明</th></tr></thead><tbody><tr><td>a</td><td>x</td></tr></tbody></table></div></div>');
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
	expect(await open(page, 0)).toMatchObject({ boxes: 1, table: 0, inHead: true, cell: 1 });
});

test('boxes nothing for a header shared by two tables, since it cannot tell which one was opened', async ({ page }) => {
	expect((await open(page, 0)).boxes).toBe(0);
});

test('boxes the match in the right cell of a body row', async ({ page }) => {
	expect(await open(page, 2)).toMatchObject({ boxes: 1, table: 0, inHead: false, cell: 1, before: '' });
});

test('boxes the second match of a cell when the opened match is the second', async ({ page }) => {
	const second = await page.evaluate((src) => {
		const source = (src as string[])[2]!;
		const sizer = document.getElementById('sizer')!;
		window.RichSearchReal.paintPage([{ kind: 'reading', path: 'a.md', root: sizer, note: (src as string[]).join('\n') }], { query: 'DCF' }, { path: 'a.md', text: source, index: 1, line: 2, column: source.indexOf('DCF') });
		return document.querySelector('.rs-active-box')?.previousSibling?.textContent ?? null;
	}, SOURCE);
	expect(second).toBe('DCF and ');
});

test('tells two tables apart by the whole row, not by one cell', async ({ page }) => {
	// The same header sits in both tables; the body rows differ.
	expect(await open(page, 6)).toMatchObject({ boxes: 1, table: 1, inHead: false, cell: 1 });
});

test('boxes nothing for a row that is not on this page', async ({ page }) => {
	await page.setContent('<div id="sizer"><p>nothing here, just DCF</p></div>');
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
	expect((await open(page, 2)).boxes).toBe(0);
});

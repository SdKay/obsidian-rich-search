import { test, expect } from '../../common/test-base';

// A note with one table, and the Live Preview widget Obsidian draws for it (.cm-table-widget > table > tr > th/td > .table-cell-wrapper).
const NOTE = ['intro', '', '| 项目 | DCF 说明 | DCF 备注 |', '| --- | --- | --- |', '| a | DCF and DCF | b |', '', 'outro'].join('\n');
const WIDGET = `<div id="root"><div class="cm-table-widget"><table class="table-editor"><thead><tr>
<th><div class="table-cell-wrapper">项目</div></th><th><div class="table-cell-wrapper">DCF 说明</div></th><th><div class="table-cell-wrapper">DCF 备注</div></th></tr></thead>
<tbody><tr><td><div class="table-cell-wrapper">a</div></td><td><div class="table-cell-wrapper">DCF and DCF</div></td><td><div class="table-cell-wrapper">b</div></td></tr></tbody></table></div></div>`;

test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	await page.setContent(WIDGET);
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
});

/** Paints the note's table with the given opened line and column, and says which cell holds the box and what it boxes. */
async function open(page: import('@playwright/test').Page, line: number, column: number) {
	return page.evaluate(([l, c]) => {
		const root = document.getElementById('root')!;
		window.RichSearchReal.paintPage([{ kind: 'editor', path: 'a.md', note: (document.body.dataset.note ?? ''), root }], { query: 'DCF' }, { path: 'a.md', text: '', index: 0, line: l as number, column: c as number });
		const box = document.querySelector('.rs-active-box');
		const cell = box?.closest('td, th');
		return { boxes: document.querySelectorAll('.rs-active-box').length, boxed: box?.textContent ?? null, cellText: cell?.textContent ?? null, cellIndex: cell ? Array.from(cell.parentElement!.children).indexOf(cell) : null, before: box?.previousSibling?.textContent ?? null };
	}, [line, column]);
}

test.beforeEach(async ({ page }) => {
	await page.evaluate((note) => { document.body.dataset.note = note; }, NOTE);
});

test('boxes the match in the header cell the opened line points at', async ({ page }) => {
	const row = NOTE.split('\n')[2]!;
	expect(await open(page, 2, row.indexOf('DCF'))).toMatchObject({ boxes: 1, boxed: 'DCF', cellIndex: 1 });
});

test('boxes the match in the right cell of a body row, and the right one of two in a cell', async ({ page }) => {
	const row = NOTE.split('\n')[4]!;
	expect(await open(page, 4, row.indexOf('DCF'))).toMatchObject({ boxes: 1, cellIndex: 1 });
	// "DCF and DCF": the text before the first match is empty, before the second it is "DCF and ".
	expect((await open(page, 4, row.indexOf('DCF'))).before).toBe('');
	const second = await open(page, 4, row.lastIndexOf('DCF'));
	expect(second).toMatchObject({ boxes: 1, boxed: 'DCF', cellIndex: 1, before: 'DCF and ' });
});

test('boxes nothing when the opened line is not a row of this table', async ({ page }) => {
	expect(await open(page, 0, 0)).toMatchObject({ boxes: 0 });
});

test('boxes only the opened row when other rows have a match at the same column', async ({ page }) => {
	const note = ['| h | DCF |', '| --- | --- |', '| a | DCF |', '| b | DCF |'].join('\n');
	await page.setContent(`<div id="root"><div class="cm-table-widget"><table class="table-editor"><thead><tr>
<th><div class="table-cell-wrapper">h</div></th><th><div class="table-cell-wrapper">DCF</div></th></tr></thead><tbody>
<tr><td><div class="table-cell-wrapper">a</div></td><td><div class="table-cell-wrapper">DCF</div></td></tr>
<tr><td><div class="table-cell-wrapper">b</div></td><td><div class="table-cell-wrapper">DCF</div></td></tr></tbody></table></div></div>`);
	const result = await page.evaluate(([n]) => {
		const root = document.getElementById('root')!;
		const column = (n as string).split('\n')[3]!.indexOf('DCF');
		window.RichSearchReal.paintPage([{ kind: 'editor', path: 'a.md', note: n as string, root }], { query: 'DCF' }, { path: 'a.md', text: '', index: 0, line: 3, column });
		const rows = Array.from(document.querySelectorAll('tr'));
		return rows.map((r) => r.querySelectorAll('.rs-active-box').length);
	}, [note]);
	// header, first body row, second body row: only the opened line (3) is the second body row.
	expect(result).toEqual([0, 0, 1]);
});

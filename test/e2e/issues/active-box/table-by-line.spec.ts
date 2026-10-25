import { test, expect } from '../../common/test-base';

// Four tables in a note; Live Preview draws only the last two, as it does for the ones near the view.
const LINES = [
	'| a1 | DCF |', '| - | - |', '| 1 | x |', '',
	'| a2 | DCF |', '| - | - |', '| 2 | x |', '',
	'| a3 | DCF |', '| - | - |', '| 3 | DCF |', '',
	'| a4 | DCF |', '| - | - |', '| 4 | DCF |',
];
const NOTE = LINES.join('\n');

/** The widget of a table as Live Preview draws it. */
const widgetHtml = (rows: [string, string][]): string => `<div class="cm-table-widget"><table class="table-editor"><thead><tr>
<th><div class="table-cell-wrapper">${rows[0]![0]}</div></th><th><div class="table-cell-wrapper">${rows[0]![1]}</div></th></tr></thead><tbody>
${rows.slice(1).map(([a, b]) => `<tr><td><div class="table-cell-wrapper">${a}</div></td><td><div class="table-cell-wrapper">${b}</div></td></tr>`).join('')}</tbody></table></div>`;

test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	// Only the third and fourth tables are drawn. Their lines in the note are 8 and 12; the page knows that through lineOf.
	await page.setContent(`<div id="root">${widgetHtml([['a3', 'DCF'], ['3', 'DCF']])}${widgetHtml([['a4', 'DCF'], ['4', 'DCF']])}</div>`);
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
	await page.evaluate(() => {
		document.getElementById('root')!.querySelectorAll('.cm-table-widget').forEach((w, i) => { (w as HTMLElement).dataset.startLine = String([8, 12][i]); });
	});
});

/** Paints with widgets matched by the line they report, and says which cells were boxed and how many were marked. */
async function paint(page: import('@playwright/test').Page, opened: { line: number; column: number } | null, byLine: boolean) {
	return page.evaluate(([o, useLine, note]) => {
		const root = document.getElementById('root')!;
		const lineOf = useLine ? (w: Element) => Number((w as HTMLElement).dataset.startLine) : undefined;
		const highlighted: number[] = [];
		window.RichSearchReal.paintPage(
			[{ kind: 'editor', path: 'a.md', note: note as string, root, ...(lineOf ? { lineOf } : {}) }],
			{ query: 'DCF' },
			o ? { path: 'a.md', text: '', index: 0, line: (o as { line: number }).line, column: (o as { column: number }).column } : null,
		);
		const hl = CSS.highlights.get('rs-match');
		hl?.forEach((r) => highlighted.push(1));
		const box = document.querySelector('.rs-active-box');
		return { marks: highlighted.length, boxes: document.querySelectorAll('.rs-active-box').length, widget: box ? Array.from(root.children).indexOf(box.closest('.cm-table-widget')!) : null, tr: box ? Array.from(box.closest('tbody, thead')!.children).indexOf(box.closest('tr')!) : null };
	}, [opened, byLine, NOTE]);
}

test('boxes the match in the table the opened line is in, though that table is not the first one drawn', async ({ page }) => {
	// The fourth table's body row is line 14; its DCF is at column 7. It is the SECOND widget on the page, but the fourth table of the note.
	const col = LINES[14]!.indexOf('DCF');
	expect(await paint(page, { line: 14, column: col }, true)).toMatchObject({ boxes: 1, widget: 1 });
});

test('marks only the tables that are drawn, each by its own rows', async ({ page }) => {
	expect((await paint(page, null, true)).marks).toBe(4);
});

test('without lineOf the widgets are taken as the first tables, which is wrong for the opened one', async ({ page }) => {
	const col = LINES[14]!.indexOf('DCF');
	// The fallback pairs widget 1 with table 1 of the note, whose rows are 4..6, so line 14 is not found.
	expect((await paint(page, { line: 14, column: col }, false)).boxes).toBe(0);
});

test('draws nothing for a widget whose line is not the start of a table', async ({ page }) => {
	await page.evaluate(() => { document.querySelectorAll<HTMLElement>('.cm-table-widget').forEach((w) => { w.dataset.startLine = '3'; }); });
	expect((await paint(page, null, true)).marks).toBe(0);
});

test('draws nothing for a widget the editor cannot place, rather than guessing which table it is', async ({ page }) => {
	const marks = await page.evaluate((note) => {
		const root = document.getElementById('root')!;
		window.RichSearchReal.paintPage([{ kind: 'editor', path: 'a.md', note, root, lineOf: () => undefined }], { query: 'DCF' }, null);
		let n = 0;
		CSS.highlights.get('rs-match')?.forEach(() => { n++; });
		return n;
	}, NOTE);
	expect(marks).toBe(0);
});

test('scrolls to the cell in the table the opened line is in, not in the n-th widget', async ({ page }) => {
	const col = LINES[14]!.indexOf('DCF');
	const scrolled = await page.evaluate(([note, column]) => {
		const root = document.getElementById('root')!;
		const asked: string[] = [];
		root.querySelectorAll('td, th').forEach((c) => {
			(c as HTMLElement).scrollIntoView = function () { asked.push(`${Array.from(root.children).indexOf(this.closest('.cm-table-widget')!)}:${this.textContent}`); };
		});
		const lineOf = (w: Element) => Number((w as HTMLElement).dataset.startLine);
		window.RichSearchReal.scrollToTableHit(root, note as string, 14, { query: 'DCF' }, lineOf);
		return { asked, column };
	}, [NOTE, col]);
	expect(scrolled.asked).toEqual(['1:DCF']);
});

test('does not scroll when the widget of the opened table is not drawn', async ({ page }) => {
	const asked = await page.evaluate((note) => {
		const root = document.getElementById('root')!;
		const log: string[] = [];
		root.querySelectorAll('td, th').forEach((c) => { (c as HTMLElement).scrollIntoView = () => { log.push('scrolled'); }; });
		const lineOf = (w: Element) => Number((w as HTMLElement).dataset.startLine);
		// Line 2 is in the first table of the note, whose widget is not on the page.
		window.RichSearchReal.scrollToTableHit(root, note, 2, { query: 'DCF' }, lineOf);
		return log;
	}, NOTE);
	expect(asked).toEqual([]);
});

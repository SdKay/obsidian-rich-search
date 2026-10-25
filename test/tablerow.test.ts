import { describe, it, expect } from 'vitest';
import { splitRow, isDelimiterRow, tableAt, tableNumber, tablesOf, cellAtColumn, tableStartingAt } from '../src/tablerow';

describe('splitRow', () => {
	it('splits a row into cells with their text range, excluding the pipes and the padding spaces', () => {
		expect(splitRow('| a | bb | c |')).toEqual([
			{ index: 0, from: 2, to: 3, text: 'a' },
			{ index: 1, from: 6, to: 8, text: 'bb' },
			{ index: 2, from: 11, to: 12, text: 'c' },
		]);
	});

	it('accepts a row without the outer pipes', () => {
		expect(splitRow('a | b').map((c) => c.text)).toEqual(['a', 'b']);
	});

	it('keeps an empty cell', () => {
		const cells = splitRow('| a |  | c |');
		expect(cells.map((c) => c.text)).toEqual(['a', '', 'c']);
		const empty = cells[1]!;
		expect(empty.from).toBe(empty.to);
		expect(empty.from).toBeGreaterThan(4);
		expect(empty.from).toBeLessThanOrEqual(7);
	});

	it('does not split on an escaped pipe, and keeps the backslash in the text', () => {
		expect(splitRow('| a \\| b | c |').map((c) => c.text)).toEqual(['a \\| b', 'c']);
	});

	it('splits on a pipe inside a code span, as GFM does: only a backslash keeps it in the cell', () => {
		expect(splitRow('| `a|b` | c |').map((c) => c.text)).toEqual(['`a', 'b`', 'c']);
		expect(splitRow('| `a\\|b` | c |').map((c) => c.text)).toEqual(['`a\\|b`', 'c']);
	});

	it('counts offsets in UTF-16 units, so Chinese text lines up', () => {
		const cells = splitRow('| 文档 | Visio |');
		expect(cells[0]).toMatchObject({ from: 2, to: 4, text: '文档' });
		expect(cells[1]).toMatchObject({ from: 7, to: 12, text: 'Visio' });
	});

	it('returns nothing for a line that is not a table row', () => {
		expect(splitRow('just text')).toEqual([]);
		expect(splitRow('')).toEqual([]);
	});

	it('tolerates trailing spaces after the last pipe', () => {
		expect(splitRow('| a | b |   ').map((c) => c.text)).toEqual(['a', 'b']);
	});

	it('keeps leading indentation out of the offsets it reports', () => {
		expect(splitRow('  | a | b |')[0]).toMatchObject({ from: 4, to: 5 });
	});
});

describe('isDelimiterRow', () => {
	it('recognises the header separator, with alignment colons', () => {
		expect(isDelimiterRow('| --- | --- |')).toBe(true);
		expect(isDelimiterRow('|:---|---:|:---:|')).toBe(true);
		expect(isDelimiterRow('--- | ---')).toBe(true);
	});

	it('accepts the shortest GFM delimiter, one dash per cell', () => {
		expect(isDelimiterRow('|-|-|')).toBe(true);
		expect(isDelimiterRow('| :-: | --: |')).toBe(true);
	});

	it('rejects ordinary rows and text', () => {
		expect(isDelimiterRow('| a | b |')).toBe(false);
		expect(isDelimiterRow('| - | a |')).toBe(false);
		expect(isDelimiterRow('')).toBe(false);
		expect(isDelimiterRow('---')).toBe(false);
	});
});

describe('tableAt', () => {
	const note = ['intro', '| a | b |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |', 'after'].join('\n');

	it('gives the table a row belongs to and its rendered row number, header first', () => {
		expect(tableAt(note, 1)).toEqual({ start: 1, delimiter: 2, end: 4, row: 0 });
		expect(tableAt(note, 3)).toEqual({ start: 1, delimiter: 2, end: 4, row: 1 });
		expect(tableAt(note, 4)).toEqual({ start: 1, delimiter: 2, end: 4, row: 2 });
	});

	it('gives nothing for the delimiter line, which is not drawn', () => {
		expect(tableAt(note, 2)).toBeUndefined();
	});

	it('gives nothing for lines outside the table', () => {
		expect(tableAt(note, 0)).toBeUndefined();
		expect(tableAt(note, 5)).toBeUndefined();
		expect(tableAt(note, 99)).toBeUndefined();
		expect(tableAt(note, -1)).toBeUndefined();
	});

	it('finds a table that starts on the first line', () => {
		expect(tableAt('| a |\n| - |\n| 1 |', 2)).toEqual({ start: 0, delimiter: 1, end: 2, row: 1 });
	});

	it('ends the table at a blank line, and numbers rows of a second table from its own header', () => {
		const two = ['| a |', '| - |', '| 1 |', '', '| x |', '| - |', '| 2 |'].join('\n');
		expect(tableAt(two, 2)).toMatchObject({ start: 0, row: 1 });
		expect(tableAt(two, 6)).toEqual({ start: 4, delimiter: 5, end: 6, row: 1 });
		expect(tableAt(two, 3)).toBeUndefined();
	});

	it('does not take a text line with a pipe above the header for part of the table', () => {
		const t = ['x | y text', '| h1 | h2 |', '| - | - |', '| 1 | 2 |'].join('\n');
		expect(tableAt(t, 0)).toBeUndefined();
		expect(tableAt(t, 1)).toMatchObject({ start: 1, row: 0 });
		expect(tableAt(t, 3)).toMatchObject({ start: 1, row: 1 });
	});

	it('needs a delimiter row with as many cells as the header', () => {
		expect(tableAt(['| a | b |', '| - |', '| 1 | 2 |'].join('\n'), 0)).toBeUndefined();
	});

	it('is not a table when there is no delimiter row', () => {
		expect(tableAt(['| a | b |', '| 1 | 2 |'].join('\n'), 0)).toBeUndefined();
		expect(tableAt('just a | pipe', 0)).toBeUndefined();
	});

	it('finds a table written without outer pipes', () => {
		expect(tableAt(['a | b', '--- | ---', '1 | 2'].join('\n'), 2)).toMatchObject({ start: 0, row: 1 });
	});

	it('ignores a table inside a fenced code block', () => {
		const t = ['```', '| a |', '| - |', '| 1 |', '```'].join('\n');
		for (let i = 0; i < 5; i++) expect(tableAt(t, i)).toBeUndefined();
	});

	it('does not run a table on into a code block that starts on the next line', () => {
		const t = ['| h |', '| - |', '```|x', '| 1 |', '```'].join('\n');
		expect(tableAt(t, 3)).toBeUndefined();
		expect(tableAt(t, 2)).toBeUndefined();
		expect(tableAt(t, 0)).toEqual({ start: 0, delimiter: 1, end: 1, row: 0 });
	});

	it('finds the table right after a code block', () => {
		const t = ['```', 'x', '```', '| a |', '| - |', '| 1 |'].join('\n');
		expect(tableAt(t, 5)).toMatchObject({ start: 3, row: 1 });
	});

	it('handles CRLF line endings', () => {
		expect(tableAt('| a |\r\n| - |\r\n| 1 |', 2)).toMatchObject({ start: 0, row: 1 });
	});

	it('keeps line numbers of the whole note when the table is not at the top', () => {
		const t = ['# T', '', 'para', '', '| a |', '| - |', '| 1 |', ''].join('\n');
		expect(tableAt(t, 6)).toEqual({ start: 4, delimiter: 5, end: 6, row: 1 });
	});
});

describe('tableNumber', () => {
	const two = ['intro', '| a |', '| - |', '| 1 |', '', 'middle', '| x |', '| - |', '| 2 |', '| 3 |'].join('\n');

	it('is 0 for the first table and 1 for the second, whichever of its rows is asked', () => {
		expect(tableNumber(two, 1)).toBe(0);
		expect(tableNumber(two, 3)).toBe(0);
		expect(tableNumber(two, 6)).toBe(1);
		expect(tableNumber(two, 9)).toBe(1);
	});

	it('is undefined for a line that is not in a table', () => {
		expect(tableNumber(two, 0)).toBeUndefined();
		expect(tableNumber(two, 5)).toBeUndefined();
		expect(tableNumber(two, 2)).toBeUndefined();
	});

	it('does not count a table inside a code block, which is not drawn as one', () => {
		const t = ['```', '| a |', '| - |', '| 1 |', '```', '| x |', '| - |', '| 2 |'].join('\n');
		expect(tableNumber(t, 7)).toBe(0);
	});

	it('counts adjacent tables separated only by a blank line', () => {
		const t = ['| a |', '| - |', '| 1 |', '', '| b |', '| - |', '| 2 |', '', '| c |', '| - |', '| 3 |'].join('\n');
		expect(tableNumber(t, 2)).toBe(0);
		expect(tableNumber(t, 6)).toBe(1);
		expect(tableNumber(t, 10)).toBe(2);
	});

	it('counts a table that has only a header and a delimiter', () => {
		const t = ['| a |', '| - |', '', '| x |', '| - |', '| 1 |'].join('\n');
		expect(tableNumber(t, 0)).toBe(0);
		expect(tableNumber(t, 5)).toBe(1);
	});
});

describe('tablesOf', () => {
	it('lists every table in reading order, with the lines of its drawn rows (the delimiter row is not drawn)', () => {
		const t = ['intro', '| a |', '| - |', '| 1 |', '| 2 |', '', '| x |', '| - |', '| 3 |'].join('\n');
		expect(tablesOf(t)).toEqual([
			{ start: 1, delimiter: 2, end: 4, rows: [1, 3, 4] },
			{ start: 6, delimiter: 7, end: 8, rows: [6, 8] },
		]);
	});

	it('is empty for a note without a table', () => {
		expect(tablesOf('# title\ntext | with a pipe')).toEqual([]);
	});

	it('agrees with tableAt and tableNumber about which line is which drawn row of which table', () => {
		const t = ['| a | b |', '| - | - |', '| 1 | 2 |', '', 'text', '', '| x |', '| - |', '| 3 |', '| 4 |'].join('\n');
		const tables = tablesOf(t);
		tables.forEach((table, number) => {
			table.rows.forEach((line, row) => {
				expect(tableNumber(t, line)).toBe(number);
				expect(tableAt(t, line)?.row).toBe(row);
			});
		});
	});

	it('ignores tables inside code blocks, which are not drawn as tables', () => {
		const t = ['```', '| a |', '| - |', '| 1 |', '```', '| x |', '| - |', '| 2 |'].join('\n');
		expect(tablesOf(t)).toHaveLength(1);
		expect(tablesOf(t)[0]?.start).toBe(5);
	});

	it('finds nothing in text with no pipe in it, as the full scan would', () => {
		expect(tablesOf('# title\n\nplain text\n- list\n')).toEqual([]);
		expect(tablesOf('')).toEqual([]);
	});

	it('still finds a table whose only pipes are the ones that make it a table', () => {
		expect(tablesOf('a|b\n-|-\n1|2')).toHaveLength(1);
	});

	it('splits the note only once however many tables it has', () => {
		const many = Array.from({ length: 300 }, (_, i) => `| h${i} |\n| - |\n| v${i} |\n`).join('\n');
		const a = performance.now();
		const out = tablesOf(many);
		expect(out).toHaveLength(300);
		expect(performance.now() - a).toBeLessThan(500);
	});
});

describe('cellAtColumn', () => {
	const row = '| 项目 | DCF 说明 | DCF 备注 |';

	it('gives the cell a source column falls in, and which match of that cell it is', () => {
		// "DCF" at column 7 is in cell 1, the first match there; the one at column 16 is in cell 2.
		expect(cellAtColumn(row, row.indexOf('DCF'), { query: 'DCF' })).toEqual({ cell: 1, index: 0 });
		expect(cellAtColumn(row, row.lastIndexOf('DCF'), { query: 'DCF' })).toEqual({ cell: 2, index: 0 });
	});

	it('counts matches within the cell, so the second match of a cell is index 1', () => {
		const two = '| x | DCF and DCF |';
		expect(cellAtColumn(two, 6, { query: 'DCF' })).toEqual({ cell: 1, index: 0 });
		expect(cellAtColumn(two, 14, { query: 'DCF' })).toEqual({ cell: 1, index: 1 });
	});

	it('uses the options of the search to count matches', () => {
		const mixed = '| a | Dcf DCF |';
		expect(cellAtColumn(mixed, 10, { query: 'DCF', caseSensitive: true })).toEqual({ cell: 1, index: 0 });
	});

	it('is undefined for a column on a pipe or in padding, which belongs to no cell', () => {
		expect(cellAtColumn(row, 0, { query: 'DCF' })).toBeUndefined();
		expect(cellAtColumn(row, 4, { query: 'DCF' })).toBeUndefined();
	});

	it('is undefined for a line that is not a table row', () => {
		expect(cellAtColumn('no pipes here', 3, { query: 'no' })).toBeUndefined();
	});

	it('skips an escaped pipe, which does not end a cell', () => {
		const escaped = '| a \\| DCF | b |';
		expect(cellAtColumn(escaped, escaped.indexOf('DCF'), { query: 'DCF' })).toEqual({ cell: 0, index: 0 });
	});
});

describe('tableStartingAt', () => {
	const note = ['intro', '| a |', '| - |', '| 1 |', '', '| x |', '| - |', '| 2 |', '| 3 |'].join('\n');
	const tables = tablesOf(note);

	it('gives the table whose first line is the line a widget starts on', () => {
		expect(tableStartingAt(tables, 1)).toBe(tables[0]);
		expect(tableStartingAt(tables, 5)).toBe(tables[1]);
	});

	it('is undefined for a line where no table starts', () => {
		expect(tableStartingAt(tables, 0)).toBeUndefined();
		expect(tableStartingAt(tables, 2)).toBeUndefined();
		expect(tableStartingAt(tables, 99)).toBeUndefined();
	});

	it('is undefined when the note has no table', () => {
		expect(tableStartingAt([], 1)).toBeUndefined();
	});
});

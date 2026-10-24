import { describe, it, expect } from 'vitest';
import { splitRow, isDelimiterRow, tableAt, tableNumber } from '../src/tablerow';

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

import { describe, it, expect } from 'vitest';
import { pickTable } from '../src/tablepick';

// A table is a list of rows, a row a list of cell texts, as the page shows them.
const t = (...rows: string[][]): string[][] => rows;

describe('pickTable', () => {
	const a = t(['项目', 'DCF 说明'], ['a', 'DCF and DCF']);
	const b = t(['项目', 'DCF 说明'], ['b', 'other DCF']);

	it('picks the page table whose row has the same cells as the opened row', () => {
		expect(pickTable([a, b], 1, ['b', 'other DCF'])).toBe(1);
		expect(pickTable([a, b], 1, ['a', 'DCF and DCF'])).toBe(0);
	});

	it('does not choose between tables that share a header when the opened row is the header', () => {
		expect(pickTable([a, b], 0, ['项目', 'DCF 说明'])).toBeUndefined();
	});

	it('looks only at the row asked for, so the same text in another row does not count', () => {
		const x = t(['h1', 'h2'], ['same', 'row']);
		const y = t(['h1', 'h2'], ['other', 'row'], ['same', 'row']);
		expect(pickTable([x, y], 1, ['other', 'row'])).toBe(1);
	});

	it('is undefined when no table has that row, as when the table is not drawn yet', () => {
		expect(pickTable([a, b], 1, ['zzz', 'zzz'])).toBeUndefined();
		expect(pickTable([], 0, ['a'])).toBeUndefined();
	});

	it('ignores spaces at the ends of a cell, which the page does not show', () => {
		expect(pickTable([t(['h'], ['x'])], 1, [' x '])).toBe(0);
	});

	it('does not match a row of another length', () => {
		expect(pickTable([t(['h', 'i'], ['x', 'y'])], 1, ['x'])).toBeUndefined();
	});

	it('does not take a row with an empty last cell for a shorter row that is otherwise the same', () => {
		expect(pickTable([t(['h', 'i'], ['x', ''])], 1, ['x'])).toBeUndefined();
		expect(pickTable([t(['h'], ['x'])], 1, ['x', ''])).toBeUndefined();
	});

	it('is undefined when two page tables both match, since the choice would be a guess', () => {
		const same = t(['h'], ['x']);
		expect(pickTable([same, same], 1, ['x'])).toBeUndefined();
	});
});

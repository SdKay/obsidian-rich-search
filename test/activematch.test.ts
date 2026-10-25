import { describe, it, expect } from 'vitest';
import { activeIndexIn } from '../src/activematch';

// Three lines: "cat cat" at 0, "dog" at 8, "a cat" at 12. Matches are document ranges, in order.
const lineStarts = [0, 8, 12];
const matches = [{ from: 0, to: 3 }, { from: 4, to: 7 }, { from: 14, to: 17 }];

describe('activeIndexIn', () => {
	it('picks the n-th match of the given line', () => {
		expect(activeIndexIn(matches, lineStarts, { line: 0, index: 0 })).toBe(0);
		expect(activeIndexIn(matches, lineStarts, { line: 0, index: 1 })).toBe(1);
		expect(activeIndexIn(matches, lineStarts, { line: 2, index: 0 })).toBe(2);
	});

	it('is -1 when the line has fewer matches than the index', () => {
		expect(activeIndexIn(matches, lineStarts, { line: 0, index: 2 })).toBe(-1);
		expect(activeIndexIn(matches, lineStarts, { line: 1, index: 0 })).toBe(-1);
	});

	it('is -1 when the line does not exist or there is no hit', () => {
		expect(activeIndexIn(matches, lineStarts, { line: 9, index: 0 })).toBe(-1);
		expect(activeIndexIn(matches, lineStarts, { line: -1, index: 0 })).toBe(-1);
		expect(activeIndexIn(matches, lineStarts, null)).toBe(-1);
	});

	it('does not count a match that sits in a line the list does not reach', () => {
		expect(activeIndexIn([], lineStarts, { line: 0, index: 0 })).toBe(-1);
	});

	it('works when only some lines were matched, as when the view shows part of the note', () => {
		expect(activeIndexIn([{ from: 14, to: 17 }], lineStarts, { line: 2, index: 0 })).toBe(0);
	});
});

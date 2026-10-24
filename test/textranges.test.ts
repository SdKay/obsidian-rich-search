import { describe, it, expect } from 'vitest';
import { rangesInNodes } from '../src/textranges';

describe('rangesInNodes', () => {
	it('maps a span inside one text node to that node', () => {
		expect(rangesInNodes(['hello world'], [{ start: 6, end: 11 }])).toEqual([{ node: 0, start: 6, end: 11 }]);
	});

	it('splits a span that crosses a node boundary, such as a word cut by bold text', () => {
		expect(rangesInNodes(['hel', 'lo world'], [{ start: 1, end: 5 }])).toEqual([
			{ node: 0, start: 1, end: 3 },
			{ node: 1, start: 0, end: 2 },
		]);
	});

	it('handles a span that covers a whole middle node', () => {
		expect(rangesInNodes(['ab', 'cd', 'ef'], [{ start: 1, end: 5 }])).toEqual([
			{ node: 0, start: 1, end: 2 },
			{ node: 1, start: 0, end: 2 },
			{ node: 2, start: 0, end: 1 },
		]);
	});

	it('returns every span, in order', () => {
		expect(rangesInNodes(['a cat and a cat'], [{ start: 2, end: 5 }, { start: 12, end: 15 }])).toEqual([
			{ node: 0, start: 2, end: 5 },
			{ node: 0, start: 12, end: 15 },
		]);
	});

	it('returns nothing for no spans or no nodes', () => {
		expect(rangesInNodes(['abc'], [])).toEqual([]);
		expect(rangesInNodes([], [{ start: 0, end: 1 }])).toEqual([]);
	});

	it('skips empty nodes without losing the offset', () => {
		expect(rangesInNodes(['ab', '', 'cd'], [{ start: 2, end: 4 }])).toEqual([{ node: 2, start: 0, end: 2 }]);
	});

	it('clamps a span that runs past the end of the text', () => {
		expect(rangesInNodes(['abc'], [{ start: 1, end: 99 }])).toEqual([{ node: 0, start: 1, end: 3 }]);
	});

	it('ignores a span that starts after the end of the text, and an empty or reversed one', () => {
		expect(rangesInNodes(['abc'], [{ start: 5, end: 9 }, { start: 2, end: 2 }, { start: 3, end: 1 }])).toEqual([]);
	});

	it('works in UTF-16 units, so Chinese text lines up', () => {
		expect(rangesInNodes(['文档', '仓库'], [{ start: 1, end: 3 }])).toEqual([
			{ node: 0, start: 1, end: 2 },
			{ node: 1, start: 0, end: 1 },
		]);
	});
});

import { describe, it, expect } from 'vitest';
import { matchesInLines, linesInRanges, MARK_LIMIT, type LineSource } from '../src/linematches';

describe('matchesInLines', () => {
	it('gives document ranges for matches in each line, using the offset where each line starts', () => {
		const lines = [{ from: 0, text: 'a cat' }, { from: 6, text: 'no' }, { from: 9, text: 'cat cat' }];
		expect(matchesInLines(lines, { query: 'cat' })).toEqual([
			{ from: 2, to: 5 },
			{ from: 9, to: 12 },
			{ from: 13, to: 16 },
		]);
	});

	it('returns nothing for an empty query', () => {
		expect(matchesInLines([{ from: 0, text: 'cat' }], { query: '' })).toEqual([]);
	});

	it('returns nothing, and does not throw, for an invalid pattern', () => {
		expect(matchesInLines([{ from: 0, text: 'cat' }], { query: '(', regex: true })).toEqual([]);
	});

	it('follows the options', () => {
		const lines = [{ from: 0, text: 'Cat concat cat' }];
		// 'Cat concat cat': the capital C is skipped, the cat inside concat is at 7-10, the last word at 11-14.
		expect(matchesInLines(lines, { query: 'cat', caseSensitive: true })).toEqual([{ from: 7, to: 10 }, { from: 11, to: 14 }]);
		expect(matchesInLines(lines, { query: 'cat', wholeWord: true })).toEqual([{ from: 0, to: 3 }, { from: 11, to: 14 }]);
	});

	it('returns ranges in document order', () => {
		const out = matchesInLines([{ from: 0, text: 'x a' }, { from: 4, text: 'a x a' }], { query: 'a' });
		expect(out.map((r) => r.from)).toEqual([...out.map((r) => r.from)].sort((a, b) => a - b));
	});

	it('does not cross a line: a pattern that would span lines finds nothing', () => {
		expect(matchesInLines([{ from: 0, text: 'ab' }, { from: 3, text: 'cd' }], { query: 'b\\nc', regex: true })).toEqual([]);
	});

	it('works with Chinese text', () => {
		expect(matchesInLines([{ from: 10, text: '全文搜索很快' }], { query: '搜索' })).toEqual([{ from: 12, to: 14 }]);
	});

	it('stops at a limit so a single letter in a long viewport cannot flood the editor', () => {
		const lines = Array.from({ length: 50 }, (_, i) => ({ from: i * 100, text: 'a '.repeat(40) }));
		const out = matchesInLines(lines, { query: 'a' }, 500);
		expect(out).toHaveLength(500);
		expect(out[0]).toEqual({ from: 0, to: 1 });
	});

	it('applies the standard limit when none is given', () => {
		const lines = Array.from({ length: 50 }, (_, i) => ({ from: i * 100, text: 'a '.repeat(40) }));
		expect(matchesInLines(lines, { query: 'a' })).toHaveLength(MARK_LIMIT);
		expect(MARK_LIMIT).toBeLessThanOrEqual(1000);
	});

	it('returns every match when there are fewer than the limit', () => {
		expect(matchesInLines([{ from: 0, text: 'a a a' }], { query: 'a' }, 500)).toHaveLength(3);
	});
});

/** A document held as an array of lines, answering the way CodeMirror's `doc.lineAt` does. */
function doc(...texts: string[]): LineSource {
	const lines: { from: number; to: number; text: string }[] = [];
	let from = 0;
	for (const text of texts) { lines.push({ from, to: from + text.length, text }); from += text.length + 1; }
	return {
		length: from - 1 < 0 ? 0 : from - 1,
		lineAt(pos) {
			const line = lines.find((l) => pos >= l.from && pos <= l.to);
			if (!line) throw new RangeError(`Invalid position ${pos}`);
			return line;
		},
	};
}

describe('linesInRanges', () => {
	it('gives every line that a visible range touches, once, with its start', () => {
		const d = doc('aaa', 'bbb', 'ccc');
		expect(linesInRanges(d, [{ from: 0, to: d.length }])).toEqual([
			{ from: 0, text: 'aaa' }, { from: 4, text: 'bbb' }, { from: 8, text: 'ccc' },
		]);
	});

	it('includes a line the range only starts or ends in', () => {
		const d = doc('aaa', 'bbb', 'ccc');
		expect(linesInRanges(d, [{ from: 5, to: 9 }]).map((l) => l.text)).toEqual(['bbb', 'ccc']);
	});

	it('handles a range that is a single point', () => {
		const d = doc('aaa', 'bbb');
		expect(linesInRanges(d, [{ from: 5, to: 5 }])).toEqual([{ from: 4, text: 'bbb' }]);
	});

	it('handles an empty document without looping or throwing', () => {
		const d = doc('');
		expect(linesInRanges(d, [{ from: 0, to: 0 }])).toEqual([{ from: 0, text: '' }]);
	});

	it('handles a range that ends exactly at the end of the document', () => {
		const d = doc('aaa', 'bbb');
		expect(linesInRanges(d, [{ from: 4, to: d.length }])).toEqual([{ from: 4, text: 'bbb' }]);
	});

	it('does not ask for a position past the end of the document', () => {
		const d = doc('aaa', 'bbb');
		expect(() => linesInRanges(d, [{ from: 0, to: d.length + 50 }])).not.toThrow();
	});

	it('does not repeat a line that two ranges both touch', () => {
		const d = doc('aaaaaaaa', 'bbb');
		const out = linesInRanges(d, [{ from: 1, to: 2 }, { from: 5, to: 6 }]);
		expect(out).toEqual([{ from: 0, text: 'aaaaaaaa' }]);
	});

	it('handles several separate ranges in order', () => {
		const d = doc('aaa', 'bbb', 'ccc', 'ddd');
		expect(linesInRanges(d, [{ from: 0, to: 1 }, { from: 12, to: 13 }]).map((l) => l.text)).toEqual(['aaa', 'ddd']);
	});

	it('returns nothing for no ranges', () => {
		expect(linesInRanges(doc('aaa'), [])).toEqual([]);
	});

	it('finishes in a bounded number of steps on a long document', () => {
		const d = doc(...Array.from({ length: 5000 }, () => 'line'));
		let asked = 0;
		const counting: LineSource = { length: d.length, lineAt: (p) => { asked++; return d.lineAt(p); } };
		linesInRanges(counting, [{ from: 0, to: d.length }]);
		expect(asked).toBe(5000);
	});
});

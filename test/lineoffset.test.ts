import { describe, it, expect } from 'vitest';
import { matchStateFor, offsetOfLine } from '../src/lineoffset';

// "one\ntwo\nthree": lines start at 0, 4, 8.
const doc = { lines: 3, line: (n: number) => ({ from: [0, 0, 4, 8][n] ?? -1 }) };

describe('offsetOfLine', () => {
	it('gives the offset where a 0-based line starts', () => {
		expect(offsetOfLine(doc, 0)).toBe(0);
		expect(offsetOfLine(doc, 1)).toBe(4);
		expect(offsetOfLine(doc, 2)).toBe(8);
	});

	it('keeps a line past the end, as after the note was shortened, on the last line', () => {
		expect(offsetOfLine(doc, 9)).toBe(8);
	});

	it('keeps a negative line on the first', () => {
		expect(offsetOfLine(doc, -3)).toBe(0);
	});

	it('works for a note with one line', () => {
		expect(offsetOfLine({ lines: 1, line: () => ({ from: 0 }) }, 5)).toBe(0);
	});
});

describe('matchStateFor', () => {
	const text = 'one\ntwo cat\nthree';

	it('gives the content and the range of the first match, as Obsidian\'s own search hands it to a note', () => {
		expect(matchStateFor(text, 1, { start: 4, end: 7 })).toEqual({ content: text, matches: [[8, 11]] });
	});

	it('counts the offset from the start of the line', () => {
		expect(matchStateFor(text, 0, { start: 1, end: 2 })).toEqual({ content: text, matches: [[1, 2]] });
		expect(matchStateFor(text, 2, { start: 0, end: 5 })).toEqual({ content: text, matches: [[12, 17]] });
	});

	it('counts both kinds of line break, since Obsidian counts only \\n and a note may have \\r\\n', () => {
		const crlf = 'one\r\ntwo cat';
		expect(matchStateFor(crlf, 1, { start: 4, end: 7 })).toEqual({ content: crlf, matches: [[9, 12]] });
	});

	it('is undefined for a line the note does not have or a match that is not in it', () => {
		expect(matchStateFor(text, 9, { start: 0, end: 1 })).toBeUndefined();
		expect(matchStateFor(text, 1, undefined)).toBeUndefined();
	});
});

import { describe, it, expect } from 'vitest';
import { canReplaceHit, replaceInLine } from '../src/replace';
import type { SearchHit } from '../src/types';

describe('replaceInLine', () => {
	it('replaces every match on the line', () => {
		expect(replaceInLine('a cat and a cat', { query: 'cat' }, 'dog')).toBe('a dog and a dog');
	});

	it('leaves the line alone when nothing matches, or the query is not valid yet', () => {
		expect(replaceInLine('a dog', { query: 'cat' }, 'x')).toBe('a dog');
		expect(replaceInLine('a (b', { query: '(', regex: true }, 'x')).toBe('a (b');
	});

	it('replaces only the spans whole-word matching accepts', () => {
		expect(replaceInLine('cat concat cat', { query: 'cat', wholeWord: true }, 'dog')).toBe('dog concat dog');
	});

	it('works on Chinese text, where there are no spaces to mark a word', () => {
		expect(replaceInLine('我的网卡驱动，网卡好', { query: '网卡' }, 'NIC')).toBe('我的NIC驱动，NIC好');
	});

	it('is literal when the query is not a regular expression: $ and \\ in the replacement mean themselves', () => {
		expect(replaceInLine('price', { query: 'price' }, '$1 \\n $&')).toBe('$1 \\n $&');
	});

	it('expands $1 and $& in the replacement of a regular expression', () => {
		expect(replaceInLine('key=value', { query: '(\\w+)=(\\w+)', regex: true }, '$2=$1')).toBe('value=key');
		expect(replaceInLine('abc', { query: 'b', regex: true }, '[$&]')).toBe('a[b]c');
		expect(replaceInLine('abc', { query: 'b', regex: true }, '$$')).toBe('a$c');
	});

	it('gives each match its own groups when a line has several', () => {
		expect(replaceInLine('a=1 b=2 c=3', { query: '(\\w)=(\\d)', regex: true }, '$2:$1')).toBe('1:a 2:b 3:c');
	});

	it('respects case sensitivity', () => {
		expect(replaceInLine('Cat cat', { query: 'cat', caseSensitive: true }, 'x')).toBe('Cat x');
		expect(replaceInLine('Cat cat', { query: 'cat' }, 'x')).toBe('x x');
	});

	it('does not hang or insert anything on a zero-length match', () => {
		expect(replaceInLine('bbb', { query: 'a*', regex: true }, 'X')).toBe('bbb');
	});

	it('does not treat text it has just inserted as something to match again', () => {
		expect(replaceInLine('cat', { query: 'cat' }, 'cat cat')).toBe('cat cat');
	});

	it('can replace with nothing', () => {
		expect(replaceInLine('a cat b', { query: ' cat' }, '')).toBe('a b');
	});

	it('handles a $ group that does not exist as itself', () => {
		expect(replaceInLine('abc', { query: 'b', regex: true }, '$9')).toBe('a$9c');
	});
});

describe('canReplaceHit', () => {
	const note: SearchHit = { path: 'a.md', line: 3, text: 'cat', spans: [{ start: 0, end: 3 }] };

	it('is true for an ordinary line of a Markdown note', () => {
		expect(canReplaceHit(note)).toBe(true);
		expect(canReplaceHit({ ...note, path: 'A.MD' })).toBe(true);
	});

	it('is false for a file that is not a Markdown note', () => {
		expect(canReplaceHit({ ...note, path: 'a.pdf' })).toBe(false);
		expect(canReplaceHit({ ...note, path: 'a.xlsx' })).toBe(false);
		expect(canReplaceHit({ ...note, path: 'a.excalidraw' })).toBe(false);
	});

	it('is false for a line a plugin drew from a block, whose line number is not a line of the file', () => {
		expect(canReplaceHit({ ...note, block: { language: 'rich-table', fromLine: 2 } })).toBe(false);
		expect(canReplaceHit({ ...note, anchor: { sheet: 'S1' } })).toBe(false);
		expect(canReplaceHit({ ...note, location: 'Sheet1!B4' })).toBe(false);
	});

	it('is false for a drawing note, whose lines are words extracted from the drawing', () => {
		expect(canReplaceHit({ ...note, path: 'd.excalidraw.md', location: 'Text element' })).toBe(false);
	});
});

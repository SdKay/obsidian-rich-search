import { describe, it, expect } from 'vitest';
import { compile, matchLine } from '../src/match';

describe('matchLine', () => {
	it('finds literal text, case-insensitively by default', () => {
		expect(matchLine('Hello hello', { query: 'hello' })).toEqual([{ start: 0, end: 5 }, { start: 6, end: 11 }]);
	});
	it('can be case sensitive', () => {
		expect(matchLine('Hello hello', { query: 'hello', caseSensitive: true })).toEqual([{ start: 6, end: 11 }]);
	});
	it('treats regex characters literally unless regex is on', () => {
		expect(matchLine('a.b axb', { query: 'a.b' })).toEqual([{ start: 0, end: 3 }]);
		expect(matchLine('a.b axb', { query: 'a.b', regex: true })).toHaveLength(2);
	});
	it('whole word excludes matches inside a longer word', () => {
		expect(matchLine('cat concat cat_x cat', { query: 'cat', wholeWord: true })).toEqual([{ start: 0, end: 3 }, { start: 17, end: 20 }]);
	});
	it('whole word does not need ASCII word boundaries around CJK text', () => {
		expect(matchLine('今天，搜索，很好', { query: '搜索', wholeWord: true })).toEqual([{ start: 3, end: 5 }]);
	});
	it('whole word counts digits and non-ASCII letters as word characters', () => {
		expect(matchLine('é1 cat1 cat', { query: 'cat', wholeWord: true })).toEqual([{ start: 8, end: 11 }]);
	});
	it('does not loop on a zero-length regex match', () => {
		expect(matchLine('bbb', { query: 'a*', regex: true })).toEqual([]);
	});
	it('returns no spans for an invalid pattern', () => {
		expect(matchLine('abc', { query: '(', regex: true })).toEqual([]);
	});
});

describe('compile', () => {
	it('explains an invalid pattern instead of throwing', () => {
		const r = compile({ query: '(', regex: true });
		expect(r.ok).toBe(false);
	});
	it('rejects an empty query', () => {
		expect(compile({ query: '' }).ok).toBe(false);
	});
});

import { describe, it, expect } from 'vitest';
import { activeRangeIn, rangesInBlocks } from '../src/blocktext';
import { MARK_LIMIT } from '../src/linematches';

/** A piece of text and the block it belongs to (a paragraph, a list item, a heading...). */
const piece = (block: number, text: string) => ({ block, text });

describe('rangesInBlocks', () => {
	it('marks a word inside one piece of text', () => {
		expect(rangesInBlocks([piece(0, 'a cat here')], { query: 'cat' })).toEqual([{ piece: 0, start: 2, end: 5 }]);
	});

	it('finds a word that is split between two pieces of the same block, such as one cut by bold text', () => {
		const out = rangesInBlocks([piece(0, 'a ca'), piece(0, 't here')], { query: 'cat' });
		expect(out).toEqual([{ piece: 0, start: 2, end: 4 }, { piece: 1, start: 0, end: 1 }]);
	});

	it('does not find a word that would have to run from one block into the next', () => {
		expect(rangesInBlocks([piece(0, 'a ca'), piece(1, 't here')], { query: 'cat' })).toEqual([]);
	});

	it('matches each block on its own', () => {
		const out = rangesInBlocks([piece(0, 'cat'), piece(1, 'a cat'), piece(2, 'dog')], { query: 'cat' });
		expect(out).toEqual([{ piece: 0, start: 0, end: 3 }, { piece: 1, start: 2, end: 5 }]);
	});

	it('numbers pieces by their position in the list, whatever the block numbers are', () => {
		const out = rangesInBlocks([piece(7, 'x'), piece(7, 'cat'), piece(9, 'cat')], { query: 'cat' });
		expect(out.map((r) => r.piece)).toEqual([1, 2]);
	});

	it('applies the options of the search', () => {
		const pieces = [piece(0, 'Cat concat cat')];
		expect(rangesInBlocks(pieces, { query: 'cat', wholeWord: true, caseSensitive: true })).toEqual([{ piece: 0, start: 11, end: 14 }]);
	});

	it('returns nothing for an empty or invalid search', () => {
		expect(rangesInBlocks([piece(0, 'cat')], { query: '' })).toEqual([]);
		expect(rangesInBlocks([piece(0, 'cat')], { query: '(', regex: true })).toEqual([]);
	});

	it('stops at the limit', () => {
		const pieces = Array.from({ length: 100 }, (_, i) => piece(i, 'a a a a a'));
		expect(rangesInBlocks(pieces, { query: 'a' }, 50)).toHaveLength(50);
	});

	it('stops at the limit counted in marks, not in blocks', () => {
		const out = rangesInBlocks([piece(0, 'a a a a a a')], { query: 'a' }, 4);
		expect(out).toHaveLength(4);
	});

	it('applies the standard limit when none is given', () => {
		const pieces = Array.from({ length: 2000 }, (_, i) => piece(i, 'a a a'));
		expect(rangesInBlocks(pieces, { query: 'a' })).toHaveLength(MARK_LIMIT);
	});

	it('does not look at the blocks after the limit is reached', () => {
		let read = 0;
		const watched = new Proxy(Array.from({ length: 5000 }, (_, i) => piece(i, 'a a a')), {
			get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) read++; return Reflect.get(target, key, receiver); },
		});
		rangesInBlocks(watched, { query: 'a' }, 6);
		expect(read).toBeLessThan(100);
	});

	it('works with Chinese text', () => {
		expect(rangesInBlocks([piece(0, '全文'), piece(0, '搜索很快')], { query: '文搜' })).toEqual([{ piece: 0, start: 1, end: 2 }, { piece: 1, start: 0, end: 1 }]);
	});

	it('copes with no pieces', () => {
		expect(rangesInBlocks([], { query: 'cat' })).toEqual([]);
	});

	it('copes with empty pieces in the middle of a block', () => {
		expect(rangesInBlocks([piece(0, 'ca'), piece(0, ''), piece(0, 't')], { query: 'cat' })).toEqual([{ piece: 0, start: 0, end: 2 }, { piece: 2, start: 0, end: 1 }]);
	});
});

describe('activeRangeIn', () => {
	const pieces = [piece(0, 'cat and dog'), piece(1, 'a cat, a cat'), piece(2, 'cat and dog')];
	const ranges = (q = 'cat') => rangesInBlocks(pieces, { query: q });

	it('picks the n-th match of the block whose text is the opened line', () => {
		const at = activeRangeIn(pieces, ranges(), 'a cat, a cat', 1);
		expect(at).toBe(2);
	});

	it('takes the first block with that text, since the page order is the note order', () => {
		expect(activeRangeIn(pieces, ranges(), 'cat and dog', 0)).toBe(0);
	});

	it('finds the line when the page cut its text into pieces, as bold or a link does', () => {
		const cut = [piece(0, 'a '), piece(0, 'cat'), piece(0, ', a cat')];
		expect(activeRangeIn(cut, rangesInBlocks(cut, { query: 'cat' }), 'a cat, a cat', 1)).toBe(1);
	});

	it('is -1 when no block says what the opened line says', () => {
		expect(activeRangeIn(pieces, ranges(), 'something else', 0)).toBe(-1);
	});

	it('is -1 when the block has fewer matches than the index', () => {
		expect(activeRangeIn(pieces, ranges(), 'a cat, a cat', 5)).toBe(-1);
	});

	it('finds a line whose source has markup, by what the page shows of it', () => {
		const rendered = [piece(0, 'a cat here')];
		expect(activeRangeIn(rendered, rangesInBlocks(rendered, { query: 'cat' }), '**a** [cat](x) here', 0)).toBe(0);
	});

	it('finds a heading, which the page shows without its marker', () => {
		const page = [piece(0, 'intro'), piece(1, '八、交付模式与逃生阀'), piece(2, '交付 again')];
		expect(activeRangeIn(page, rangesInBlocks(page, { query: '交付' }), '## 八、交付模式与逃生阀', 0)).toBe(0);
	});

	it('finds a line that is one of several in a paragraph, which the page shows as one block with line breaks', () => {
		const page = [piece(0, '设备绑定\nlicense 只能给某颗芯片使用。')];
		const found = rangesInBlocks(page, { query: '芯片' });
		expect(activeRangeIn(page, found, '   license 只能给某颗芯片使用。', 0)).toBe(0);
	});

	it('counts the matches of that line only, not those of the lines before it in the paragraph', () => {
		const page = [piece(0, 'first DCF line\nsecond DCF and DCF line')];
		const found = rangesInBlocks(page, { query: 'DCF' });
		expect(found).toHaveLength(3);
		expect(activeRangeIn(page, found, 'second DCF and DCF line', 0)).toBe(1);
		expect(activeRangeIn(page, found, 'second DCF and DCF line', 1)).toBe(2);
		expect(activeRangeIn(page, found, 'first DCF line', 0)).toBe(0);
	});

	it('finds a line split over several text nodes inside such a paragraph', () => {
		const page = [piece(0, 'head\nsecond '), piece(0, 'DCF'), piece(0, ' line')];
		const found = rangesInBlocks(page, { query: 'DCF' });
		expect(activeRangeIn(page, found, 'second DCF line', 0)).toBe(0);
	});

	it('does not take a line that is only part of a line of the paragraph', () => {
		const page = [piece(0, 'head\nthe whole second line')];
		const found = rangesInBlocks(page, { query: 'second' });
		expect(activeRangeIn(page, found, 'second line', 0)).toBe(-1);
	});

	it('does not count a match in the line before, however long that line is', () => {
		const page = [piece(0, 'DCF DCF DCF\nxx DCF')];
		const found = rangesInBlocks(page, { query: 'DCF' });
		expect(found).toHaveLength(4);
		expect(activeRangeIn(page, found, 'xx DCF', 0)).toBe(3);
	});

	it('does not count a match that starts the next line', () => {
		const page = [piece(0, 'ab DCF\nDCF here')];
		const found = rangesInBlocks(page, { query: 'DCF' });
		expect(activeRangeIn(page, found, 'ab DCF', 0)).toBe(0);
		expect(activeRangeIn(page, found, 'ab DCF', 1)).toBe(-1);
	});

	it('counts a match at the very start of a line whose text in the block is indented', () => {
		const page = [piece(0, 'x\n   DCF first')];
		const found = rangesInBlocks(page, { query: 'DCF' });
		expect(activeRangeIn(page, found, 'DCF first', 0)).toBe(0);
	});

	it('places a later line by the length of the lines before it and their breaks', () => {
		// "aaa\nDCF\nDCF": the second line is "DCF" at 4..7, the third "DCF" at 8..11.
		const page = [piece(0, 'aaa\nDCF\nDCF')];
		const found = rangesInBlocks(page, { query: 'DCF' });
		expect(found).toHaveLength(2);
		expect(activeRangeIn(page, found, 'DCF', 0)).toBe(0);
	});

	it('counts a match that is only spaces at the start of an indented line as part of that line', () => {
		const page = [piece(0, 'x\n  y')];
		const found = rangesInBlocks(page, { query: ' ' });
		expect(found.length).toBeGreaterThan(0);
		expect(activeRangeIn(page, found, 'y', 0)).toBe(-1);
	});

	it('takes the first paragraph in page order when two hold the same line', () => {
		const page = [piece(0, 'a\nsame line'), piece(1, 'b\nsame line')];
		const found = rangesInBlocks(page, { query: 'same' });
		expect(activeRangeIn(page, found, 'same line', 0)).toBe(0);
	});

	it('does not take a block that only holds the line among other text', () => {
		const page = [piece(0, 'prefix 八、交付模式 suffix')];
		expect(activeRangeIn(page, rangesInBlocks(page, { query: '交付' }), '## 八、交付模式', 0)).toBe(-1);
	});
});

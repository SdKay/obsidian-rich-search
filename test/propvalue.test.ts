import { describe, it, expect } from 'vitest';
import { isSet, textsOf } from '../src/propvalue';

describe('textsOf: the strings a frontmatter value stands for', () => {
	it('is the string itself', () => {
		expect(textsOf('done')).toEqual(['done']);
	});

	it('reads a number and a boolean as their text', () => {
		expect(textsOf(3)).toEqual(['3']);
		expect(textsOf(1.5)).toEqual(['1.5']);
		expect(textsOf(true)).toEqual(['true']);
		expect(textsOf(false)).toEqual(['false']);
	});

	it('is each element of a list', () => {
		expect(textsOf(['a', 'b'])).toEqual(['a', 'b']);
	});

	it('reads a number or boolean inside a list as text', () => {
		expect(textsOf([1, true, 'x'])).toEqual(['1', 'true', 'x']);
	});

	it('reads a list inside a list as the text of its first element, and skips an empty one', () => {
		expect(textsOf([['link']])).toEqual(['link']);
		expect(textsOf([[], 'x'])).toEqual(['x']);
	});

	it('skips what it cannot read, without throwing', () => {
		expect(textsOf([{ a: 1 }, 'x', null, undefined])).toEqual(['x']);
	});

	it('has nothing for null, undefined, an object or a function', () => {
		expect(textsOf(null)).toEqual([]);
		expect(textsOf(undefined)).toEqual([]);
		expect(textsOf({ '{ date }': null })).toEqual([]);
		expect(textsOf(() => 1)).toEqual([]);
	});

	it('has nothing for an empty string or an empty list', () => {
		expect(textsOf('')).toEqual([]);
		expect(textsOf([])).toEqual([]);
	});

	it('does not read a number that is not finite', () => {
		expect(textsOf(NaN)).toEqual([]);
		expect(textsOf(Infinity)).toEqual([]);
	});

	it('survives a very deep nest without exhausting the stack', () => {
		let deep: unknown = 'x';
		// Deeper than a recursive walk can survive (it overflows near 10,000 levels), so only a loop passes.
		for (let i = 0; i < 100000; i++) deep = [deep];
		expect(() => textsOf(deep)).not.toThrow();
	});
});

describe('isSet', () => {
	it('is false for null, undefined, an empty string, an empty list and an object', () => {
		for (const v of [null, undefined, '', [], {}, { '{ date }': null }]) expect(isSet(v)).toBe(false);
	});

	it('is true for text, a number, a boolean and a non-empty list', () => {
		for (const v of ['a', 0, false, true, ['x']]) expect(isSet(v)).toBe(true);
	});

	it('treats a list of nothing readable as not set, because the user sees an empty field', () => {
		expect(isSet([{}, null])).toBe(false);
		expect(isSet([''])).toBe(false);
	});

	it('treats 0 and false as set: they are values, not absence', () => {
		expect(isSet(0)).toBe(true);
		expect(isSet(false)).toBe(true);
	});
});

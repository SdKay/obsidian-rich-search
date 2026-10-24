import { describe, it, expect } from 'vitest';
import { hitIndexFrom, type ClosestLike } from '../src/hitindex';

/** A stand-in for a DOM element: `closest` finds the nearest ancestor-or-self carrying the attribute. */
function el(attrs: Record<string, string> = {}, parent?: ClosestLike): ClosestLike & { attrs: Record<string, string> } {
	const self: ClosestLike & { attrs: Record<string, string> } = {
		attrs,
		closest: (selector) => {
			const name = /\[([a-z-]+)\]/.exec(selector)?.[1];
			if (!name) return null;
			if (name in attrs) return self;
			return parent ? parent.closest(selector) : null;
		},
		getAttribute: (name) => attrs[name] ?? null,
	};
	return self;
}

describe('hitIndexFrom', () => {
	it('returns the index of the row that was clicked', () => {
		expect(hitIndexFrom(el({ 'data-hit': '7' }))).toBe(7);
	});

	it('finds the row from something inside it, such as the highlighted word', () => {
		const row = el({ 'data-hit': '3' });
		const mark = el({}, row);
		expect(hitIndexFrom(mark)).toBe(3);
	});

	it('accepts index zero', () => {
		expect(hitIndexFrom(el({ 'data-hit': '0' }))).toBe(0);
	});

	it('returns undefined when the click was outside any row', () => {
		expect(hitIndexFrom(el({}))).toBeUndefined();
		expect(hitIndexFrom(null)).toBeUndefined();
	});

	it('returns undefined for an index that is not a non-negative integer', () => {
		for (const bad of ['', 'abc', '-1', '1.5', ' ', '1e3']) {
			expect(hitIndexFrom(el({ 'data-hit': bad }))).toBeUndefined();
		}
	});

	it('does not read the file group header as a row', () => {
		const header = el({ 'data-file': 'a.md' });
		expect(hitIndexFrom(header)).toBeUndefined();
	});
});

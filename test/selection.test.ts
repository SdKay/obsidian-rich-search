import { describe, it, expect } from 'vitest';
import { nextSelection, type Row } from '../src/selection';

/** Rows as the list shows them, top to bottom: each hit has a number and the file it belongs to. */
const row = (hit: number, file: string): Row => ({ hit, file });

const rows = [row(0, 'a.md'), row(1, 'a.md'), row(2, 'b.md'), row(3, 'c.md'), row(4, 'c.md')];
const none = new Set<string>();

describe('nextSelection', () => {
	it('selects the first hit when nothing is selected and down is pressed', () => {
		expect(nextSelection(rows, none, undefined, 'down')).toBe(0);
	});

	it('selects the last hit when nothing is selected and up is pressed', () => {
		expect(nextSelection(rows, none, undefined, 'up')).toBe(4);
	});

	it('moves to the next and previous hit', () => {
		expect(nextSelection(rows, none, 1, 'down')).toBe(2);
		expect(nextSelection(rows, none, 3, 'up')).toBe(2);
	});

	it('stays on the last hit when down is pressed there, and on the first when up is pressed there', () => {
		expect(nextSelection(rows, none, 4, 'down')).toBe(4);
		expect(nextSelection(rows, none, 0, 'up')).toBe(0);
	});

	it('skips the hits of a collapsed file', () => {
		expect(nextSelection(rows, new Set(['b.md']), 1, 'down')).toBe(3);
		expect(nextSelection(rows, new Set(['b.md']), 3, 'up')).toBe(1);
		expect(nextSelection(rows, new Set(['a.md']), undefined, 'down')).toBe(2);
	});

	it('goes past a whole collapsed file with several hits', () => {
		expect(nextSelection(rows, new Set(['c.md']), 2, 'down')).toBe(2);
		expect(nextSelection(rows, new Set(['a.md']), 2, 'up')).toBe(2);
	});

	it('returns undefined when there is nothing to select', () => {
		expect(nextSelection([], none, undefined, 'down')).toBeUndefined();
		expect(nextSelection(rows, new Set(['a.md', 'b.md', 'c.md']), undefined, 'down')).toBeUndefined();
	});

	it('moves on from a selected hit that has since been hidden by collapsing its file', () => {
		expect(nextSelection(rows, new Set(['a.md']), 1, 'down')).toBe(2);
		expect(nextSelection(rows, new Set(['c.md']), 4, 'up')).toBe(2);
	});

	it('keeps a hidden selection when no visible hit lies in the direction pressed', () => {
		// Hit 4 is in a collapsed file at the end: there is nothing visible after it, so down changes nothing.
		expect(nextSelection(rows, new Set(['c.md']), 4, 'down')).toBe(4);
		// Hit 0 is in a collapsed file at the start: nothing visible before it.
		expect(nextSelection(rows, new Set(['a.md']), 0, 'up')).toBe(0);
	});

	it('treats a selected hit that is not in the list any more as nothing selected', () => {
		expect(nextSelection(rows, none, 99, 'down')).toBe(0);
		expect(nextSelection(rows, none, 99, 'up')).toBe(4);
	});

	it('does not move on a single visible hit', () => {
		expect(nextSelection([row(7, 'a.md')], none, 7, 'down')).toBe(7);
		expect(nextSelection([row(7, 'a.md')], none, 7, 'up')).toBe(7);
	});

	it('is fast enough on a long list: 200 key presses over 20,000 hits', () => {
		const long = Array.from({ length: 20000 }, (_, i) => row(i, `f${Math.floor(i / 10)}.md`));
		const a = performance.now();
		let at: number | undefined = 0;
		for (let i = 0; i < 200; i++) at = nextSelection(long, none, at, 'down');
		expect(at).toBe(200);
		expect(performance.now() - a).toBeLessThan(500);
	});
});

import { describe, it, expect } from 'vitest';
import { applyReplacements } from '../src/applyreplace';

const opts = { query: 'cat' };

describe('applyReplacements', () => {
	it('replaces the chosen lines and leaves the others alone', () => {
		const r = applyReplacements('a cat\nno\nb cat', [{ line: 0, text: 'a cat' }, { line: 2, text: 'b cat' }], opts, 'dog');
		expect(r.text).toBe('a dog\nno\nb dog');
		expect(r.replaced).toBe(2);
		expect(r.skipped).toEqual([]);
	});

	it('replaces only the lines asked for, even when others match too', () => {
		const r = applyReplacements('cat\ncat\ncat', [{ line: 1, text: 'cat' }], opts, 'dog');
		expect(r.text).toBe('cat\ndog\ncat');
	});

	it('skips a line whose text is no longer what the search saw, and says which', () => {
		const r = applyReplacements('a cat\nedited cat line', [{ line: 0, text: 'a cat' }, { line: 1, text: 'b cat' }], opts, 'dog');
		expect(r.text).toBe('a dog\nedited cat line');
		expect(r.replaced).toBe(1);
		expect(r.skipped).toEqual([{ line: 1, reason: 'changed' }]);
	});

	it('skips a line that is gone because the note got shorter', () => {
		const r = applyReplacements('only', [{ line: 5, text: 'cat' }], opts, 'dog');
		expect(r.text).toBe('only');
		expect(r.skipped).toEqual([{ line: 5, reason: 'changed' }]);
	});

	it('keeps Windows line endings, and a final newline, exactly', () => {
		const r = applyReplacements('a cat\r\nb\r\nc cat\r\n', [{ line: 0, text: 'a cat' }, { line: 2, text: 'c cat' }], opts, 'dog');
		expect(r.text).toBe('a dog\r\nb\r\nc dog\r\n');
	});

	it('keeps mixed line endings line by line', () => {
		const r = applyReplacements('x cat\ny\r\nz cat\n', [{ line: 0, text: 'x cat' }, { line: 2, text: 'z cat' }], opts, 'dog');
		expect(r.text).toBe('x dog\ny\r\nz dog\n');
	});

	it('does nothing, and says so, when no line was chosen', () => {
		const r = applyReplacements('a cat', [], opts, 'dog');
		expect(r.text).toBe('a cat');
		expect(r.replaced).toBe(0);
	});

	it('counts a line once however many matches it holds, and a line the pattern no longer matches as unchanged', () => {
		const r = applyReplacements('cat cat', [{ line: 0, text: 'cat cat' }], opts, 'dog');
		expect(r.text).toBe('dog dog');
		expect(r.replaced).toBe(1);
		const none = applyReplacements('cat', [{ line: 0, text: 'cat' }], { query: 'bird' }, 'dog');
		expect(none.replaced).toBe(0);
		expect(none.skipped).toEqual([{ line: 0, reason: 'no-match' }]);
	});

	it('ignores a line asked for twice', () => {
		const r = applyReplacements('a cat', [{ line: 0, text: 'a cat' }, { line: 0, text: 'a cat' }], opts, 'dog');
		expect(r.text).toBe('a dog');
		expect(r.replaced).toBe(1);
		expect(r.skipped).toEqual([]);
	});
});

import { describe, it, expect } from 'vitest';
import { queryFromSelection, QUERY_FROM_SELECTION_LIMIT } from '../src/selectedquery';

describe('queryFromSelection', () => {
	it('is the selected text, trimmed', () => {
		expect(queryFromSelection('  网卡 ')).toBe('网卡');
	});

	it('is undefined when nothing, or only blanks, is selected, so the menu offers a plain search', () => {
		expect(queryFromSelection('')).toBeUndefined();
		expect(queryFromSelection(' \t\n ')).toBeUndefined();
		expect(queryFromSelection(undefined)).toBeUndefined();
	});

	it('takes the first line with text, because the box holds one line', () => {
		expect(queryFromSelection('first line\nsecond line')).toBe('first line');
		expect(queryFromSelection('\n\n  third\nfourth')).toBe('third');
		expect(queryFromSelection('a\r\nb')).toBe('a');
	});

	it('keeps a long selection to a length the box can show', () => {
		const long = 'x'.repeat(QUERY_FROM_SELECTION_LIMIT + 50);
		expect(queryFromSelection(long)).toBe('x'.repeat(QUERY_FROM_SELECTION_LIMIT));
		const exact = 'y'.repeat(QUERY_FROM_SELECTION_LIMIT);
		expect(queryFromSelection(exact)).toBe(exact);
	});

	it('does not cut a character in two at the limit', () => {
		const emoji = '😀'.repeat(QUERY_FROM_SELECTION_LIMIT + 5);
		const out = queryFromSelection(emoji) ?? '';
		expect([...out]).toHaveLength(QUERY_FROM_SELECTION_LIMIT);
		expect([...out].every((c) => c === '😀')).toBe(true);
	});

	it('trims again after cutting, so the query does not end in a blank', () => {
		const text = 'a'.repeat(QUERY_FROM_SELECTION_LIMIT - 1) + '   tail';
		expect(queryFromSelection(text)).toBe('a'.repeat(QUERY_FROM_SELECTION_LIMIT - 1));
	});
});

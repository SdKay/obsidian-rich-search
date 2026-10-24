import { describe, it, expect } from 'vitest';
import { isExcalidrawNote, textElementLines } from '../src/excalidraw';

const note = (...lines: string[]): string => lines.join('\n');

const sample = note(
	'---',
	'',
	'excalidraw-plugin: parsed',
	'tags: [excalidraw]',
	'',
	'---',
	'==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==',
	'',
	'',
	'# Excalidraw Data',
	'## Text Elements',
	'root ^SUGWYyYC',
	'',
	'Annual budget ^SP8OgmSD',
	'',
	'%%',
	'## Drawing',
	'```compressed-json',
	'N4KAkARALgngDgUwgLgAQQQDwMYEMA2AlgCYBOuA7hADTgQBuCpAzoQPYB2KqATLZMzYBXUtiRoIACyhQ4zZ',
	'```',
	'%%',
);

describe('isExcalidrawNote', () => {
	it('is true for a path ending in .excalidraw.md, in any case', () => {
		expect(isExcalidrawNote('tmp/Drawing 2024-09-25.excalidraw.md')).toBe(true);
		expect(isExcalidrawNote('A.EXCALIDRAW.MD')).toBe(true);
	});

	it('is false for an ordinary note, even one that mentions excalidraw', () => {
		expect(isExcalidrawNote('notes/excalidraw.md')).toBe(false);
		expect(isExcalidrawNote('notes/my.excalidraw.notes.md')).toBe(false);
		expect(isExcalidrawNote('notes/a.md')).toBe(false);
	});

	it('is false for a plain .excalidraw JSON file, which is a different format', () => {
		expect(isExcalidrawNote('a.excalidraw')).toBe(false);
	});

	it('looks at the file name only, not at folders above it', () => {
		expect(isExcalidrawNote('drawings.excalidraw.md/notes.md')).toBe(false);
		expect(isExcalidrawNote('a.excalidraw.md/b.excalidraw.md')).toBe(true);
	});

	it('needs a name in front of the extension, whatever folder it is in', () => {
		expect(isExcalidrawNote('.excalidraw.md')).toBe(false);
		expect(isExcalidrawNote('some/folder/.excalidraw.md')).toBe(false);
	});
});

describe('textElementLines', () => {
	it('returns the drawing text with its original line numbers and without the block id', () => {
		expect(textElementLines(sample)).toEqual([
			{ line: 11, text: 'root' },
			{ line: 13, text: 'Annual budget' },
		]);
	});

	it('returns nothing for a note with no text elements section', () => {
		expect(textElementLines(note('# Title', 'text'))).toEqual([]);
	});

	it('stops at the %% that ends the section, so the compressed data is never returned', () => {
		const lines = textElementLines(sample).map((l) => l.text).join('\n');
		expect(lines).not.toContain('N4KAkAR');
	});

	it('stops at the next heading when there is no %%', () => {
		const s = note('## Text Elements', 'one ^aaa', '', '## Drawing', 'two');
		expect(textElementLines(s).map((l) => l.text)).toEqual(['one']);
	});

	it('reads to the end of the note when nothing closes the section', () => {
		const s = note('## Text Elements', 'one ^aaa', 'two ^bbb');
		expect(textElementLines(s).map((l) => l.text)).toEqual(['one', 'two']);
	});

	it('keeps a line that has no block id', () => {
		expect(textElementLines(note('## Text Elements', 'plain text')).map((l) => l.text)).toEqual(['plain text']);
	});

	it('strips only a trailing block id, not a caret inside the text', () => {
		const s = note('## Text Elements', 'x^2 is a square ^abc123');
		expect(textElementLines(s).map((l) => l.text)).toEqual(['x^2 is a square']);
	});

	it('drops blank lines', () => {
		const s = note('## Text Elements', '', '   ', 'one ^a');
		expect(textElementLines(s)).toEqual([{ line: 3, text: 'one' }]);
	});

	it('handles CRLF line endings', () => {
		const s = '## Text Elements\r\none ^a\r\n\r\ntwo ^b\r\n%%';
		expect(textElementLines(s)).toEqual([{ line: 1, text: 'one' }, { line: 3, text: 'two' }]);
	});

	it('works with Chinese text', () => {
		const s = note('## Text Elements', '搜索范围 ^abc', '## Drawing');
		expect(textElementLines(s)).toEqual([{ line: 1, text: '搜索范围' }]);
	});

	it('keeps the lines of a multi-line text element together as separate lines', () => {
		const s = note('## Text Elements', 'first line', 'second line ^id', '## Drawing');
		expect(textElementLines(s).map((l) => l.text)).toEqual(['first line', 'second line']);
	});

	it('ignores a Text Elements heading inside a code block', () => {
		const s = note('```', '## Text Elements', 'fake ^a', '```');
		expect(textElementLines(s)).toEqual([]);
	});

	it('does not start on a similar heading', () => {
		expect(textElementLines(note('## Text Elements and more', 'x ^a'))).toEqual([]);
	});
});

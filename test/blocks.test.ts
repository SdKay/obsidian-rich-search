import { describe, it, expect } from 'vitest';
import { splitNote } from '../src/blocks';

const lines = (...l: string[]): string => l.join('\n');

describe('splitNote: finding fences', () => {
	it('returns no blocks for a note without fences', () => {
		expect(splitNote(lines('# Title', 'text')).blocks).toEqual([]);
	});

	it('finds a backtick block with its language, fence lines and source', () => {
		const note = lines('before', '```mermaid', 'graph TD', 'A-->B', '```', 'after');
		expect(splitNote(note).blocks).toEqual([
			{ language: 'mermaid', fromLine: 1, toLine: 4, source: 'graph TD\nA-->B' },
		]);
	});

	it('finds a tilde block', () => {
		const note = lines('~~~plantuml', '@startuml', '~~~');
		expect(splitNote(note).blocks).toEqual([{ language: 'plantuml', fromLine: 0, toLine: 2, source: '@startuml' }]);
	});

	it('finds several blocks in order', () => {
		const note = lines('```a', 'x', '```', 'text', '```b', 'y', '```');
		expect(splitNote(note).blocks.map((b) => [b.language, b.fromLine, b.toLine])).toEqual([['a', 0, 2], ['b', 4, 6]]);
	});

	it('lower-cases the language and uses the first word of the info string', () => {
		expect(splitNote(lines('```Rich-Table', 'x', '```')).blocks[0]?.language).toBe('rich-table');
		expect(splitNote(lines('```js title="a"', 'x', '```')).blocks[0]?.language).toBe('js');
	});

	it('gives an empty language to a fence with no info string', () => {
		expect(splitNote(lines('```', 'x', '```')).blocks[0]?.language).toBe('');
	});

	it('gives an empty source to an empty block', () => {
		expect(splitNote(lines('```a', '```')).blocks).toEqual([{ language: 'a', fromLine: 0, toLine: 1, source: '' }]);
	});
});

describe('splitNote: fence rules', () => {
	it('closes only on a fence at least as long as the opening one', () => {
		const note = lines('````md', '```', 'inner', '```', '````', 'after');
		const [block] = splitNote(note).blocks;
		expect(block).toEqual({ language: 'md', fromLine: 0, toLine: 4, source: '```\ninner\n```' });
	});

	it('does not close a backtick fence with tildes, or the reverse', () => {
		expect(splitNote(lines('```a', 'x', '~~~', 'y', '```')).blocks[0]?.toLine).toBe(4);
		expect(splitNote(lines('~~~a', 'x', '```', 'y', '~~~')).blocks[0]?.toLine).toBe(4);
	});

	it('does not close on a line with text after the closing fence', () => {
		expect(splitNote(lines('```a', 'x', '``` not closing', '```')).blocks[0]?.toLine).toBe(3);
	});

	it('treats an unclosed fence as running to the end of the note', () => {
		const note = lines('```a', 'x', 'y');
		expect(splitNote(note).blocks).toEqual([{ language: 'a', fromLine: 0, toLine: 2, source: 'x\ny' }]);
	});

	it('allows up to three spaces of indentation on a fence, not four', () => {
		expect(splitNote(lines('   ```a', 'x', '   ```')).blocks).toHaveLength(1);
		expect(splitNote(lines('    ```a', 'x', '    ```')).blocks).toHaveLength(0);
	});

	it('finds a fence inside a blockquote or a callout', () => {
		const note = lines('> [!note]', '> ```a', '> x', '> ```');
		const [block] = splitNote(note).blocks;
		expect(block).toEqual({ language: 'a', fromLine: 1, toLine: 3, source: 'x' });
	});

	it('does not treat backticks inside an inline span as a fence', () => {
		expect(splitNote('use ```code``` inline').blocks).toEqual([]);
	});

	it('does not start a backtick fence when the info string contains a backtick', () => {
		expect(splitNote(lines('```a`b', 'x', 'y')).blocks).toEqual([]);
		// The lone fence on line 2 is a valid opener, so the block starts there, not on line 0.
		expect(splitNote(lines('```a`b', 'x', '```')).blocks.map((b) => b.fromLine)).toEqual([2]);
	});

	it('accepts two-space-indented closing fences', () => {
		expect(splitNote(lines('```a', 'x', '  ```', 'tail')).blocks[0]?.toLine).toBe(2);
	});
});

describe('splitNote: line endings', () => {
	it('handles CRLF and reports clean lines', () => {
		const note = 'a\r\n```x\r\nline\r\n```\r\nb';
		const result = splitNote(note);
		expect(result.lines).toEqual(['a', '```x', 'line', '```', 'b']);
		expect(result.blocks).toEqual([{ language: 'x', fromLine: 1, toLine: 3, source: 'line' }]);
	});

	it('keeps line numbers aligned with the lines it returns', () => {
		const result = splitNote(lines('0', '1', '```a', '3', '```'));
		const [block] = result.blocks;
		expect(result.lines[block!.fromLine]).toBe('```a');
		expect(result.lines[block!.toLine]).toBe('```');
	});
});

describe('splitNote: front matter', () => {
	it('does not look for fences inside YAML front matter', () => {
		// A multi-line YAML string can legitimately start a line with a fence.
		const note = lines('---', 'snippet: |', '  x', '```a', '---', 'body');
		expect(splitNote(note).blocks).toEqual([]);
	});

	it('finds a fence right after the front matter, with line numbers counted from the top of the note', () => {
		const note = lines('---', 'title: t', '---', '```a', 'x', '```');
		expect(splitNote(note).blocks).toEqual([{ language: 'a', fromLine: 3, toLine: 5, source: 'x' }]);
	});

	it('treats a leading --- with no closing --- as plain text, not front matter', () => {
		const note = lines('---', '```a', 'x', '```');
		expect(splitNote(note).blocks.map((b) => b.fromLine)).toEqual([1]);
	});
});

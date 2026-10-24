import { describe, it, expect } from 'vitest';
import { isAllowed } from '../src/filter';
import type { FileFilter } from '../src/types';

const filter = (f: Partial<FileFilter> = {}): FileFilter => ({
	allowFolders: [],
	denyFolders: [],
	allowExtensions: [],
	denyExtensions: [],
	...f,
});

describe('isAllowed: folders', () => {
	it('allows everything when no list is set', () => {
		expect(isAllowed('a.md', filter())).toBe(true);
		expect(isAllowed('notes/deep/a.md', filter())).toBe(true);
	});

	it('without include folders, scope is every folder minus the excluded ones', () => {
		const f = filter({ denyFolders: ['archive'] });
		expect(isAllowed('archive/a.md', f)).toBe(false);
		expect(isAllowed('archive/old/a.md', f)).toBe(false);
		expect(isAllowed('notes/a.md', f)).toBe(true);
		expect(isAllowed('a.md', f)).toBe(true);
	});

	it('with include folders, scope is only those folders', () => {
		const f = filter({ allowFolders: ['projects'] });
		expect(isAllowed('projects/a.md', f)).toBe(true);
		expect(isAllowed('projects/sub/a.md', f)).toBe(true);
		expect(isAllowed('daily/a.md', f)).toBe(false);
	});

	it('a root-level file is outside every include folder', () => {
		expect(isAllowed('a.md', filter({ allowFolders: ['projects'] }))).toBe(false);
	});

	it('an exclude inside an include folder carves that subfolder out', () => {
		const f = filter({ allowFolders: ['projects'], denyFolders: ['projects/archive'] });
		expect(isAllowed('projects/a.md', f)).toBe(true);
		expect(isAllowed('projects/archive/a.md', f)).toBe(false);
		expect(isAllowed('projects/archive/deep/a.md', f)).toBe(false);
	});

	it('an exclude outside every include folder changes nothing', () => {
		const f = filter({ allowFolders: ['projects'], denyFolders: ['daily'] });
		expect(isAllowed('projects/a.md', f)).toBe(true);
		expect(isAllowed('daily/a.md', f)).toBe(false);
	});

	it('an exclude that is a parent of an include folder removes it', () => {
		const f = filter({ allowFolders: ['projects/rich-search'], denyFolders: ['projects'] });
		expect(isAllowed('projects/rich-search/a.md', f)).toBe(false);
	});

	it('compares whole path segments: notes does not match notes-old', () => {
		expect(isAllowed('notes-old/a.md', filter({ denyFolders: ['notes'] }))).toBe(true);
		expect(isAllowed('notes-old/a.md', filter({ allowFolders: ['notes'] }))).toBe(false);
	});

	it('a folder entry does not match a file with the same name', () => {
		expect(isAllowed('notes.md', filter({ denyFolders: ['notes'] }))).toBe(true);
		expect(isAllowed('a/b.md', filter({ denyFolders: ['a/b'] }))).toBe(true);
	});

	it('matches nested folder entries on every segment', () => {
		const f = filter({ allowFolders: ['a/b'] });
		expect(isAllowed('a/b/c/d.md', f)).toBe(true);
		expect(isAllowed('a/bc/d.md', f)).toBe(false);
		expect(isAllowed('x/a/b/d.md', f)).toBe(false);
	});

	it('accepts a folder entry with or without leading and trailing slashes', () => {
		for (const entry of ['notes', 'notes/', '/notes', '/notes/']) {
			expect(isAllowed('notes/a.md', filter({ allowFolders: [entry] }))).toBe(true);
			expect(isAllowed('other/a.md', filter({ allowFolders: [entry] }))).toBe(false);
		}
	});

	it('handles spaces and non-ASCII folder names', () => {
		const f = filter({ allowFolders: ['读书笔记', 'My Notes'] });
		expect(isAllowed('读书笔记/信息检索.md', f)).toBe(true);
		expect(isAllowed('My Notes/a b.md', f)).toBe(true);
		expect(isAllowed('读书/a.md', f)).toBe(false);
	});

	it('ignores blank entries instead of treating them as a folder', () => {
		expect(isAllowed('notes/a.md', filter({ denyFolders: ['', '  ', '/'] }))).toBe(true);
		expect(isAllowed('notes/a.md', filter({ allowFolders: ['', '/'] }))).toBe(true);
	});
});

describe('isAllowed: file types', () => {
	it('without include types, scope is every type minus the excluded ones', () => {
		const f = filter({ denyExtensions: ['excalidraw'] });
		expect(isAllowed('a.excalidraw', f)).toBe(false);
		expect(isAllowed('a.md', f)).toBe(true);
	});

	it('with include types, scope is only those types', () => {
		const f = filter({ allowExtensions: ['md'] });
		expect(isAllowed('a.md', f)).toBe(true);
		expect(isAllowed('a.drawio', f)).toBe(false);
	});

	it('an excluded type wins over an included one', () => {
		expect(isAllowed('a.md', filter({ allowExtensions: ['md'], denyExtensions: ['md'] }))).toBe(false);
	});

	it('compares extensions case-insensitively, with or without the dot', () => {
		for (const entry of ['md', '.md', 'MD', '.Md']) {
			expect(isAllowed('a.md', filter({ allowExtensions: [entry] }))).toBe(true);
			expect(isAllowed('A.MD', filter({ allowExtensions: [entry] }))).toBe(true);
			expect(isAllowed('a.txt', filter({ allowExtensions: [entry] }))).toBe(false);
		}
	});

	it('needs a real dot: md does not match a file called readmemd', () => {
		expect(isAllowed('readmemd', filter({ allowExtensions: ['md'] }))).toBe(false);
	});

	it('looks at the file name, not at a folder that ends in the extension', () => {
		expect(isAllowed('stuff.md/readme', filter({ allowExtensions: ['md'] }))).toBe(false);
		expect(isAllowed('stuff.md/readme', filter({ denyExtensions: ['md'] }))).toBe(true);
	});

	it('supports compound extensions next to their last part', () => {
		expect(isAllowed('d.excalidraw.md', filter({ denyExtensions: ['excalidraw.md'] }))).toBe(false);
		expect(isAllowed('note.md', filter({ denyExtensions: ['excalidraw.md'] }))).toBe(true);
		expect(isAllowed('d.excalidraw.md', filter({ allowExtensions: ['md'] }))).toBe(true);
	});

	it('a file with no extension is outside every include type', () => {
		expect(isAllowed('LICENSE', filter({ allowExtensions: ['md'] }))).toBe(false);
		expect(isAllowed('LICENSE', filter({ denyExtensions: ['md'] }))).toBe(true);
	});

	it('ignores blank entries instead of treating them as a type', () => {
		expect(isAllowed('a.md', filter({ denyExtensions: ['', '.'] }))).toBe(true);
		expect(isAllowed('a.md', filter({ allowExtensions: ['', '.'] }))).toBe(true);
	});
});

describe('isAllowed: folders and types together', () => {
	it('needs the folder scope and the type scope to both pass', () => {
		const f = filter({ allowFolders: ['projects'], allowExtensions: ['md'], denyFolders: ['projects/archive'] });
		expect(isAllowed('projects/a.md', f)).toBe(true);
		expect(isAllowed('projects/a.drawio', f)).toBe(false);
		expect(isAllowed('daily/a.md', f)).toBe(false);
		expect(isAllowed('projects/archive/a.md', f)).toBe(false);
	});
});

describe('isAllowed: excalidraw drawings', () => {
	const on = { excalidraw: true };
	const drawing = 'art/plan.excalidraw.md';
	const note = 'notes/a.md';

	it('with the setting on, a drawing belongs to .excalidraw and a plain note to .md', () => {
		const f = filter({ denyExtensions: ['excalidraw'] });
		expect(isAllowed(drawing, f, on)).toBe(false);
		expect(isAllowed(note, f, on)).toBe(true);
	});

	it('with the setting on, excluding .md leaves drawings alone', () => {
		const f = filter({ denyExtensions: ['md'] });
		expect(isAllowed(drawing, f, on)).toBe(true);
		expect(isAllowed(note, f, on)).toBe(false);
	});

	it('with the setting on, including only .md leaves drawings out', () => {
		const f = filter({ allowExtensions: ['md'] });
		expect(isAllowed(drawing, f, on)).toBe(false);
		expect(isAllowed(note, f, on)).toBe(true);
	});

	it('with the setting on, including only .excalidraw leaves plain notes out', () => {
		const f = filter({ allowExtensions: ['excalidraw'] });
		expect(isAllowed(drawing, f, on)).toBe(true);
		expect(isAllowed(note, f, on)).toBe(false);
	});

	it('with the setting on, both types included means both searched', () => {
		const f = filter({ allowExtensions: ['md', 'excalidraw'] });
		expect(isAllowed(drawing, f, on)).toBe(true);
		expect(isAllowed(note, f, on)).toBe(true);
	});

	it('with the setting on, an excluded .excalidraw beats an included one', () => {
		const f = filter({ allowExtensions: ['excalidraw'], denyExtensions: ['excalidraw'] });
		expect(isAllowed(drawing, f, on)).toBe(false);
	});

	it('compares the type case-insensitively and with or without the dot', () => {
		expect(isAllowed(drawing, filter({ denyExtensions: ['.Excalidraw'] }), on)).toBe(false);
		expect(isAllowed('A.EXCALIDRAW.MD', filter({ denyExtensions: ['excalidraw'] }), on)).toBe(false);
	});

	it('still applies the folder rules to drawings', () => {
		expect(isAllowed(drawing, filter({ denyFolders: ['art'] }), on)).toBe(false);
		expect(isAllowed(drawing, filter({ allowFolders: ['other'] }), on)).toBe(false);
		expect(isAllowed(drawing, filter({ allowFolders: ['art'] }), on)).toBe(true);
	});

	it('with the setting off, a drawing is just a .md file', () => {
		const off = { excalidraw: false };
		expect(isAllowed(drawing, filter({ denyExtensions: ['md'] }), off)).toBe(false);
		expect(isAllowed(drawing, filter({ denyExtensions: ['excalidraw'] }), off)).toBe(true);
		expect(isAllowed(drawing, filter({ allowExtensions: ['md'] }), off)).toBe(true);
	});

	it('without the option, behaves as with the setting off', () => {
		expect(isAllowed(drawing, filter({ denyExtensions: ['md'] }))).toBe(false);
		expect(isAllowed(drawing, filter({ denyExtensions: ['excalidraw'] }))).toBe(true);
	});

	it('with the setting on, a plain .excalidraw JSON file is not a drawing note and keeps its own extension', () => {
		expect(isAllowed('x.excalidraw', filter({ denyExtensions: ['excalidraw'] }), on)).toBe(true);
		expect(isAllowed('x.excalidraw', filter({ allowExtensions: ['excalidraw'] }), on)).toBe(false);
	});

	it('with the setting off, a plain .excalidraw file is matched by its extension as before', () => {
		const off = { excalidraw: false };
		expect(isAllowed('x.excalidraw', filter({ denyExtensions: ['excalidraw'] }), off)).toBe(false);
		expect(isAllowed('x.excalidraw', filter({ allowExtensions: ['excalidraw'] }), off)).toBe(true);
	});

	it('does not treat a folder whose name looks like a drawing as one', () => {
		expect(isAllowed('x.excalidraw.md/n.md', filter({ denyExtensions: ['excalidraw'] }), on)).toBe(true);
	});
});

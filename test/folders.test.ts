import { describe, it, expect } from 'vitest';
import { scopeToFolder, suggestFolders, withAlwaysExcluded } from '../src/folders';
import { isAllowed } from '../src/filter';
import type { FileFilter } from '../src/types';

const all = ['archive', 'archive/old', 'daily', 'projects', 'projects/rich-search', 'projects/rich-table', '读书笔记', '读书笔记/信息检索', 'Notes/Daily'];

describe('suggestFolders', () => {
	it('returns every folder for an empty query, shorter paths first', () => {
		const r = suggestFolders('', all);
		expect(r).toHaveLength(all.length);
		const lengths = r.map((p) => p.length);
		expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
	});

	it('matches anywhere in the path, case-insensitively', () => {
		expect(suggestFolders('RICH', all).sort()).toEqual(['projects/rich-search', 'projects/rich-table']);
	});

	it('puts a folder whose path starts with the query before one that only contains it', () => {
		const r = suggestFolders('arch', ['old/archive', 'archive']);
		expect(r).toEqual(['archive', 'old/archive']);
	});

	it('puts a folder whose last segment starts with the query before a looser match', () => {
		const r = suggestFolders('rich', ['a/b/rich', 'xrich', 'projects/rich-search']);
		expect(r[r.length - 1]).toBe('xrich');
	});

	it('works with non-ASCII folder names', () => {
		expect(suggestFolders('读书', all)).toEqual(['读书笔记', '读书笔记/信息检索']);
		expect(suggestFolders('信息', all)).toEqual(['读书笔记/信息检索']);
	});

	it('matches a folder whose name has capitals when the query is lower case', () => {
		expect(suggestFolders('daily', all).sort()).toEqual(['Notes/Daily', 'daily']);
		expect(suggestFolders('notes/d', all)).toEqual(['Notes/Daily']);
	});

	it('ignores a leading slash in the query', () => {
		expect(suggestFolders('/proj', all)).toEqual(suggestFolders('proj', all));
	});

	it('finds a folder when the query is a path with a trailing slash', () => {
		const r = suggestFolders('projects/', all);
		expect(r[0]).toBe('projects');
		expect(r.slice().sort()).toEqual(['projects', 'projects/rich-search', 'projects/rich-table']);
	});

	it('returns nothing when no folder matches', () => {
		expect(suggestFolders('zzz', all)).toEqual([]);
	});

	it('caps the number of suggestions', () => {
		const many = Array.from({ length: 100 }, (_, i) => `f${i}`);
		expect(suggestFolders('f', many, 20)).toHaveLength(20);
	});

	it('never lists the vault root as a suggestion, since an empty entry means nothing', () => {
		expect(suggestFolders('', ['', '/', 'a'])).toEqual(['a']);
	});

	it('does not repeat a folder', () => {
		expect(suggestFolders('a', ['a', 'a', 'a/b'])).toEqual(['a', 'a/b']);
	});
});

describe('scopeToFolder', () => {
	const filter: FileFilter = { allowFolders: ['a', 'b'], denyFolders: ['b/old'], allowExtensions: ['md'], denyExtensions: ['pdf'] };

	it('makes the folder the only included one and clears the excluded ones', () => {
		expect(scopeToFolder(filter, 'projects/rich-search')).toMatchObject({ allowFolders: ['projects/rich-search'], denyFolders: [] });
	});

	it('leaves the file types alone', () => {
		const out = scopeToFolder(filter, 'x');
		expect(out.allowExtensions).toEqual(['md']);
		expect(out.denyExtensions).toEqual(['pdf']);
	});

	it('does not change the filter it was given', () => {
		scopeToFolder(filter, 'x');
		expect(filter.allowFolders).toEqual(['a', 'b']);
		expect(filter.denyFolders).toEqual(['b/old']);
	});

	it('writes the folder the way the scope panel does, without slashes at the ends', () => {
		expect(scopeToFolder(filter, '/projects/rich-search/').allowFolders).toEqual(['projects/rich-search']);
	});

	it('searches everywhere for the vault root, since an empty include list means every folder', () => {
		expect(scopeToFolder(filter, '/').allowFolders).toEqual([]);
		expect(scopeToFolder(filter, '').allowFolders).toEqual([]);
	});
});

describe('withAlwaysExcluded', () => {
	const base: FileFilter = { allowFolders: [], denyFolders: ['drafts'], allowExtensions: ['md'], denyExtensions: [] };

	it('adds the always-excluded folders to the ones excluded in the panel', () => {
		expect(withAlwaysExcluded(base, ['archive', 'tmp']).denyFolders).toEqual(['drafts', 'archive', 'tmp']);
	});

	it('leaves the other lists as they were', () => {
		const out = withAlwaysExcluded({ ...base, allowFolders: ['notes'] }, ['archive']);
		expect(out.allowFolders).toEqual(['notes']);
		expect(out.allowExtensions).toEqual(['md']);
	});

	it('does not repeat a folder that is in both lists', () => {
		expect(withAlwaysExcluded(base, ['drafts', 'archive']).denyFolders).toEqual(['drafts', 'archive']);
	});

	it('ignores blank lines', () => {
		expect(withAlwaysExcluded(base, ['', '  ', 'archive']).denyFolders).toEqual(['drafts', 'archive']);
	});

	it('returns the filter unchanged for no folders, and never changes the one it was given', () => {
		expect(withAlwaysExcluded(base, [])).toEqual(base);
		withAlwaysExcluded(base, ['archive']);
		expect(base.denyFolders).toEqual(['drafts']);
	});

	it('keeps a folder out even when the panel asks to search inside it', () => {
		const inFolder = scopeToFolder(base, 'archive/2020');
		const filter = withAlwaysExcluded(inFolder, ['archive']);
		expect(isAllowed('archive/2020/a.md', filter)).toBe(false);
		expect(isAllowed('notes/a.md', withAlwaysExcluded(base, ['archive']))).toBe(true);
	});
});

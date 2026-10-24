import { describe, it, expect } from 'vitest';
import { suggestFolders } from '../src/folders';

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

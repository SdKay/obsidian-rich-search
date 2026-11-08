import { describe, it, expect } from 'vitest';
import { effectiveFilter, inScope, type PropertyLookup } from '../src/scope';
import type { PropertyCondition } from '../src/properties';
import type { FileFilter } from '../src/types';

const none: FileFilter = { allowFolders: [], denyFolders: [], allowExtensions: [], denyExtensions: [], properties: [] };
const settings = (filter: FileFilter, alwaysExcludeFolders: string[] = [], excalidraw = false) => ({ filter, alwaysExcludeFolders, excalidraw });

describe('inScope', () => {
	it('includes everything when no scope is set', () => {
		expect(inScope('a/b.md', settings(none))).toBe(true);
	});

	it('is false for a file outside the folder the search is limited to', () => {
		const s = settings({ ...none, allowFolders: ['1-areas/tools'] });
		expect(inScope('1-areas/tools/x.md', s)).toBe(true);
		expect(inScope('1-areas/networking/y.drawio', s)).toBe(false);
	});

	it('is false for a folder excluded in the panel or in the settings', () => {
		expect(inScope('drafts/a.md', settings({ ...none, denyFolders: ['drafts'] }))).toBe(false);
		expect(inScope('archive/a.md', settings(none, ['archive']))).toBe(false);
	});

	it('is false for a file type that is switched off', () => {
		expect(inScope('a.pdf', settings({ ...none, denyExtensions: ['pdf'] }))).toBe(false);
		expect(inScope('a.md', settings({ ...none, allowExtensions: ['pdf'] }))).toBe(false);
	});

	it('tells a drawing from a note when drawings are their own type', () => {
		const s = settings({ ...none, allowExtensions: ['excalidraw'] }, [], true);
		expect(inScope('d.excalidraw.md', s)).toBe(true);
		expect(inScope('n.md', s)).toBe(false);
	});
});

describe('effectiveFilter', () => {
	it('is the panel filter plus the folders always excluded, and changes neither', () => {
		const panel = { ...none, denyFolders: ['drafts'] };
		const out = effectiveFilter(settings(panel, ['archive']));
		expect(out.denyFolders).toEqual(['drafts', 'archive']);
		expect(panel.denyFolders).toEqual(['drafts']);
	});
});

describe('inScope with property conditions', () => {
	const cond = (key: string, op: PropertyCondition['op'], ...values: string[]): PropertyCondition => ({ key, op, values });
	const withConditions = (...properties: PropertyCondition[]) => settings({ ...none, properties });
	const notes: Record<string, Record<string, unknown> | undefined> = {
		'a.md': { status: 'doing' },
		'b.md': { status: 'done' },
		'bare.md': undefined,
	};
	const calls: string[] = [];
	const lookup: PropertyLookup = (path) => { calls.push(path); return path in notes ? { found: true, frontmatter: notes[path] } : { found: false }; };

	it('with no condition every note is covered and nothing is looked up', () => {
		calls.length = 0;
		expect(inScope('a.md', settings(none), lookup)).toBe(true);
		expect(calls).toEqual([]);
	});

	it('covers a note whose properties meet every condition', () => {
		expect(inScope('a.md', withConditions(cond('status', 'is', 'doing')), lookup)).toBe(true);
		expect(inScope('b.md', withConditions(cond('status', 'is', 'doing')), lookup)).toBe(false);
	});

	it('never looks up a file the path already rules out, so a filtered-out file costs nothing', () => {
		calls.length = 0;
		const s = settings({ ...none, denyFolders: ['archive'], properties: [cond('status', 'is', 'doing')] });
		expect(inScope('archive/a.md', s, lookup)).toBe(false);
		expect(calls).toEqual([]);
	});

	it('leaves out a file that is not a note while a condition is active: it has no properties', () => {
		calls.length = 0;
		expect(inScope('x.pdf', withConditions(cond('status', 'is', 'doing')), lookup)).toBe(false);
		expect(inScope('x.xlsx', withConditions(cond('status', 'unset')), lookup)).toBe(false);
		expect(calls).toEqual([]);
	});

	it('a note with no frontmatter has no properties: unset holds, is does not', () => {
		expect(inScope('bare.md', withConditions(cond('status', 'unset')), lookup)).toBe(true);
		expect(inScope('bare.md', withConditions(cond('status', 'is', 'doing')), lookup)).toBe(false);
	});

	it('a note the cache does not know yet is covered, so results are not hidden while it fills in', () => {
		expect(inScope('new.md', withConditions(cond('status', 'is', 'doing')), lookup)).toBe(true);
		expect(inScope('new.md', withConditions(cond('status', 'unset')), lookup)).toBe(true);
	});

	it('without a lookup, a condition cannot be decided, so a note is covered', () => {
		expect(inScope('a.md', withConditions(cond('status', 'is', 'nope')))).toBe(true);
	});

	it('passes the declared types to the matcher', () => {
		const typed = (types: Record<string, never>) => inScope('n.md', withConditions(cond('year', 'gt', '3')), (path) => ({ found: true, frontmatter: { year: '5' }, ...(path ? { types } : {}) }));
		expect(typed({ year: 'number' } as never)).toBe(true);
		expect(typed({ year: 'text' } as never)).toBe(false);
	});

	it('a lookup that throws counts as a note not known yet', () => {
		expect(inScope('a.md', withConditions(cond('status', 'is', 'x')), () => { throw new Error('boom'); })).toBe(true);
	});
});

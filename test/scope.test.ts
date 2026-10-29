import { describe, it, expect } from 'vitest';
import { effectiveFilter, inScope } from '../src/scope';
import type { FileFilter } from '../src/types';

const none: FileFilter = { allowFolders: [], denyFolders: [], allowExtensions: [], denyExtensions: [] };
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

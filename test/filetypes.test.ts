import { describe, it, expect } from 'vitest';
import { fileTypeRows, toggleType, setAllTypes, buildFileTypeSources, sameSources, type FileTypeSource } from '../src/filetypes';
import type { ExtensionProvider } from '../src/providers';
import type { FileFilter } from '../src/types';

const none: FileFilter = { allowFolders: [], denyFolders: [], allowExtensions: [], denyExtensions: [] };
const sources: FileTypeSource[] = [
	{ ext: 'md', available: true },
	{ ext: 'drawio', available: false, needs: 'Rich View' },
	{ ext: 'xlsx', available: false, needs: 'Rich Table' },
];

describe('fileTypeRows', () => {
	it('lists the known types in order, checked when available and not denied', () => {
		expect(fileTypeRows(none, sources).map((r) => [r.ext, r.checked])).toEqual([['md', true], ['drawio', false], ['xlsx', false]]);
	});

	it('checks an available type that is not denied, whatever the others are', () => {
		const rows = fileTypeRows(none, [{ ext: 'md', available: true }, { ext: 'txt', available: true }]);
		expect(rows.map((r) => r.checked)).toEqual([true, true]);
	});

	it('shows a denied type as unchecked', () => {
		const rows = fileTypeRows({ ...none, denyExtensions: ['md'] }, sources);
		expect(rows.find((r) => r.ext === 'md')?.checked).toBe(false);
	});

	it('marks a type with no reader as unavailable and says which plugin it needs', () => {
		const row = fileTypeRows(none, sources).find((r) => r.ext === 'drawio');
		expect(row).toMatchObject({ available: false, needs: 'Rich View' });
	});

	it('never shows an unavailable type as checked, since it cannot be searched', () => {
		const rows = fileTypeRows(none, sources);
		expect(rows.filter((r) => !r.available).every((r) => !r.checked)).toBe(true);
	});

	it('compares the deny list case-insensitively and ignores a leading dot', () => {
		const rows = fileTypeRows({ ...none, denyExtensions: ['.MD'] }, sources);
		expect(rows.find((r) => r.ext === 'md')?.checked).toBe(false);
	});

	it('respects an include list: a type outside it is unchecked', () => {
		const rows = fileTypeRows({ ...none, allowExtensions: ['md'] }, [{ ext: 'md', available: true }, { ext: 'txt', available: true }]);
		expect(rows.map((r) => [r.ext, r.checked])).toEqual([['md', true], ['txt', false]]);
	});

	it('a denied type is unchecked even when it is also in the include list', () => {
		const rows = fileTypeRows({ ...none, allowExtensions: ['md'], denyExtensions: ['md'] }, sources);
		expect(rows.find((r) => r.ext === 'md')?.checked).toBe(false);
	});
});

describe('toggleType', () => {
	it('unchecking adds the type to the deny list', () => {
		expect(toggleType(none, 'md', false).denyExtensions).toEqual(['md']);
	});

	it('checking removes it from the deny list', () => {
		expect(toggleType({ ...none, denyExtensions: ['md', 'txt'] }, 'md', true).denyExtensions).toEqual(['txt']);
	});

	it('does not add a type twice', () => {
		expect(toggleType({ ...none, denyExtensions: ['md'] }, 'md', false).denyExtensions).toEqual(['md']);
	});

	it('removes every spelling of the type when checking it', () => {
		expect(toggleType({ ...none, denyExtensions: ['.MD', 'md'] }, 'md', true).denyExtensions).toEqual([]);
	});

	it('checking a type that an include list leaves out adds it to the include list', () => {
		expect(toggleType({ ...none, allowExtensions: ['md'] }, 'txt', true).allowExtensions).toEqual(['md', 'txt']);
	});

	it('leaves other lists alone and does not change its input', () => {
		const before: FileFilter = { allowFolders: ['a'], denyFolders: ['b'], allowExtensions: [], denyExtensions: [] };
		const after = toggleType(before, 'md', false);
		expect(after.allowFolders).toEqual(['a']);
		expect(after.denyFolders).toEqual(['b']);
		expect(before.denyExtensions).toEqual([]);
	});

	it('returns lists the caller can edit without touching the input', () => {
		const before: FileFilter = { allowFolders: [], denyFolders: [], allowExtensions: ['md'], denyExtensions: [] };
		const after = toggleType(before, 'md', true);
		after.allowExtensions.push('x');
		expect(before.allowExtensions).toEqual(['md']);
	});
});

describe('setAllTypes', () => {
	it('deselect all denies every listed type', () => {
		const f = setAllTypes(none, sources, false);
		expect(f.denyExtensions.sort()).toEqual(['drawio', 'md', 'xlsx']);
	});

	it('select all clears the listed types from the deny list but keeps unrelated entries', () => {
		const f = setAllTypes({ ...none, denyExtensions: ['md', 'drawio', 'bkp'] }, sources, true);
		expect(f.denyExtensions).toEqual(['bkp']);
	});

	it('select all also puts the listed types into an include list that would leave them out', () => {
		const f = setAllTypes({ ...none, allowExtensions: ['md'] }, sources, true);
		expect(f.allowExtensions.sort()).toEqual(['drawio', 'md', 'xlsx']);
	});

	it('select all leaves an empty include list empty, which already means every type', () => {
		expect(setAllTypes(none, sources, true).allowExtensions).toEqual([]);
	});
});

describe('buildFileTypeSources', () => {
	const found = (ext: string, status: ExtensionProvider['status'], plugin: string): ExtensionProvider => ({ ext, status, plugin, viewRegistered: true });
	const providers = [found('xlsx', 'available', 'Rich Table'), found('drawio', 'missing', 'Rich View')];

	it('always offers Markdown, first', () => {
		expect(buildFileTypeSources(providers, { excalidraw: false, excalidrawPlugin: 'missing' })[0]).toEqual({ ext: 'md', available: true });
	});

	it('offers .excalidraw only when the setting is on', () => {
		const off = buildFileTypeSources(providers, { excalidraw: false, excalidrawPlugin: 'enabled' });
		expect(off.some((s) => s.ext === 'excalidraw')).toBe(false);
		const on = buildFileTypeSources(providers, { excalidraw: true, excalidrawPlugin: 'enabled' });
		expect(on.some((s) => s.ext === 'excalidraw')).toBe(true);
	});

	it('makes .excalidraw available when the Excalidraw plugin is installed', () => {
		const row = buildFileTypeSources(providers, { excalidraw: true, excalidrawPlugin: 'enabled' }).find((s) => s.ext === 'excalidraw');
		expect(row).toMatchObject({ available: true });
	});

	it('greys .excalidraw out and names the plugin when Excalidraw is not installed', () => {
		const row = buildFileTypeSources(providers, { excalidraw: true, excalidrawPlugin: 'missing' }).find((s) => s.ext === 'excalidraw');
		expect(row).toMatchObject({ available: false, needs: 'Excalidraw' });
	});

	it('keeps the order: md, pdf, excalidraw, then the provider types', () => {
		const order = buildFileTypeSources(providers, { excalidraw: true, excalidrawPlugin: 'enabled' }).map((s) => s.ext);
		expect(order).toEqual(['md', 'pdf', 'excalidraw', 'xlsx', 'drawio']);
	});

	it('marks provider types by their status', () => {
		const rows = buildFileTypeSources(providers, { excalidraw: false, excalidrawPlugin: 'missing' });
		expect(rows.find((s) => s.ext === 'xlsx')).toMatchObject({ available: true });
		expect(rows.find((s) => s.ext === 'drawio')).toMatchObject({ available: false, needs: 'Rich View', hint: 'install' });
	});

	it('says enable, not install, for a provider plugin that is installed but switched off', () => {
		const rows = buildFileTypeSources([found('xlsx', 'disabled', 'Rich Table')], { excalidraw: false, excalidrawPlugin: 'missing' });
		expect(rows.find((s) => s.ext === 'xlsx')).toMatchObject({ available: false, hint: 'enable', needs: 'Rich Table' });
	});

	it('gives an available Excalidraw type no hint either', () => {
		const row = buildFileTypeSources(providers, { excalidraw: true, excalidrawPlugin: 'enabled' }).find((s) => s.ext === 'excalidraw');
		expect(row).toStrictEqual({ ext: 'excalidraw', available: true, needs: 'Excalidraw' });
	});

	it('gives an available type no hint', () => {
		const rows = buildFileTypeSources(providers, { excalidraw: false, excalidrawPlugin: 'missing' });
		expect(rows.find((s) => s.ext === 'xlsx')).toStrictEqual({ ext: 'xlsx', available: true });
	});

	it('tells an Excalidraw plugin that is installed but off from one that is not there', () => {
		const off = buildFileTypeSources(providers, { excalidraw: true, excalidrawPlugin: 'disabled' }).find((s) => s.ext === 'excalidraw');
		expect(off).toMatchObject({ available: false, hint: 'enable', needs: 'Excalidraw' });
		const gone = buildFileTypeSources(providers, { excalidraw: true, excalidrawPlugin: 'missing' }).find((s) => s.ext === 'excalidraw');
		expect(gone).toMatchObject({ available: false, hint: 'install', needs: 'Excalidraw' });
	});

	it('marks an out-of-date provider so the hint says update, not install', () => {
		const rows = buildFileTypeSources([found('xlsx', 'outdated', 'Rich Table')], { excalidraw: false, excalidrawPlugin: 'missing' });
		expect(rows.find((s) => s.ext === 'xlsx')).toMatchObject({ available: false, hint: 'update' });
	});
});

describe('sameSources', () => {
	const a: FileTypeSource[] = [{ ext: 'md', available: true }, { ext: 'xlsx', available: false, needs: 'Rich Table' }];

	it('is true for the same list, whether or not it is the same object', () => {
		expect(sameSources(a, a)).toBe(true);
		expect(sameSources(a, a.map((x) => ({ ...x })))).toBe(true);
	});

	it('is true for two empty lists', () => {
		expect(sameSources([], [])).toBe(true);
	});

	it('is false when a type becomes available', () => {
		expect(sameSources(a, [{ ext: 'md', available: true }, { ext: 'xlsx', available: true, needs: 'Rich Table' }])).toBe(false);
	});

	it('is false when a type is added or removed', () => {
		expect(sameSources(a, [...a, { ext: 'drawio', available: false }])).toBe(false);
		expect(sameSources(a, a.slice(0, 1))).toBe(false);
	});

	it('is false when the order differs, since the panel shows them in order', () => {
		expect(sameSources(a, [...a].reverse())).toBe(false);
	});

	it('is false when the plugin it needs, or whether it needs updating, changes', () => {
		expect(sameSources(a, [a[0]!, { ext: 'xlsx', available: false, needs: 'Rich View' }])).toBe(false);
		expect(sameSources(a, [a[0]!, { ext: 'xlsx', available: false, needs: 'Rich Table', hint: 'update' }])).toBe(false);
	});

	it('treats an absent hint as the same as another absent hint', () => {
		expect(sameSources([{ ext: 'x', available: true }], [{ ext: 'x', available: true }])).toBe(true);
	});

	it('tells an installed-but-off plugin from a missing one', () => {
		expect(sameSources([{ ext: 'x', available: false, hint: 'enable' }], [{ ext: 'x', available: false, hint: 'install' }])).toBe(false);
	});
});

describe('buildFileTypeSources: pdf', () => {
	it('always offers pdf, which Rich Search reads itself, right after Markdown', () => {
		const list = buildFileTypeSources([], { excalidraw: false, excalidrawPlugin: 'missing' });
		expect(list.slice(0, 2)).toEqual([{ ext: 'md', available: true }, { ext: 'pdf', available: true }]);
	});
});

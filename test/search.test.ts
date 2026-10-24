import { describe, it, expect } from 'vitest';
import { search, type BinaryReader, type SearchFile, type SearchProgress } from '../src/search';
import type { ExtractedLine, ExtractResult } from '../src/richSearchApi';
import type { FileFilter } from '../src/types';

const noFilter: FileFilter = { allowFolders: [], denyFolders: [], allowExtensions: [], denyExtensions: [] };

function vault(notes: Record<string, string>) {
	const reads: string[] = [];
	const files: SearchFile[] = Object.keys(notes).map((path) => ({ path }));
	const read = (path: string): Promise<string> => {
		reads.push(path);
		const text = notes[path];
		return text === undefined ? Promise.reject(new Error(`missing ${path}`)) : Promise.resolve(text);
	};
	return { files, read, reads };
}

const never = (): Promise<void> => Promise.resolve();

describe('search: results', () => {
	it('returns hits with 0-based line, the line text and match spans, in file order', async () => {
		const v = vault({ 'a.md': 'one\ntwo cat\nthree', 'b.md': 'cat', 'c.md': 'dog' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter });
		expect(r).toMatchObject({ ok: true });
		if (!r.ok) return;
		expect(r.hits).toEqual([
			{ path: 'a.md', line: 1, text: 'two cat', spans: [{ start: 4, end: 7 }] },
			{ path: 'b.md', line: 0, text: 'cat', spans: [{ start: 0, end: 3 }] },
		]);
	});

	it('splits CRLF notes into clean lines', async () => {
		const v = vault({ 'a.md': 'x\r\ncat\r\ny' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter });
		expect(r.ok && r.hits).toEqual([{ path: 'a.md', line: 1, text: 'cat', spans: [{ start: 0, end: 3 }] }]);
	});

	it('applies the match options (whole word, case)', async () => {
		const v = vault({ 'a.md': 'concat\nCat' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat', wholeWord: true, caseSensitive: true }, filter: noFilter });
		expect(r.ok && r.hits).toEqual([]);
	});
});

describe('search: what is read', () => {
	it('never reads a file the path filter denies', async () => {
		const v = vault({ 'archive/a.md': 'cat', 'notes/b.md': 'cat' });
		const filter = { ...noFilter, denyFolders: ['archive'] };
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter });
		expect(v.reads).toEqual(['notes/b.md']);
		expect(r.ok && r.hits.map((h) => h.path)).toEqual(['notes/b.md']);
	});

	it('never reads a file outside the include list', async () => {
		const v = vault({ 'projects/a.md': 'cat', 'daily/b.md': 'cat' });
		await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: { ...noFilter, allowFolders: ['projects'] } });
		expect(v.reads).toEqual(['projects/a.md']);
	});

	it('does not read a file type it has no reader for, even when the filter allows it', async () => {
		const v = vault({ 'a.md': 'cat', 'b.xlsx': 'cat', 'c.excalidraw': 'cat', 'd.png': 'cat' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter });
		expect(v.reads).toEqual(['a.md']);
		expect(r.ok && r.hits.map((h) => h.path)).toEqual(['a.md']);
	});

	it('treats .md in any case as a note', async () => {
		const v = vault({ 'A.MD': 'cat' });
		await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter });
		expect(v.reads).toEqual(['A.MD']);
	});

	it('returns the error and reads nothing for an invalid pattern', async () => {
		const v = vault({ 'a.md': 'cat' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: '(', regex: true }, filter: noFilter });
		expect(r.ok).toBe(false);
		expect(!r.ok && r.error).not.toBe('');
		expect(v.reads).toEqual([]);
	});

	it('returns an error and reads nothing for an empty query', async () => {
		const v = vault({ 'a.md': 'cat' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: '' }, filter: noFilter });
		expect(r.ok).toBe(false);
		expect(v.reads).toEqual([]);
	});
});

describe('search: not blocking the UI', () => {
	it('yields between batches, not after the last one', async () => {
		const v = vault({ 'a.md': 'x', 'b.md': 'x', 'c.md': 'x', 'd.md': 'x', 'e.md': 'x' });
		let yields = 0;
		await search({ files: v.files, read: v.read, yieldToUi: () => { yields++; return Promise.resolve(); }, match: { query: 'x' }, filter: noFilter, batchSize: 2 });
		expect(yields).toBe(2);
	});

	it('reads at most batchSize files before yielding', async () => {
		const v = vault({ 'a.md': 'x', 'b.md': 'x', 'c.md': 'x', 'd.md': 'x', 'e.md': 'x' });
		const readsAtYield: number[] = [];
		await search({ files: v.files, read: v.read, yieldToUi: () => { readsAtYield.push(v.reads.length); return Promise.resolve(); }, match: { query: 'x' }, filter: noFilter, batchSize: 2 });
		expect(readsAtYield).toEqual([2, 4]);
	});

	it('stops reading further files once cancelled', async () => {
		const v = vault({ 'a.md': 'x', 'b.md': 'x', 'c.md': 'x', 'd.md': 'x', 'e.md': 'x' });
		const controller = new AbortController();
		const r = await search({
			files: v.files, read: v.read, match: { query: 'x' }, filter: noFilter, batchSize: 2,
			signal: controller.signal,
			yieldToUi: () => { controller.abort(); return Promise.resolve(); },
		});
		expect(v.reads).toEqual(['a.md', 'b.md']);
		expect(r).toMatchObject({ ok: true, cancelled: true });
	});

	it('does not read anything when already cancelled', async () => {
		const v = vault({ 'a.md': 'x' });
		const controller = new AbortController();
		controller.abort();
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'x' }, filter: noFilter, signal: controller.signal });
		expect(v.reads).toEqual([]);
		expect(r).toMatchObject({ ok: true, cancelled: true, hits: [] });
	});

	it('reports progress after each batch and the hits found so far', async () => {
		const v = vault({ 'a.md': 'x', 'b.md': 'no', 'c.md': 'x' });
		const seen: { scanned: number; total: number; paths: string[] }[] = [];
		await search({
			files: v.files, read: v.read, yieldToUi: never, match: { query: 'x' }, filter: noFilter, batchSize: 2,
			onProgress: (p) => seen.push({ scanned: p.scanned, total: p.total, paths: p.hits.map((h) => h.path) }),
		});
		expect(seen).toEqual([
			{ scanned: 2, total: 3, paths: ['a.md'] },
			{ scanned: 3, total: 3, paths: ['a.md', 'c.md'] },
		]);
	});

	it('hands out a snapshot of the hits, so later batches do not change what was reported', async () => {
		const v = vault({ 'a.md': 'x', 'b.md': 'x' });
		const lengths: number[] = [];
		const kept: SearchProgress[] = [];
		await search({
			files: v.files, read: v.read, yieldToUi: never, match: { query: 'x' }, filter: noFilter, batchSize: 1,
			onProgress: (p) => { kept.push(p); lengths.push(p.hits.length); },
		});
		expect(kept.map((p) => p.hits.length)).toEqual(lengths);
		expect(lengths).toEqual([1, 2]);
	});

	it('counts only files that will be read in the progress total', async () => {
		const v = vault({ 'a.md': 'x', 'archive/b.md': 'x', 'c.png': 'x' });
		const seen: SearchProgress[] = [];
		await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'x' }, filter: { ...noFilter, denyFolders: ['archive'] }, onProgress: (p) => seen.push(p) });
		expect(seen.map((p) => [p.scanned, p.total, p.hits.length])).toEqual([[1, 1, 1]]);
	});
});

describe('search: unreadable files', () => {
	it('records a file that fails to read and carries on', async () => {
		const files: SearchFile[] = [{ path: 'a.md' }, { path: 'bad.md' }, { path: 'c.md' }];
		const read = (path: string): Promise<string> => (path === 'bad.md' ? Promise.reject(new Error('disk')) : Promise.resolve('x'));
		const r = await search({ files, read, yieldToUi: never, match: { query: 'x' }, filter: noFilter });
		expect(r).toMatchObject({ ok: true });
		if (!r.ok) return;
		expect(r.hits.map((h) => h.path)).toEqual(['a.md', 'c.md']);
		expect(r.failed).toEqual([{ path: 'bad.md', error: 'disk' }]);
	});
});

describe('search: fenced code blocks', () => {
	const note = ['cat outside', '```mermaid', 'cat inside', '```', 'cat after'].join('\n');

	it('searches block content as plain text by default', async () => {
		const v = vault({ 'a.md': note });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter });
		expect(r.ok && r.hits.map((h) => h.line)).toEqual([0, 2, 4]);
	});

	it('skips the lines of a block whose language is set to skip, keeping line numbers', async () => {
		const v = vault({ 'a.md': note });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter, blockModes: { mermaid: 'skip' } });
		expect(r.ok && r.hits.map((h) => h.line)).toEqual([0, 4]);
	});

	it('skips the fence lines too, so a language name is not a hit', async () => {
		const v = vault({ 'a.md': 'x\n```mermaid\ny\n```' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'mermaid' }, filter: noFilter, blockModes: { mermaid: 'skip' } });
		expect(r.ok && r.hits).toEqual([]);
	});

	it('only affects the configured language', async () => {
		const other = ['```js', 'cat', '```'].join('\n');
		const v = vault({ 'a.md': other });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter, blockModes: { mermaid: 'skip' } });
		expect(r.ok && r.hits.map((h) => h.line)).toEqual([1]);
	});

	it('skips an unclosed block to the end of the note', async () => {
		const v = vault({ 'a.md': 'cat\n```compressed-json\ncat\ncat' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter, blockModes: { 'compressed-json': 'skip' } });
		expect(r.ok && r.hits.map((h) => h.line)).toEqual([0]);
	});

	it('matches a block language case-insensitively', async () => {
		const v = vault({ 'a.md': '```Mermaid\ncat\n```' });
		const r = await search({ files: v.files, read: v.read, yieldToUi: never, match: { query: 'cat' }, filter: noFilter, blockModes: { mermaid: 'skip' } });
		expect(r.ok && r.hits).toEqual([]);
	});
});

describe('search: files read through a provider', () => {
	const lines = (...ls: ExtractedLine[]): ExtractResult => ({ ok: true, value: ls });
	const sheet = (text: string, location: string, anchor?: unknown): ExtractedLine => ({ text, location, ...(anchor === undefined ? {} : { anchor }) });

	function setup(files: Record<string, ExtractResult>, extra: Partial<BinaryReader> = {}) {
		const read: string[] = [];
		const asked: string[] = [];
		const reader: BinaryReader = {
			handles: (path) => path.toLowerCase().endsWith('.xlsx'),
			version: () => 1,
			mtime: async () => 10,
			read: async (path) => { read.push(path); return new ArrayBuffer(1); },
			extract: async (path) => { asked.push(path); return files[path] ?? { ok: false, error: 'unknown' }; },
			...extra,
		};
		return { reader, read, asked, files: Object.keys(files).map((path) => ({ path })) as SearchFile[] };
	}

	const run = (s: ReturnType<typeof setup>, over: Record<string, unknown> = {}) =>
		search({ files: s.files, read: () => Promise.resolve(''), yieldToUi: never, match: { query: 'budget' }, filter: noFilter, binary: s.reader, ...over });

	it('searches the lines a provider returns and keeps their location and anchor', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('Annual budget', 'Sheet1!B4', { sheet: 'Sheet1', row: 4, col: 2 }), sheet('other', 'Sheet1!C1')) });
		const r = await run(s);
		expect(r.ok && r.hits).toEqual([{
			path: 'a.xlsx', line: 0, text: 'Annual budget', spans: [{ start: 7, end: 13 }],
			location: 'Sheet1!B4', anchor: { sheet: 'Sheet1', row: 4, col: 2 },
		}]);
	});

	it('numbers extracted lines by their order in the provider result', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('no', 'A1'), sheet('budget', 'A2')) });
		const r = await run(s);
		expect(r.ok && r.hits.map((h) => h.line)).toEqual([1]);
	});

	it('never reads a file of this kind that the path filter denies', async () => {
		const s = setup({ 'archive/a.xlsx': lines(sheet('budget', 'A1')), 'b.xlsx': lines(sheet('budget', 'A1')) });
		await run(s, { filter: { ...noFilter, denyFolders: ['archive'] } });
		expect(s.read).toEqual(['b.xlsx']);
		expect(s.asked).toEqual(['b.xlsx']);
	});

	it('never reads a file of this kind when its extension is denied', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) });
		await run(s, { filter: { ...noFilter, denyExtensions: ['xlsx'] } });
		expect(s.read).toEqual([]);
	});

	it('does not read a file that no reader handles', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) });
		const files = [...s.files, { path: 'b.drawio' }];
		await run(s, { files });
		expect(s.read).toEqual(['a.xlsx']);
	});

	it('does not count files nobody can read in the progress total', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) });
		const seen: SearchProgress[] = [];
		await run(s, { files: [{ path: 'n.md' }, { path: 'a.xlsx' }], binary: undefined, read: () => Promise.resolve('x'), onProgress: (p: SearchProgress) => seen.push(p) });
		expect(seen.at(-1)).toMatchObject({ scanned: 1, total: 1 });
	});

	it('reads nothing at all when there is no provider', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) });
		const r = await run(s, { binary: undefined });
		expect(s.read).toEqual([]);
		expect(r.ok && r.hits).toEqual([]);
	});

	it('records a provider failure for that file and carries on', async () => {
		const s = setup({ 'a.xlsx': { ok: false, error: 'encrypted' }, 'b.xlsx': lines(sheet('budget', 'A1')) });
		const r = await run(s);
		expect(r.ok && r.hits.map((h) => h.path)).toEqual(['b.xlsx']);
		expect(r.ok && r.failed).toEqual([{ path: 'a.xlsx', error: 'encrypted' }]);
	});

	it('records a file whose bytes cannot be read and carries on', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')), 'b.xlsx': lines(sheet('budget', 'A1')) }, {
			read: async (path) => { if (path === 'a.xlsx') throw new Error('locked'); return new ArrayBuffer(1); },
		});
		const r = await run(s);
		expect(r.ok && r.failed).toEqual([{ path: 'a.xlsx', error: 'locked' }]);
		expect(r.ok && r.hits.map((h) => h.path)).toEqual(['b.xlsx']);
	});

	it('lists notes and provider files together in file order', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) });
		const r = await run(s, { files: [{ path: 'n.md' }, { path: 'a.xlsx' }], read: () => Promise.resolve('my budget') });
		expect(r.ok && r.hits.map((h) => h.path)).toEqual(['n.md', 'a.xlsx']);
	});

	it('counts provider files in the progress total', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) });
		const seen: SearchProgress[] = [];
		await run(s, { files: [{ path: 'n.md' }, { path: 'a.xlsx' }], read: () => Promise.resolve('x'), onProgress: (p: SearchProgress) => seen.push(p) });
		expect(seen.at(-1)).toMatchObject({ scanned: 2, total: 2 });
	});

	it('stops asking the provider once cancelled', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')), 'b.xlsx': lines(sheet('budget', 'A1')), 'c.xlsx': lines(sheet('budget', 'A1')) });
		const controller = new AbortController();
		await run(s, { batchSize: 1, signal: controller.signal, yieldToUi: () => { controller.abort(); return Promise.resolve(); } });
		expect(s.asked).toEqual(['a.xlsx']);
	});

	it('reuses extracted text for an unchanged file instead of asking again', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) });
		const cache = new Map<string, ExtractResult>();
		await run(s, { cache });
		await run(s, { cache });
		expect(s.asked).toEqual(['a.xlsx']);
	});

	it('does not read the file again when the cached text is still valid', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) });
		const cache = new Map<string, ExtractResult>();
		await run(s, { cache });
		await run(s, { cache });
		expect(s.read).toEqual(['a.xlsx']);
	});

	it('reads the file again when it was modified', async () => {
		let mtime = 1;
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) }, { mtime: async () => mtime });
		const cache = new Map<string, ExtractResult>();
		await run(s, { cache });
		mtime = 2;
		await run(s, { cache });
		expect(s.read).toEqual(['a.xlsx', 'a.xlsx']);
	});

	it('records a file whose modification time cannot be read and carries on', async () => {
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')), 'b.xlsx': lines(sheet('budget', 'A1')) }, {
			mtime: async (path) => { if (path === 'a.xlsx') throw new Error('gone'); return 1; },
		});
		const r = await run(s);
		expect(r.ok && r.failed).toEqual([{ path: 'a.xlsx', error: 'gone' }]);
		expect(r.ok && r.hits.map((h) => h.path)).toEqual(['b.xlsx']);
	});

	it('asks again when the file was modified', async () => {
		let mtime = 1;
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) }, { mtime: async () => mtime });
		const cache = new Map<string, ExtractResult>();
		await run(s, { cache });
		mtime = 2;
		await run(s, { cache });
		expect(s.asked).toEqual(['a.xlsx', 'a.xlsx']);
	});

	it('asks again when the provider version changed', async () => {
		let version = 1;
		const s = setup({ 'a.xlsx': lines(sheet('budget', 'A1')) }, { version: () => version });
		const cache = new Map<string, ExtractResult>();
		await run(s, { cache });
		version = 2;
		await run(s, { cache });
		expect(s.asked).toEqual(['a.xlsx', 'a.xlsx']);
	});

	it('does not cache a failure, so a file fixed later is picked up', async () => {
		let ok = false;
		const s = setup({}, {
			extract: async () => (ok ? lines(sheet('budget', 'A1')) : { ok: false, error: 'bad' }),
		});
		const files = [{ path: 'a.xlsx' }];
		const cache = new Map<string, ExtractResult>();
		await run(s, { files, cache });
		ok = true;
		const r = await run(s, { files, cache });
		expect(r.ok && r.hits).toHaveLength(1);
	});
});

describe('search: excalidraw notes', () => {
	const drawing = [
		'---', 'excalidraw-plugin: parsed', '---',
		'==⚠  Switch to EXCALIDRAW VIEW ⚠==',
		'',
		'# Excalidraw Data',
		'## Text Elements',
		'Annual budget ^abc',
		'',
		'%%',
		'## Drawing',
		'```compressed-json',
		'budgetN4KAkARALgngDgUwgLgAQQQDwMYEMA2Al',
		'```',
		'%%',
	].join('\n');

	const run = (extra: Record<string, unknown> = {}, query = 'budget') =>
		search({
			files: [{ path: 'd.excalidraw.md' }, { path: 'n.md' }],
			read: (p) => Promise.resolve(p === 'n.md' ? 'my budget' : drawing),
			yieldToUi: never, match: { query }, filter: noFilter, ...extra,
		});

	it('searches only the text elements of a drawing, with their note line numbers', async () => {
		const r = await run({ excalidraw: true });
		const hits = r.ok ? r.hits.filter((h) => h.path === 'd.excalidraw.md') : [];
		expect(hits).toEqual([{ path: 'd.excalidraw.md', line: 7, text: 'Annual budget', spans: [{ start: 7, end: 13 }] }]);
	});

	it('does not match the hint line, the heading or the compressed data', async () => {
		const r = await run({ excalidraw: true }, 'EXCALIDRAW');
		expect(r.ok && r.hits.filter((h) => h.path === 'd.excalidraw.md')).toEqual([]);
		const r2 = await run({ excalidraw: true }, 'N4KAk');
		expect(r2.ok && r2.hits.filter((h) => h.path === 'd.excalidraw.md')).toEqual([]);
	});

	it('searches the whole note as plain text when the setting is off', async () => {
		const r = await run({ excalidraw: false });
		const lines = r.ok ? r.hits.filter((h) => h.path === 'd.excalidraw.md').map((h) => h.line) : [];
		expect(lines).toEqual([7, 12]);
	});

	it('searches the whole note as plain text when the setting is not given', async () => {
		const r = await run();
		expect(r.ok && r.hits.filter((h) => h.path === 'd.excalidraw.md').length).toBe(2);
	});

	it('leaves ordinary notes alone', async () => {
		const r = await run({ excalidraw: true });
		expect(r.ok && r.hits.filter((h) => h.path === 'n.md')).toHaveLength(1);
	});

	it('does not read a drawing that the path filter denies', async () => {
		const reads: string[] = [];
		await search({
			files: [{ path: 'd.excalidraw.md' }], read: (p) => { reads.push(p); return Promise.resolve(drawing); },
			yieldToUi: never, match: { query: 'budget' }, excalidraw: true,
			filter: { ...noFilter, denyExtensions: ['excalidraw'] },
		});
		expect(reads).toEqual([]);
	});

	it('with the setting on, excluding .md does not remove drawings', async () => {
		const r = await run({ excalidraw: true, filter: { ...noFilter, denyExtensions: ['md'] } });
		expect(r.ok && r.hits.map((h) => h.path)).toEqual(['d.excalidraw.md']);
	});

	it('with the setting on, excluding .excalidraw keeps notes and drops drawings', async () => {
		const reads: string[] = [];
		const r = await search({
			files: [{ path: 'd.excalidraw.md' }, { path: 'n.md' }], read: (p) => { reads.push(p); return Promise.resolve(p === 'n.md' ? 'my budget' : drawing); },
			yieldToUi: never, match: { query: 'budget' }, excalidraw: true,
			filter: { ...noFilter, denyExtensions: ['excalidraw'] },
		});
		expect(reads).toEqual(['n.md']);
		expect(r.ok && r.hits.map((h) => h.path)).toEqual(['n.md']);
	});

	it('with the setting off, excluding .md removes drawings too, since they are .md files', async () => {
		const r = await run({ excalidraw: false, filter: { ...noFilter, denyExtensions: ['md'] } });
		expect(r.ok && r.hits).toEqual([]);
	});
});

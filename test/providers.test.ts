import { describe, it, expect } from 'vitest';
import { PROVIDER_PLUGINS, findProviders, findBlockProviders, cacheKey, blockCacheKey, extractWith, extractBlockWith, revealBlockWith, pluginState, type PluginsLike } from '../src/providers';

const okProvider = (extra: Record<string, unknown> = {}) => ({
	apiVersion: 1,
	extensions: ['xlsx'],
	extractVersion: 3,
	extract: async () => ({ ok: true as const, value: [{ text: 'x', location: 'Sheet1!B4' }] }),
	...extra,
});

const plugins = (map: Record<string, unknown>): PluginsLike => ({ plugins: Object.fromEntries(Object.entries(map).map(([id, richSearch]) => [id, { richSearch }])) });

describe('findProviders', () => {
	it('knows which plugin serves which extensions', () => {
		expect(PROVIDER_PLUGINS).toEqual([
			{ id: 'rich-table', name: 'Rich Table', extensions: ['xlsx'] },
			{ id: 'rich-view', name: 'Rich View', extensions: ['drawio', 'pptx', 'vsdx'] },
		]);
	});

	it('finds a valid provider by plugin id and says which extensions it serves', () => {
		const r = findProviders(plugins({ 'rich-table': okProvider() }));
		const xlsx = r.find((e) => e.ext === 'xlsx');
		expect(xlsx).toMatchObject({ ext: 'xlsx', status: 'available', plugin: 'Rich Table' });
	});

	it('reports a plugin that is not installed as missing, naming it', () => {
		const r = findProviders(plugins({}));
		expect(r.find((e) => e.ext === 'xlsx')).toMatchObject({ status: 'missing', plugin: 'Rich Table' });
		expect(r.find((e) => e.ext === 'drawio')).toMatchObject({ status: 'missing', plugin: 'Rich View' });
	});

	it('reports an installed plugin that has no richSearch as missing', () => {
		const r = findProviders({ plugins: { 'rich-table': {} } });
		expect(r.find((e) => e.ext === 'xlsx')?.status).toBe('missing');
	});

	it('reports a different apiVersion as outdated', () => {
		const r = findProviders(plugins({ 'rich-table': okProvider({ apiVersion: 2 }) }));
		expect(r.find((e) => e.ext === 'xlsx')?.status).toBe('outdated');
	});

	it('treats a malformed provider as missing instead of throwing', () => {
		for (const bad of [null, 'x', 5, { apiVersion: 1 }, okProvider({ extract: 'nope' }), okProvider({ extensions: 'xlsx' }), okProvider({ extractVersion: 'a' })]) {
			expect(() => findProviders(plugins({ 'rich-table': bad }))).not.toThrow();
			expect(findProviders(plugins({ 'rich-table': bad })).find((e) => e.ext === 'xlsx')?.status).not.toBe('available');
		}
	});

	it('does not throw when the plugin registry is missing altogether', () => {
		expect(() => findProviders(undefined)).not.toThrow();
		expect(findProviders(undefined).every((e) => e.status === 'missing')).toBe(true);
		expect(() => findProviders({} as PluginsLike)).not.toThrow();
	});

	it('judges each extension on its own: a provider serving only some of them leaves the rest unavailable', () => {
		const r = findProviders(plugins({ 'rich-view': okProvider({ extensions: ['pptx'] }) }));
		expect(r.find((e) => e.ext === 'pptx')?.status).toBe('available');
		expect(r.find((e) => e.ext === 'drawio')?.status).not.toBe('available');
	});

	it('accepts extensions the provider lists in other case or with a dot', () => {
		const r = findProviders(plugins({ 'rich-table': okProvider({ extensions: ['.XLSX'] }) }));
		expect(r.find((e) => e.ext === 'xlsx')?.status).toBe('available');
	});

	it('marks the view as not registered only when the provider says so', () => {
		const no = findProviders(plugins({ 'rich-table': okProvider({ viewRegistered: () => false }) }));
		expect(no.find((e) => e.ext === 'xlsx')).toMatchObject({ status: 'available', viewRegistered: false });
		const yes = findProviders(plugins({ 'rich-table': okProvider({ viewRegistered: () => true }) }));
		expect(yes.find((e) => e.ext === 'xlsx')?.viewRegistered).toBe(true);
		const unknown = findProviders(plugins({ 'rich-table': okProvider() }));
		expect(unknown.find((e) => e.ext === 'xlsx')?.viewRegistered).toBe(true);
	});

	it('treats a viewRegistered that returns nothing as unknown, which means registered', () => {
		const r = findProviders(plugins({ 'rich-table': okProvider({ viewRegistered: () => undefined }) }));
		expect(r.find((e) => e.ext === 'xlsx')?.viewRegistered).toBe(true);
	});

	it('does not let a throwing viewRegistered break discovery', () => {
		const r = findProviders(plugins({ 'rich-table': okProvider({ viewRegistered: () => { throw new Error('boom'); } }) }));
		expect(r.find((e) => e.ext === 'xlsx')).toMatchObject({ status: 'available', viewRegistered: true });
	});
});

describe('cacheKey', () => {
	it('changes with the path, the modification time and the provider version', () => {
		const base = cacheKey('a.xlsx', 100, 1);
		expect(cacheKey('b.xlsx', 100, 1)).not.toBe(base);
		expect(cacheKey('a.xlsx', 101, 1)).not.toBe(base);
		expect(cacheKey('a.xlsx', 100, 2)).not.toBe(base);
		expect(cacheKey('a.xlsx', 100, 1)).toBe(base);
	});

	it('does not confuse two different paths that would join to the same text', () => {
		expect(cacheKey('a1', 2, 3)).not.toBe(cacheKey('a', 12, 3));
		expect(cacheKey('a|1', 2, 3)).not.toBe(cacheKey('a', 12, 3));
	});
});

describe('extractWith', () => {
	const found = findProviders(plugins({ 'rich-table': okProvider() })).find((e) => e.ext === 'xlsx');

	it('returns the provider lines', async () => {
		const r = await extractWith(found!, { path: 'a.xlsx', content: new ArrayBuffer(1) });
		expect(r).toEqual({ ok: true, value: [{ text: 'x', location: 'Sheet1!B4' }] });
	});

	it('turns a thrown error into a failure instead of rejecting', async () => {
		const bad = findProviders(plugins({ 'rich-table': okProvider({ extract: async () => { throw new Error('zip bomb'); } }) })).find((e) => e.ext === 'xlsx');
		await expect(extractWith(bad!, { path: 'a.xlsx', content: new ArrayBuffer(1) })).resolves.toEqual({ ok: false, error: 'zip bomb' });
	});

	it('turns a malformed result into a failure', async () => {
		const bad = findProviders(plugins({ 'rich-table': okProvider({ extract: async () => ({ weird: true }) }) })).find((e) => e.ext === 'xlsx');
		const r = await extractWith(bad!, { path: 'a.xlsx', content: new ArrayBuffer(1) });
		expect(r.ok).toBe(false);
	});

	it('passes a failure through unchanged', async () => {
		const bad = findProviders(plugins({ 'rich-table': okProvider({ extract: async () => ({ ok: false, error: 'encrypted' }) }) })).find((e) => e.ext === 'xlsx');
		expect(await extractWith(bad!, { path: 'a.xlsx', content: new ArrayBuffer(1) })).toEqual({ ok: false, error: 'encrypted' });
	});

	it('refuses to extract for an extension without a usable provider', async () => {
		const missing = findProviders(plugins({})).find((e) => e.ext === 'xlsx');
		const r = await extractWith(missing!, { path: 'a.xlsx', content: new ArrayBuffer(1) });
		expect(r.ok).toBe(false);
	});
});

describe('pluginState', () => {
	it('is enabled when the plugin is loaded', () => {
		expect(pluginState({ plugins: { 'x': {} }, manifests: { 'x': {} } }, 'x')).toBe('enabled');
	});

	it('is disabled when it is installed but not loaded', () => {
		expect(pluginState({ plugins: {}, manifests: { 'x': {} } }, 'x')).toBe('disabled');
	});

	it('is missing when it is neither loaded nor installed', () => {
		expect(pluginState({ plugins: {}, manifests: {} }, 'x')).toBe('missing');
	});

	it('counts a loaded plugin as enabled even if the manifest list is not available', () => {
		expect(pluginState({ plugins: { 'x': {} } }, 'x')).toBe('enabled');
	});

	it('cannot tell disabled from missing without the manifest list, and says missing', () => {
		expect(pluginState({ plugins: {} }, 'x')).toBe('missing');
	});

	it('does not throw when there is no registry at all', () => {
		expect(pluginState(undefined, 'x')).toBe('missing');
		expect(pluginState({} as PluginsLike, 'x')).toBe('missing');
	});

	it('does not mistake an inherited property name for a plugin', () => {
		expect(pluginState({ plugins: {}, manifests: {} }, 'toString')).toBe('missing');
		expect(pluginState({ plugins: {}, manifests: {} }, 'constructor')).toBe('missing');
	});
});

describe('findProviders: installed but switched off', () => {
	it('says a provider plugin that is installed but not enabled is disabled, not missing', () => {
		const r = findProviders({ plugins: {}, manifests: { 'rich-table': {} } });
		expect(r.find((e) => e.ext === 'xlsx')).toMatchObject({ status: 'disabled', plugin: 'Rich Table' });
		expect(r.find((e) => e.ext === 'drawio')).toMatchObject({ status: 'missing' });
	});
});

const blockProvider = (extra: Record<string, unknown> = {}) => okProvider({
	blockLanguages: ['rich-table'],
	extractBlock: async () => ({ ok: true as const, value: [{ text: 'cell', location: 'Table 1 · row 2', anchor: { r: 2 } }] }),
	...extra,
});

describe('findBlockProviders', () => {
	it('lists each language a provider renders inside notes, with the plugin that owns it', () => {
		const found = findBlockProviders(plugins({ 'rich-table': blockProvider() }));
		expect(found.map((b) => [b.language, b.plugin])).toEqual([['rich-table', 'Rich Table']]);
	});

	it('lower-cases languages, since fence info strings are compared in lower case', () => {
		const found = findBlockProviders(plugins({ 'rich-table': blockProvider({ blockLanguages: ['Rich-Table'] }) }));
		expect(found.map((b) => b.language)).toEqual(['rich-table']);
	});

	it('gives a language claimed twice to the first plugin in id order', () => {
		const found = findBlockProviders(plugins({
			'rich-view': blockProvider({ blockLanguages: ['rich-table'] }),
			'rich-table': blockProvider({ blockLanguages: ['rich-table'] }),
		}));
		expect(found.map((b) => b.plugin)).toEqual(['Rich Table']);
	});

	it('ignores a provider with no extractBlock, no languages, or another apiVersion', () => {
		expect(findBlockProviders(plugins({ 'rich-table': okProvider({ blockLanguages: ['rich-table'] }) }))).toEqual([]);
		expect(findBlockProviders(plugins({ 'rich-table': blockProvider({ blockLanguages: undefined }) }))).toEqual([]);
		expect(findBlockProviders(plugins({ 'rich-table': blockProvider({ apiVersion: 2 }) }))).toEqual([]);
	});

	it('does not throw when the registry is missing or a language is not a string', () => {
		expect(findBlockProviders(undefined)).toEqual([]);
		expect(findBlockProviders(plugins({ 'rich-table': blockProvider({ blockLanguages: [3, '', 'rich-table'] }) })).map((b) => b.language)).toEqual(['rich-table']);
	});
});

describe('blockCacheKey', () => {
	it('changes with the language, the provider version and the source, since a block has no modification time', () => {
		const base = blockCacheKey('n.md', 'rich-table', 1, 'a');
		expect(blockCacheKey('m.md', 'rich-table', 1, 'a')).not.toBe(base);
		expect(blockCacheKey('n.md', 'rich-view', 1, 'a')).not.toBe(base);
		expect(blockCacheKey('n.md', 'rich-table', 2, 'a')).not.toBe(base);
		expect(blockCacheKey('n.md', 'rich-table', 1, 'b')).not.toBe(base);
	});

	it('does not collide with a file key', () => {
		expect(blockCacheKey('a', 'b', 1, 'c')).not.toBe(cacheKey('a', 1, 0));
	});
});

describe('extractBlockWith / revealBlockWith', () => {
	const entry = (extra: Record<string, unknown> = {}) => findBlockProviders(plugins({ 'rich-table': blockProvider(extra) }))[0]!;
	const block = { path: 'a.md', language: 'rich-table', source: 'x' };

	it('hands the block to the provider and returns its lines', async () => {
		const r = await extractBlockWith(entry(), block);
		expect(r).toEqual({ ok: true, value: [{ text: 'cell', location: 'Table 1 · row 2', anchor: { r: 2 } }] });
	});

	it('turns a throw or a malformed result into a failure', async () => {
		expect((await extractBlockWith(entry({ extractBlock: async () => { throw new Error('bad yaml'); } }), block))).toEqual({ ok: false, error: 'bad yaml' });
		expect((await extractBlockWith(entry({ extractBlock: async () => 'nope' }), block)).ok).toBe(false);
	});

	it('reveals only when the provider says it did, and never throws', async () => {
		const leaf = {} as never;
		const target = { fromLine: 3, anchor: { r: 2 } };
		const query = { query: 'x' };
		expect(await revealBlockWith(entry({ revealBlock: () => true }), leaf, target, query)).toBe(true);
		expect(await revealBlockWith(entry({ revealBlock: async () => false }), leaf, target, query)).toBe(false);
		expect(await revealBlockWith(entry({ revealBlock: () => { throw new Error('x'); } }), leaf, target, query)).toBe(false);
		expect(await revealBlockWith(entry(), leaf, target, query)).toBe(false);
	});
});

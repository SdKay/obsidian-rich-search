import { describe, it, expect } from 'vitest';
import { PROVIDER_PLUGINS, findProviders, cacheKey, extractWith, pluginState, type PluginsLike } from '../src/providers';

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

import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings } from '../src/settings';

describe('loadSettings', () => {
	it('returns the defaults when nothing was saved', () => {
		expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
	});

	it('adds block modes to data saved before the key existed, so an upgrade keeps the defaults', () => {
		const saved = { filter: { allowFolders: ['notes'], denyFolders: [], allowExtensions: [], denyExtensions: [] } };
		const loaded = loadSettings(saved);
		expect(loaded.blockModes).toEqual(DEFAULT_SETTINGS.blockModes);
		expect(loaded.filter.allowFolders).toEqual(['notes']);
	});

	it('keeps a language the user added and the defaults it did not mention', () => {
		const loaded = loadSettings({ blockModes: { plantuml: 'skip' } });
		expect(loaded.blockModes).toEqual({ ...DEFAULT_SETTINGS.blockModes, plantuml: 'skip' });
	});

	it('fills missing filter lists from the defaults', () => {
		const loaded = loadSettings({ filter: { allowFolders: ['a'] } as never });
		expect(loaded.filter).toEqual({ ...DEFAULT_SETTINGS.filter, allowFolders: ['a'] });
	});

	it('skips Excalidraw drawing data by default', () => {
		expect(DEFAULT_SETTINGS.blockModes['compressed-json']).toBe('skip');
	});

	it('does not share mutable state with the defaults', () => {
		const loaded = loadSettings(null);
		loaded.filter.denyFolders.push('x');
		loaded.blockModes.foo = 'skip';
		expect(DEFAULT_SETTINGS.filter.denyFolders).toEqual([]);
		expect(DEFAULT_SETTINGS.blockModes.foo).toBeUndefined();
	});

	it('opens results in the main window by default, and keeps a saved choice of the panel', () => {
		expect(loadSettings(null).openIn).toBe('main');
		expect(loadSettings({ openIn: 'panel' }).openIn).toBe('panel');
	});

	it('falls back to the main window when the saved place is not one it knows', () => {
		expect(loadSettings({ openIn: 'window' as never }).openIn).toBe('main');
		expect(loadSettings({ openIn: 42 as never }).openIn).toBe('main');
	});

	it('excludes no folder from every search by default, and keeps a saved list', () => {
		expect(loadSettings(null).alwaysExcludeFolders).toEqual([]);
		expect(loadSettings({ alwaysExcludeFolders: ['archive', 'tmp'] }).alwaysExcludeFolders).toEqual(['archive', 'tmp']);
	});

	it('drops anything in the always-excluded list that is not a string, and ignores a value that is not a list', () => {
		expect(loadSettings({ alwaysExcludeFolders: ['a', 3, null, 'b'] as never }).alwaysExcludeFolders).toEqual(['a', 'b']);
		expect(loadSettings({ alwaysExcludeFolders: 'archive' as never }).alwaysExcludeFolders).toEqual([]);
	});

	it('does not share the always-excluded list with the defaults', () => {
		loadSettings(null).alwaysExcludeFolders.push('x');
		expect(DEFAULT_SETTINGS.alwaysExcludeFolders).toEqual([]);
	});

	it('starts with an empty history', () => {
		expect(loadSettings(null).history).toEqual([]);
	});

	it('keeps saved history entries that are well formed and drops the rest', () => {
		const good = { query: 'a', caseSensitive: false, wholeWord: true, regex: false, filter: { allowFolders: [], denyFolders: ['x'], allowExtensions: [], denyExtensions: [] } };
		const loaded = loadSettings({ history: [good, { query: 5 }, null] as never });
		// An entry saved before conditions existed is kept, and read as having none.
		expect(loaded.history).toEqual([{ ...good, filter: { ...good.filter, properties: [] } }]);
	});

	it('ignores a history that is not a list', () => {
		expect(loadSettings({ history: 'oops' as never }).history).toEqual([]);
	});

	it('treats drawings as their own type by default', () => {
		expect(DEFAULT_SETTINGS.excalidraw).toBe(true);
		expect(loadSettings(null).excalidraw).toBe(true);
	});

	it('keeps a saved choice, either way', () => {
		expect(loadSettings({ excalidraw: false }).excalidraw).toBe(false);
		expect(loadSettings({ excalidraw: true }).excalidraw).toBe(true);
	});

	it('adds the setting to data saved before it existed, as on', () => {
		expect(loadSettings({ blockModes: {} }).excalidraw).toBe(true);
	});

	it('ignores a saved value that is not a boolean', () => {
		expect(loadSettings({ excalidraw: 'no' as never }).excalidraw).toBe(true);
	});

	it('marks matches in a neon yellow-green by default', () => {
		expect(DEFAULT_SETTINGS.matchColor).toBe('#ccff00');
		expect(loadSettings(null).matchColor).toBe('#ccff00');
	});

	it('keeps a saved colour and normalises it', () => {
		expect(loadSettings({ matchColor: '#FF00AA' }).matchColor).toBe('#ff00aa');
		expect(loadSettings({ matchColor: '#f0a' }).matchColor).toBe('#ff00aa');
	});

	it('adds the colour to data saved before it existed', () => {
		expect(loadSettings({ excalidraw: false }).matchColor).toBe('#ccff00');
	});

	it('falls back to the default for a saved value that is not a colour', () => {
		for (const bad of ['red', '', 5, null, '#12']) expect(loadSettings({ matchColor: bad as never }).matchColor).toBe('#ccff00');
	});

	it('has no property condition by default', () => {
		expect(loadSettings(null).filter.properties).toEqual([]);
		expect(DEFAULT_SETTINGS.filter.properties).toEqual([]);
	});

	it('loads settings saved before conditions existed, with none, and keeps the rest of the scope', () => {
		const saved = { filter: { allowFolders: ['notes'], denyFolders: ['old'], allowExtensions: [], denyExtensions: [] } };
		const loaded = loadSettings(saved as never);
		expect(loaded.filter.properties).toEqual([]);
		expect(loaded.filter.allowFolders).toEqual(['notes']);
		expect(loaded.filter.denyFolders).toEqual(['old']);
	});

	it('keeps saved conditions', () => {
		const cond = [{ key: 'status', op: 'in', values: ['todo'] }];
		const loaded = loadSettings({ filter: { allowFolders: [], denyFolders: [], allowExtensions: [], denyExtensions: [], properties: cond } } as never);
		expect(loaded.filter.properties).toEqual(cond);
	});

	it('drops a malformed saved condition and keeps the others', () => {
		const raw = [{ key: 'ok', op: 'set' }, { key: '', op: 'set' }, 'junk', { key: 'x', op: 'nope' }];
		const loaded = loadSettings({ filter: { properties: raw } } as never);
		expect(loaded.filter.properties).toEqual([{ key: 'ok', op: 'set' }]);
	});

	it('does not share the conditions with the defaults or with the saved data', () => {
		const saved = { filter: { properties: [{ key: 'a', op: 'in', values: ['x'] }] } };
		const loaded = loadSettings(saved as never);
		loaded.filter.properties.push({ key: 'b', op: 'set' });
		loaded.filter.properties[0]?.values?.push('y');
		expect(DEFAULT_SETTINGS.filter.properties).toEqual([]);
		expect(saved.filter.properties).toEqual([{ key: 'a', op: 'in', values: ['x'] }]);
	});
});

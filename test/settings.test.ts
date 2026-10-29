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

	it('starts with an empty history', () => {
		expect(loadSettings(null).history).toEqual([]);
	});

	it('keeps saved history entries that are well formed and drops the rest', () => {
		const good = { query: 'a', caseSensitive: false, wholeWord: true, regex: false, filter: { allowFolders: [], denyFolders: ['x'], allowExtensions: [], denyExtensions: [] } };
		const loaded = loadSettings({ history: [good, { query: 5 }, null] as never });
		expect(loaded.history).toEqual([good]);
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
});

import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, loadSettings, type RichSearchSettings } from './settings';

// Keep this file to the plugin lifecycle: load settings, register commands, views and events.
// Search, filtering and highlighting live in their own modules (pure ones first).
export default class RichSearchPlugin extends Plugin {
	settings: RichSearchSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		this.settings = loadSettings((await this.loadData()) as Partial<RichSearchSettings> | null);

		// Command ids are stable API once released: never rename one.
		this.addCommand({
			id: 'open-search',
			name: 'Open search',
			callback: () => { /* TODO: open the search view */ },
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

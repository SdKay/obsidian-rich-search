import { Plugin } from 'obsidian';
import { readableTextColor } from './color';
import { loadSettings, type RichSearchSettings } from './settings';
import { t } from './i18n';
import { editorHighlight } from './editor-highlight';
import { RichSearchSettingTab } from './settings-tab';
import { RichSearchView, VIEW_TYPE_SEARCH } from './search-view';

// Keep this file to the plugin lifecycle: load settings, register commands, views and events.
// Search, filtering and highlighting live in their own modules (pure ones first).
export default class RichSearchPlugin extends Plugin {
	settings: RichSearchSettings = loadSettings(null);

	async onload(): Promise<void> {
		this.settings = loadSettings((await this.loadData()) as Partial<RichSearchSettings> | null);

		this.applyMatchColor();
		this.registerEditorExtension(editorHighlight);
		this.addSettingTab(new RichSearchSettingTab(this.app, this));
		this.registerView(VIEW_TYPE_SEARCH, (leaf) => new RichSearchView(leaf, this));
		this.addRibbonIcon('text-search', t('commandOpenSearch'), () => { void this.activateView(); });

		// Command ids are stable API once released: never rename one.
		this.addCommand({
			id: 'open-search',
			name: t('commandOpenSearch'),
			callback: () => { void this.activateView(); },
		});
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_SEARCH)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false) ?? undefined;
			await leaf?.setViewState({ type: VIEW_TYPE_SEARCH, active: true });
		}
		if (!leaf) return;
		await workspace.revealLeaf(leaf);
		if (leaf.view instanceof RichSearchView) leaf.view.focusInput();
	}

	/** Sets the match colours as CSS variables, which the results, the editor and the table highlight all read. */
	applyMatchColor(): void {
		const color = this.settings.matchColor;
		activeDocument.body.setCssProps({ '--rs-match-bg': color, '--rs-match-fg': readableTextColor(color) });
	}

	onunload(): void {
		for (const name of ['--rs-match-bg', '--rs-match-fg']) activeDocument.body.style.removeProperty(name);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

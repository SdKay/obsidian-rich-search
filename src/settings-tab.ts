import { PluginSettingTab, Setting, debounce, type App, type ColorComponent } from 'obsidian';
import { DEFAULT_SETTINGS } from './settings';
import type RichSearchPlugin from './main';
import { t } from './i18n';

export class RichSearchSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: RichSearchPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t('settingsExcalidrawName'))
			.setDesc(t('settingsExcalidrawDesc'))
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.excalidraw)
				.onChange(async (value) => {
					this.plugin.settings.excalidraw = value;
					await this.plugin.saveSettings();
				}));

		// The picker fires on every step of a drag: show the colour at once, write the file once it settles.
		let picker: ColorComponent | undefined;
		const save = debounce(() => { void this.plugin.saveSettings(); }, 400, true);
		new Setting(containerEl)
			.setName(t('settingsMatchColorName'))
			.setDesc(t('settingsMatchColorDesc'))
			.addColorPicker((component) => {
				picker = component;
				component
					.setValue(this.plugin.settings.matchColor)
					.onChange((value) => {
						this.plugin.settings.matchColor = value;
						this.plugin.applyMatchColor();
						save();
					});
			})
			.addExtraButton((button) => button
				.setIcon('rotate-ccw')
				.setTooltip(t('settingsMatchColorReset'))
				.onClick(() => {
					this.plugin.settings.matchColor = DEFAULT_SETTINGS.matchColor;
					this.plugin.applyMatchColor();
					void this.plugin.saveSettings();
					picker?.setValue(DEFAULT_SETTINGS.matchColor);
				}));
	}
}

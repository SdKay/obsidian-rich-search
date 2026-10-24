import { ItemView, setIcon, TFile, type WorkspaceLeaf } from 'obsidian';
import { openHit } from './open-hit';
import { extractWith, findProviders, pluginState, type ExtensionProvider, type PluginsLike } from './providers';
import type { ExtractResult } from './richSearchApi';
import { search, type BinaryReader, type SearchProgress } from './search';
import { appendHits, emptyGroups, showMore, DRAW_STEP, type AppendDiff, type FileGroup, type GroupState } from './groups';
import { hitIndexFrom } from './hitindex';
import { attachFolderInput } from './folder-input';
import { buildFileTypeSources, fileTypeRows, sameSources, setAllTypes, toggleType, type FileTypeSource } from './filetypes';
import { cloneState, type SearchState } from './history';
import { SearchBoxModel } from './searchbox';
import type RichSearchPlugin from './main';
import { fmt, t } from './i18n';
import type { FileFilter, MatchOptions, SearchHit } from './types';

export const VIEW_TYPE_SEARCH = 'rich-search-view';

const EXCALIDRAW_PLUGIN_ID = 'obsidian-excalidraw-plugin';

const HINT_TEXT = { install: 'scopeNeeds', enable: 'scopeNeedsEnable', update: 'scopeNeedsUpdate' } as const;

type FolderKey = 'allowFolders' | 'denyFolders';

const FOLDER_LISTS: { key: FolderKey; label: Parameters<typeof t>[0] }[] = [
	{ key: 'allowFolders', label: 'scopeIncludeFolders' },
	{ key: 'denyFolders', label: 'scopeExcludeFolders' },
];

/** Obsidian's plugin registry is not in the public typings, so it is read defensively. */
function pluginRegistry(app: unknown): PluginsLike | undefined {
	const registry = (app as { plugins?: unknown }).plugins;
	return typeof registry === 'object' && registry !== null ? registry : undefined;
}

export class RichSearchView extends ItemView {
	private query = '';
	private caseSensitive = false;
	private wholeWord = false;
	private regex = false;
	private scopeOpen = false;
	private collapsed = new Set<string>();
	private timer: number | undefined;
	private running: AbortController | null = null;
	private hits: SearchHit[] = [];
	// The options of the search whose hits are on screen, handed to the file a hit is opened in.
	private lastQuery: MatchOptions = { query: '' };
	private unreadable = 0;
	// What the results pane currently shows, so a progress update can append instead of rebuilding.
	private state: GroupState = emptyGroups();
	private groupEls = new Map<string, { root: HTMLElement; chevron: HTMLElement; count: HTMLElement; body: HTMLElement }>();
	private toggleEls: { el: HTMLElement; get: () => boolean }[] = [];
	private chevronEl!: HTMLElement;
	private knownSources: FileTypeSource[] = [];
	private closeSuggests: (() => void)[] = [];
	// Text pulled out of workbooks and diagrams, kept between searches (see search.ts for the key).
	private readonly extracted = new Map<string, ExtractResult>();
	private readonly box = new SearchBoxModel({
		getHistory: () => this.plugin.settings.history,
		setHistory: (history) => {
			this.plugin.settings.history = history;
			void this.plugin.saveSettings();
		},
	});
	// Folder rows as shown, including empty ones the user just added with "+"; only non-empty ones are saved.
	private rows: Record<FolderKey, string[]> = { allowFolders: [], denyFolders: [] };

	private inputEl!: HTMLInputElement;
	private clearEl!: HTMLElement;
	private errorEl!: HTMLElement;
	private scopeSummaryEl!: HTMLElement;
	private scopeBodyEl!: HTMLElement;
	private summaryEl!: HTMLElement;
	private toggleAllEl!: HTMLElement;
	private resultsEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: RichSearchPlugin) {
		super(leaf);
	}

	getViewType(): string { return VIEW_TYPE_SEARCH; }
	getDisplayText(): string { return t('viewTitle'); }
	getIcon(): string { return 'text-search'; }

	onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass('rs-view');

		const f = this.plugin.settings.filter;
		this.rows = { allowFolders: [...f.allowFolders], denyFolders: [...f.denyFolders] };

		// Everything above the results is frozen; only the results pane scrolls.
		const top = root.createDiv({ cls: 'rs-top' });

		// The three toggles sit inside the box, like VS Code's find widget.
		const box = top.createDiv({ cls: 'rs-box' });
		this.inputEl = box.createEl('input', { cls: 'rs-input', attr: { type: 'text', placeholder: t('searchPlaceholder'), spellcheck: 'false' } });
		const inside = box.createDiv({ cls: 'rs-box-actions' });
		this.clearEl = inside.createSpan({ cls: 'rs-clear', attr: { 'aria-label': t('clearQuery') } });
		setIcon(this.clearEl, 'x');
		this.addToggle(inside, 'Aa', 'rs-toggle-case', 'optionCaseSensitive', () => this.caseSensitive, (v) => { this.caseSensitive = v; });
		this.addToggle(inside, 'ab', 'rs-toggle-word', 'optionWholeWord', () => this.wholeWord, (v) => { this.wholeWord = v; });
		this.addToggle(inside, '.*', 'rs-toggle-regex', 'optionRegex', () => this.regex, (v) => { this.regex = v; });
		this.registerDomEvent(this.inputEl, 'input', () => {
			this.query = this.inputEl.value;
			this.box.type(this.currentState());
			this.schedule();
		});
		this.registerDomEvent(this.inputEl, 'keydown', (e: KeyboardEvent) => {
			if (e.isComposing) return;
			if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
			else if (e.key === 'ArrowUp') { e.preventDefault(); this.stepHistory(this.box.up(this.currentState())); }
			else if (e.key === 'ArrowDown') { e.preventDefault(); this.stepHistory(this.box.down()); }
		});
		this.registerDomEvent(this.clearEl, 'click', () => {
			this.inputEl.value = '';
			this.query = '';
			this.box.type(this.currentState());
			this.inputEl.focus();
			this.schedule();
		});

		const scope = top.createDiv({ cls: 'rs-scope' });
		const head = scope.createDiv({ cls: 'rs-scope-head' });
		const chevron = head.createSpan({ cls: 'rs-chevron' });
		head.createSpan({ cls: 'rs-scope-label', text: t('scopeLabel') });
		this.scopeSummaryEl = head.createSpan({ cls: 'rs-scope-summary' });
		this.scopeBodyEl = scope.createDiv({ cls: 'rs-scope-body' });
		this.chevronEl = chevron;
		this.registerDomEvent(head, 'click', () => {
			this.scopeOpen = !this.scopeOpen;
			this.renderScope(chevron);
		});

		this.errorEl = top.createDiv({ cls: 'rs-error' });

		const bar = top.createDiv({ cls: 'rs-summary-bar' });
		this.summaryEl = bar.createSpan({ cls: 'rs-summary' });
		this.toggleAllEl = bar.createDiv({ cls: 'rs-toggle-all clickable-icon' });
		this.resultsEl = root.createDiv({ cls: 'rs-results' });
		this.registerDomEvent(this.resultsEl, 'click', (event) => this.onResultsClick(event));

		this.renderScope(chevron);
		this.runSearch();
		this.registerDomEvent(this.containerEl.win, 'focus', () => this.refreshTypes());
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		for (const close of this.closeSuggests) close();
		window.clearTimeout(this.timer);
		this.running?.abort();
		return Promise.resolve();
	}

	focusInput(): void {
		this.inputEl.focus();
		this.inputEl.select();
	}

	// The glyphs are what the toggles mean in every search box (VS Code), not translatable text.
	private addToggle(parent: HTMLElement, glyph: string, cls: string, label: Parameters<typeof t>[0], get: () => boolean, set: (v: boolean) => void): void {
		const el = parent.createSpan({ cls: ['rs-toggle', cls], attr: { role: 'button', tabindex: '0', 'aria-label': t(label) } });
		el.createSpan({ cls: 'rs-glyph', text: glyph });
		this.toggleEls.push({ el, get });
		this.registerDomEvent(el, 'click', () => {
			set(!get());
			el.toggleClass('is-active', get());
			this.box.optionChanged();
			this.schedule();
		});
	}

	/**
	 * The user may have switched a plugin on or off in Settings while this view stayed open. When the window
	 * is focused again, redraw the scope panel if the file types it offers have changed; leave it alone
	 * otherwise so a folder box being edited keeps its focus.
	 */
	private refreshTypes(): void {
		if (sameSources(this.typeSources(), this.knownSources)) return;
		this.renderScope(this.chevronEl);
	}

	private typeSources(): FileTypeSource[] {
		return buildFileTypeSources(this.providers(), {
			excalidraw: this.plugin.settings.excalidraw,
			excalidrawPlugin: pluginState(pluginRegistry(this.app), EXCALIDRAW_PLUGIN_ID),
		});
	}

	private providers(): ExtensionProvider[] {
		return findProviders(pluginRegistry(this.app));
	}

	/** Reads non-note files through the plugin that renders them; paths it cannot handle are never read. */
	private binaryReader(): BinaryReader {
		const found = new Map(this.providers().filter((p) => p.status === 'available').map((p) => [p.ext, p]));
		const forPath = (path: string): ExtensionProvider | undefined => found.get(path.slice(path.lastIndexOf('.') + 1).toLowerCase());
		const file = (path: string): TFile => {
			const f = this.app.vault.getAbstractFileByPath(path);
			if (!(f instanceof TFile)) throw new Error(path);
			return f;
		};
		return {
			handles: (path) => forPath(path) !== undefined,
			version: (path) => forPath(path)?.provider?.extractVersion ?? 0,
			mtime: (path) => Promise.resolve(file(path).stat.mtime),
			read: (path) => this.app.vault.readBinary(file(path)),
			extract: (path, content) => {
				const entry = forPath(path);
				return entry ? extractWith(entry, { path, content }) : Promise.resolve({ ok: false, error: path });
			},
		};
	}

	private currentState(): SearchState {
		return cloneState({
			query: this.query,
			caseSensitive: this.caseSensitive,
			wholeWord: this.wholeWord,
			regex: this.regex,
			filter: this.plugin.settings.filter,
		});
	}

	/** Enter: search now, without waiting for the debounce, and remember this search. */
	private submit(): void {
		window.clearTimeout(this.timer);
		this.box.submit(this.currentState());
		this.runSearch();
	}

	/** Puts a remembered search back: the text, the three options and the scope. Does nothing for undefined. */
	private stepHistory(state: SearchState | undefined): void {
		if (!state) return;
		this.query = state.query;
		this.caseSensitive = state.caseSensitive;
		this.wholeWord = state.wholeWord;
		this.regex = state.regex;
		this.inputEl.value = state.query;
		for (const { el, get } of this.toggleEls) el.toggleClass('is-active', get());
		this.plugin.settings.filter = state.filter;
		this.rows = { allowFolders: [...state.filter.allowFolders], denyFolders: [...state.filter.denyFolders] };
		void this.plugin.saveSettings();
		this.renderScope(this.chevronEl);
		window.clearTimeout(this.timer);
		this.runSearch();
		const end = this.inputEl.value.length;
		this.inputEl.setSelectionRange(end, end);
	}

	private schedule(): void {
		window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => this.runSearch(), 300);
	}

	private runSearch(): void {
		this.running?.abort();
		this.clearEl.toggleClass('is-hidden', this.query === '');
		this.renderScopeSummary();
		this.errorEl.empty();
		this.hits = [];
		this.unreadable = 0;
		this.resetResults();

		if (this.query === '') {
			this.running = null;
			this.showMessage(t('emptyHint'));
			this.summaryEl.setText('');
			return;
		}

		const controller = new AbortController();
		this.running = controller;
		this.lastQuery = { query: this.query, caseSensitive: this.caseSensitive, wholeWord: this.wholeWord, regex: this.regex };
		const settings = this.plugin.settings;
		const files = this.app.vault.getFiles();

		void search({
			files,
			read: (path) => this.readNote(path),
			yieldToUi: () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())),
			match: { query: this.query, caseSensitive: this.caseSensitive, wholeWord: this.wholeWord, regex: this.regex },
			filter: settings.filter,
			blockModes: settings.blockModes,
			excalidraw: settings.excalidraw,
			binary: this.binaryReader(),
			cache: this.extracted,
			signal: controller.signal,
			onProgress: (p) => { if (this.running === controller) this.update(p.hits, p); },
		}).then((result) => {
			if (this.running !== controller) return;
			this.running = null;
			if (!result.ok) {
				this.update([], null);
				this.errorEl.setText(fmt('invalidPattern', { reason: result.error }));
				return;
			}
			if (result.cancelled) return;
			this.hits = result.hits;
			this.unreadable = result.failed.length;
			this.update(result.hits, null);
		});
	}

	private async readNote(path: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error(path);
		return this.app.vault.cachedRead(file);
	}

	private resetResults(): void {
		this.resultsEl.empty();
		this.toggleAllEl.empty();
		this.state = emptyGroups();
		this.groupEls.clear();
	}

	private showMessage(text: string): void {
		this.resultsEl.empty();
		this.resultsEl.createDiv({ cls: 'rs-empty', text });
	}

	/**
	 * Brings the pane up to date with `hits`. While a search runs, hits only accumulate, so only the new
	 * rows are appended; collapse state, scroll position and the other groups are left alone.
	 */
	private update(hits: SearchHit[], progress: SearchProgress | null): void {
		const status = progress ? fmt('searching', { done: progress.scanned, total: progress.total }) : '';

		if (hits.length === 0) {
			this.resetResults();
			this.summaryEl.setText(status);
			if (!progress) this.showMessage(t('noResults'));
			return;
		}

		// Hits only ever accumulate while a search runs, so only the ones not drawn yet need work.
		if (hits.length < this.state.count) this.resetResults();
		else if (this.resultsEl.querySelector('.rs-empty')) this.resultsEl.empty();
		const diff = appendHits(this.state, hits.slice(this.state.count));
		this.draw(diff);

		const summary = fmt('resultsSummary', { hits: this.state.count, files: this.state.fileCount });
		const shown = this.state.drawn < this.state.count ? fmt('showingOf', { shown: this.state.drawn }) : '';
		const bad = this.unreadable > 0 ? fmt('unreadableFiles', { count: this.unreadable }) : '';
		this.summaryEl.setText([summary, shown, status, bad].filter((x) => x !== '').join(' · '));
		this.renderMoreButton();
		this.renderToggleAll();
	}

	/** Puts the groups and rows of a diff on the page. */
	private draw(diff: AppendDiff): void {
		for (const group of diff.added) this.addGroup(group, diff.numberOf);
		for (const grown of diff.grown) {
			const els = this.groupEls.get(grown.path);
			if (!els) continue;
			els.count.setText(String(grown.total));
			for (const hit of grown.newHits) this.addHit(els.body, hit, diff.numberOf.get(hit) ?? 0);
		}
	}

	/** The button under the list that draws the next step of the hits that were found but not drawn. */
	private renderMoreButton(): void {
		this.resultsEl.querySelector('.rs-more')?.remove();
		const left = this.state.count - this.state.drawn;
		if (left <= 0) return;
		this.resultsEl.createDiv({ cls: 'rs-more', attr: { 'data-more': '1' }, text: fmt('showMore', { count: Math.min(left, DRAW_STEP) }) });
	}

	private showMoreHits(): void {
		this.draw(showMore(this.state));
		const summary = fmt('resultsSummary', { hits: this.state.count, files: this.state.fileCount });
		const shown = this.state.drawn < this.state.count ? fmt('showingOf', { shown: this.state.drawn }) : '';
		const bad = this.unreadable > 0 ? fmt('unreadableFiles', { count: this.unreadable }) : '';
		this.summaryEl.setText([summary, shown, bad].filter((x) => x !== '').join(' · '));
		this.renderMoreButton();
		this.renderToggleAll();
	}

	private setCollapsed(path: string, collapsed: boolean): void {
		if (collapsed) this.collapsed.add(path);
		else this.collapsed.delete(path);
		const els = this.groupEls.get(path);
		if (!els) return;
		els.root.toggleClass('is-collapsed', collapsed);
		setIcon(els.chevron, collapsed ? 'chevron-right' : 'chevron-down');
	}

	/** The collapse-all button reflects what is open now; it never touches the results themselves. */
	private renderToggleAll(): void {
		const anyOpen = this.state.groups.some((g) => !this.collapsed.has(g.path));
		this.toggleAllEl.empty();
		setIcon(this.toggleAllEl, anyOpen ? 'chevrons-down-up' : 'chevrons-up-down');
		this.toggleAllEl.setAttr('aria-label', t(anyOpen ? 'collapseAll' : 'expandAll'));
		this.toggleAllEl.onclick = () => {
			for (const g of this.state.groups) this.setCollapsed(g.path, anyOpen);
			this.renderToggleAll();
		};
	}

	private addGroup(group: FileGroup, numberOf: Map<SearchHit, number>): void {
		const collapsed = this.collapsed.has(group.path);
		const root = this.resultsEl.createDiv({ cls: 'rs-file' });
		root.toggleClass('is-collapsed', collapsed);

		const head = root.createDiv({ cls: 'rs-file-head', attr: { 'aria-label': group.path, 'data-file': group.path } });
		const chevron = head.createSpan({ cls: 'rs-chevron' });
		setIcon(chevron, collapsed ? 'chevron-right' : 'chevron-down');
		head.createSpan({ cls: 'rs-file-name', text: group.name });
		if (group.dir) head.createSpan({ cls: 'rs-file-dir', text: group.dir });
		const count = head.createSpan({ cls: 'rs-count', text: String(group.hits.length) });
		const body = root.createDiv({ cls: 'rs-file-body' });
		this.groupEls.set(group.path, { root, chevron, count, body });

		for (const hit of group.hits) this.addHit(body, hit, numberOf.get(hit) ?? 0);
	}

	/** A row carries its number in `data-hit`; one listener on the list finds the hit again (see onResultsClick). */
	private addHit(body: HTMLElement, hit: SearchHit, number: number): void {
		const row = body.createDiv({ cls: 'rs-hit', attr: { 'data-hit': String(number) } });
		row.createSpan({ cls: 'rs-hit-pos', text: hit.location ?? String(hit.line + 1) });
		this.renderSnippet(row.createSpan({ cls: 'rs-hit-text' }), hit);
	}

	/** One listener for the whole list: thousands of rows would otherwise each keep a listener until the view closes. */
	private onResultsClick(event: MouseEvent): void {
		const target = event.target instanceof Element ? event.target : null;

		if (target?.closest('[data-more]')) { this.showMoreHits(); return; }

		const number = hitIndexFrom(target);
		const hit = number === undefined ? undefined : this.state.all[number];
		if (hit) {
			const ext = hit.path.slice(hit.path.lastIndexOf('.') + 1).toLowerCase();
			void openHit(this.app, hit, this.lastQuery, event, this.providers().find((p) => p.ext === ext));
			return;
		}

		const path = target?.closest('[data-file]')?.getAttribute('data-file');
		if (path) {
			this.setCollapsed(path, !this.collapsed.has(path));
			this.renderToggleAll();
		}
	}

	private renderSnippet(el: HTMLElement, hit: SearchHit): void {
		const first = hit.spans[0]?.start ?? 0;
		const from = Math.max(0, first - 24);
		let cursor = from;
		if (from > 0) el.appendText('…');
		for (const span of hit.spans) {
			if (span.end <= from) continue;
			el.appendText(hit.text.slice(cursor, span.start));
			el.createEl('mark', { cls: 'rs-mark', text: hit.text.slice(span.start, span.end) });
			cursor = span.end;
		}
		el.appendText(hit.text.slice(cursor));
	}

	private renderScopeSummary(): void {
		const f = this.plugin.settings.filter;
		const rows = fileTypeRows(f, this.typeSources());
		const on = rows.filter((r) => r.checked).length;
		this.scopeSummaryEl.setText(fmt('scopeSummary', {
			inc: f.allowFolders.length,
			exc: f.denyFolders.length,
			on,
			total: rows.filter((r) => r.available).length,
		}));
	}

	private persistFolders(key: FolderKey): void {
		this.plugin.settings.filter[key] = this.rows[key].map((v) => v.trim()).filter((v) => v !== '');
		void this.plugin.saveSettings();
		this.renderScopeSummary();
		this.schedule();
	}

	private renderScope(chevron: HTMLElement): void {
		// What the panel is drawn from, kept so a later refresh can tell whether anything changed.
		this.knownSources = this.typeSources();
		setIcon(chevron, this.scopeOpen ? 'chevron-down' : 'chevron-right');
		this.scopeBodyEl.toggleClass('is-hidden', !this.scopeOpen);
		for (const close of this.closeSuggests) close();
		this.closeSuggests = [];
		this.scopeBodyEl.empty();
		this.renderScopeSummary();
		if (!this.scopeOpen) return;

		for (const { key, label } of FOLDER_LISTS) {
			const section = this.scopeBodyEl.createDiv({ cls: 'rs-scope-section' });
			const title = section.createDiv({ cls: 'rs-scope-title' });
			title.createSpan({ text: t(label) });
			const plus = title.createDiv({ cls: 'rs-plus clickable-icon', attr: { 'aria-label': t('addFolder') } });
			setIcon(plus, 'plus');
			this.registerDomEvent(plus, 'click', () => {
				this.rows[key].push('');
				this.renderScope(chevron);
				const inputs = this.scopeBodyEl.querySelectorAll<HTMLInputElement>(`.rs-folder-input[data-key="${key}"]`);
				inputs[inputs.length - 1]?.focus();
			});

			this.rows[key].forEach((value, i) => {
				const row = section.createDiv({ cls: 'rs-folder-row' });
				const input = row.createEl('input', {
					cls: 'rs-folder-input',
					attr: { type: 'text', placeholder: t('folderPlaceholder'), spellcheck: 'false', 'data-key': key },
				});
				input.value = value;
				this.closeSuggests.push(attachFolderInput(this.app, input));
				this.registerDomEvent(input, 'input', () => {
					this.rows[key][i] = input.value;
					this.persistFolders(key);
				});
				const del = row.createDiv({ cls: 'rs-folder-del clickable-icon', attr: { 'aria-label': t('removeItem') } });
				setIcon(del, 'x');
				this.registerDomEvent(del, 'click', () => {
					this.rows[key].splice(i, 1);
					this.persistFolders(key);
					this.renderScope(chevron);
				});
			});
		}

		this.scopeBodyEl.createEl('hr', { cls: 'rs-divider' });

		const types = this.scopeBodyEl.createDiv({ cls: 'rs-scope-section' });
		const title = types.createDiv({ cls: 'rs-scope-title' });
		title.createSpan({ text: t('scopeFileTypes') });
		const sources = this.knownSources;
		const rows = fileTypeRows(this.plugin.settings.filter, sources);
		const usable = sources.filter((x) => x.available);
		const allOn = rows.filter((r) => r.available).every((r) => r.checked);
		const selectAll = title.createEl('button', { cls: 'rs-select-all', text: t(allOn ? 'scopeDeselectAll' : 'scopeSelectAll') });
		this.registerDomEvent(selectAll, 'click', () => {
			this.applyFilter(setAllTypes(this.plugin.settings.filter, usable, !allOn));
			this.renderScope(chevron);
			this.box.optionChanged();
			this.schedule();
		});

		const grid = types.createDiv({ cls: 'rs-types' });
		for (const row of rows) {
			const label = grid.createEl('label', { cls: 'rs-type' });
			label.toggleClass('is-unavailable', !row.available);
			const box = label.createEl('input', { attr: { type: 'checkbox' } });
			box.checked = row.checked;
			box.disabled = !row.available;
			label.createSpan({ text: `.${row.ext}` });
			if (!row.available && row.needs) label.createSpan({ cls: 'rs-type-needs', text: fmt(HINT_TEXT[row.hint ?? 'install'], { plugin: row.needs }) });
			this.registerDomEvent(box, 'change', () => {
				this.applyFilter(toggleType(this.plugin.settings.filter, row.ext, box.checked));
				this.renderScope(chevron);
				this.box.optionChanged();
				this.schedule();
			});
		}
	}

	private applyFilter(filter: FileFilter): void {
		this.plugin.settings.filter = filter;
		void this.plugin.saveSettings();
	}
}

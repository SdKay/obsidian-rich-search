import { VIEW_TYPE_SEARCH } from './view-type';
import { ItemView, setIcon, TFile, type WorkspaceLeaf } from 'obsidian';
import { openHit } from './open-hit';
import { extractPdf, pdfExtractVersion } from './pdf-reader';
import { extractBlockWith, extractWith, findBlockProviders, findProviders, pluginState, type ExtensionProvider, type PluginsLike } from './providers';
import type { ExtractResult } from './richSearchApi';
import { search, type BinaryReader, type BlockReader, type SearchProgress } from './search';
import { appendHits, emptyGroups, showMore, DRAW_STEP, type AppendDiff, type FileGroup, type GroupState } from './groups';
import { hitIndexFrom } from './hitindex';
import { nextSelection, type Row } from './selection';
import { attachFolderInput } from './folder-input';
import { scopeToFolder, withAlwaysExcluded } from './folders';
import { buildFileTypeSources, fileTypeRows, sameSources, setAllTypes, toggleType, type FileTypeSource } from './filetypes';
import { cloneState, describeState, type SearchState } from './history';
import { openHistoryPopup } from './history-popup';
import { SearchBoxModel } from './searchbox';
import type RichSearchPlugin from './main';
import { fmt, t } from './i18n';
import type { FileFilter, MatchOptions, SearchHit } from './types';


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
	// The options of the search whose hits are on screen, handed to the file a hit is opened in.
	private lastQuery: MatchOptions = { query: '' };
	/** The hit that is open, shown with a background. Set by a click, the arrow keys or Enter. */
	private selected: number | undefined;
	private unreadable = 0;
	// What the results pane currently shows, so a progress update can append instead of rebuilding.
	private state: GroupState = emptyGroups();
	private groupEls = new Map<string, { root: HTMLElement; chevron: HTMLElement; count: HTMLElement; body: HTMLElement }>();
	private toggleEls: { el: HTMLElement; get: () => boolean }[] = [];
	private chevronEl!: HTMLElement;
	private knownSources: FileTypeSource[] = [];
	private closeSuggests: (() => void)[] = [];
	private closeHistory: (() => void) | undefined;
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
		const historyEl = inside.createSpan({ cls: 'rs-clear rs-history', attr: { 'aria-label': t('historyButton') } });
		setIcon(historyEl, 'history');
		this.registerDomEvent(historyEl, 'click', () => this.showHistory(historyEl));
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
		this.resultsEl = root.createDiv({ cls: 'rs-results', attr: { tabindex: '0' } });
		this.registerDomEvent(this.resultsEl, 'click', (event) => this.onResultsClick(event));
		this.registerDomEvent(this.resultsEl, 'keydown', (event) => this.onResultsKey(event));

		this.renderScope(chevron);
		this.runSearch();
		this.registerDomEvent(this.containerEl.win, 'focus', () => this.refreshTypes());
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.closeHistory?.();
		this.plugin.query.clear();
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

	/** Reads non-note files: PDFs through Obsidian's own PDF.js, the rest through the plugin that renders them. Paths nobody handles are never read. */
	private binaryReader(): BinaryReader {
		const found = new Map(this.providers().filter((p) => p.status === 'available').map((p) => [p.ext, p]));
		const extOf = (path: string): string => path.slice(path.lastIndexOf('.') + 1).toLowerCase();
		const forPath = (path: string): ExtensionProvider | undefined => found.get(extOf(path));
		const isPdf = (path: string): boolean => extOf(path) === 'pdf';
		const file = (path: string): TFile => {
			const f = this.app.vault.getAbstractFileByPath(path);
			if (!(f instanceof TFile)) throw new Error(path);
			return f;
		};
		return {
			handles: (path) => isPdf(path) || forPath(path) !== undefined,
			version: (path) => (isPdf(path) ? pdfExtractVersion() : forPath(path)?.provider?.extractVersion ?? 0),
			mtime: (path) => Promise.resolve(file(path).stat.mtime),
			read: (path) => this.app.vault.readBinary(file(path)),
			extract: (path, content, signal) => {
				if (isPdf(path)) return extractPdf(content, signal);
				const entry = forPath(path);
				return entry ? extractWith(entry, { path, content }) : Promise.resolve({ ok: false, error: path });
			},
		};
	}

	/** Asks the plugins that draw fenced blocks (a table, a diagram) what a block shows; looked up per search, like the file providers. */
	private blockReader(): BlockReader {
		const found = new Map(findBlockProviders(pluginRegistry(this.app)).map((b) => [b.language, b]));
		return {
			handles: (language) => found.has(language),
			version: (language) => found.get(language)?.provider.extractVersion ?? 0,
			extract: (path, language, source) => {
				const entry = found.get(language);
				return entry ? extractBlockWith(entry, { path, language, source }) : Promise.resolve({ ok: false, error: language });
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
	/** The remembered searches, newest first: choose one, forget one with its cross, or forget them all. */
	private showHistory(anchor: HTMLElement): void {
		this.closeHistory?.();
		const settings = this.plugin.settings;
		this.closeHistory = openHistoryPopup(anchor, {
			entries: () => settings.history
				.map((state, position) => ({ position, label: describeState(state, (folders) => fmt('historyIn', { folders })) }))
				.reverse(),
			apply: (position) => { const state = settings.history[position]; if (state) this.stepHistory(cloneState(state)); },
			forget: (position) => this.box.forget(position),
			forgetAll: () => this.box.forgetAll(),
			labels: { empty: t('historyEmpty'), clear: t('historyClear'), remove: t('historyRemove') },
		});
	}

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

	/** Limits the search to one folder, shows the scope so the change is visible, and searches the query that is already typed. */
	searchInFolder(folder: string): void {
		const filter = scopeToFolder(this.plugin.settings.filter, folder);
		this.plugin.settings.filter = filter;
		this.rows = { allowFolders: [...filter.allowFolders], denyFolders: [...filter.denyFolders] };
		this.scopeOpen = true;
		void this.plugin.saveSettings();
		this.renderScope(this.chevronEl);
		window.clearTimeout(this.timer);
		this.runSearch();
		this.focusInput();
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
		this.unreadable = 0;
		this.resetResults();

		if (this.query === '') {
			this.plugin.query.clear();
			this.running = null;
			this.showMessage(t('emptyHint'));
			this.summaryEl.setText('');
			return;
		}

		const controller = new AbortController();
		this.running = controller;
		this.lastQuery = { query: this.query, caseSensitive: this.caseSensitive, wholeWord: this.wholeWord, regex: this.regex };
		this.plugin.query.set(this.lastQuery);
		const settings = this.plugin.settings;
		const files = this.app.vault.getFiles();

		void search({
			files,
			read: (path) => this.readNote(path),
			yieldToUi: () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())),
			match: { query: this.query, caseSensitive: this.caseSensitive, wholeWord: this.wholeWord, regex: this.regex },
			filter: withAlwaysExcluded(settings.filter, settings.alwaysExcludeFolders),
			blockModes: settings.blockModes,
			excalidraw: settings.excalidraw,
			binary: this.binaryReader(),
			blocks: this.blockReader(),
			cache: this.extracted,
			signal: controller.signal,
			onProgress: (p) => { if (this.running === controller) this.update(p.newHits, p); },
		}).then((result) => {
			if (this.running !== controller) return;
			this.running = null;
			if (!result.ok) {
				this.resetResults();
				this.summaryEl.setText('');
				this.showMessage(t('noResults'));
				this.errorEl.setText(fmt('invalidPattern', { reason: result.error }));
				return;
			}
			if (result.cancelled) return;
			this.unreadable = result.failed.length;
			this.update([], null);
		});
	}

	private async readNote(path: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error(path);
		return this.app.vault.cachedRead(file);
	}

	private resetResults(): void {
		this.selected = undefined;
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
	 * Adds the hits found since the last call (`found`, each handed out once) to the pane and refreshes the
	 * summary. Collapse state, scroll position and the groups already drawn are left alone. `progress` is null
	 * once the search has ended.
	 */
	private update(found: SearchHit[], progress: SearchProgress | null): void {
		const status = progress ? fmt('searching', { done: progress.scanned, total: progress.total }) : '';

		if (found.length > 0) {
			if (this.resultsEl.querySelector('.rs-empty')) this.resultsEl.empty();
			this.draw(appendHits(this.state, found));
		}

		if (this.state.count === 0) {
			this.summaryEl.setText(status);
			if (!progress) this.showMessage(t('noResults'));
			return;
		}

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

	/** Selects a hit and opens it. Only Enter takes the focus into the note; a click or an arrow key leaves it in the list, so the arrows keep working. */
	private openResult(number: number, event: MouseEvent | null, takeFocus: boolean): void {
		const hit = this.state.all[number];
		if (!hit) return;
		this.select(number);
		this.plugin.setOpenedHit({
			path: hit.path, line: hit.line, index: 0, text: hit.text, ...(hit.spans[0] ? { column: hit.spans[0].start } : {}),
			// A match in a file or a block that a plugin draws is brightened by that plugin, which is told which of its marks it is.
			...(hit.block ? { block: { fromLine: hit.block.fromLine, anchor: hit.anchor } } : hit.anchor === undefined ? {} : { anchor: hit.anchor }),
		});
		const ext = hit.path.slice(hit.path.lastIndexOf('.') + 1).toLowerCase();
		void openHit(this.app, hit, this.lastQuery, event, this.providers().find((p) => p.ext === ext), takeFocus, findBlockProviders(pluginRegistry(this.app)).find((b) => b.language === hit.block?.language), this.leaf, this.plugin.settings.openIn);
	}

	/** Moves the background from the old row to the new one, and keeps the new one in view. */
	private select(number: number | undefined): void {
		const rowOf = (n: number | undefined): Element | null => (n === undefined ? null : this.resultsEl.querySelector(`[data-hit="${n}"]`));
		rowOf(this.selected)?.removeClass('is-selected');
		this.selected = number;
		const row = rowOf(number);
		row?.addClass('is-selected');
		row?.scrollIntoView({ block: 'nearest' });
	}

	/** The hits on screen, top to bottom, with the file each is listed under. Read from the page: it is what the user sees. */
	private visibleRows(): Row[] {
		const rows: Row[] = [];
		for (const el of Array.from(this.resultsEl.querySelectorAll('.rs-hit'))) {
			const hit = hitIndexFrom(el);
			const file = el.closest('.rs-file')?.querySelector('[data-file]')?.getAttribute('data-file');
			if (hit !== undefined && file) rows.push({ hit, file });
		}
		return rows;
	}

	private onResultsKey(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const next = nextSelection(this.visibleRows(), this.collapsed, this.selected, event.key === 'ArrowDown' ? 'down' : 'up');
			if (next !== undefined && next !== this.selected) this.openResult(next, null, false);
		} else if (event.key === 'Enter' && this.selected !== undefined) {
			event.preventDefault();
			this.openResult(this.selected, null, true);
		}
	}

	/** One listener for the whole list: thousands of rows would otherwise each keep a listener until the view closes. */
	private onResultsClick(event: MouseEvent): void {
		const target = event.target instanceof Element ? event.target : null;

		if (target?.closest('[data-more]')) { this.showMoreHits(); return; }

		const number = hitIndexFrom(target);
		if (number !== undefined && this.state.all[number]) {
			this.resultsEl.focus({ preventScroll: true });
			this.openResult(number, event, false);
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

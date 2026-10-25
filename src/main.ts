import { Plugin, TFolder } from 'obsidian';
import { clearMatchColor, setMatchColor } from './matchcolor';
import { loadSettings, type RichSearchSettings } from './settings';
import { t } from './i18n';
import { coalesce } from './coalesce';
import { codeMirrorOf, openNotes, openPdfs, widgetLine } from './editors';
import { Watches } from './observed';
import { editorHighlight, markHit, markQuery, setViewChangeListener } from './editor-highlight';
import { paintPage, type PageSource } from './table-highlight';
import { createHostApi } from './hostapi';
import { QueryState, type OpenedHit } from './querystate';
import type { RichSearchHostApi } from './richSearchApi';
import { RichSearchSettingTab } from './settings-tab';
import { RichSearchView, VIEW_TYPE_SEARCH } from './search-view';

// Keep this file to the plugin lifecycle: load settings, register commands, views and events.
// Search, filtering and highlighting live in their own modules (pure ones first).
export default class RichSearchPlugin extends Plugin {
	settings: RichSearchSettings = loadSettings(null);
	/** The search on screen, shared with the views of other plugins through `api`. */
	readonly query = new QueryState();
	/** Read by the Rich Table and Rich View plugins (`app.plugins.plugins['rich-search'].api`). */
	readonly api: RichSearchHostApi = createHostApi(this.query);
	/** The text of the line that was opened, for the painter of rendered pages, which has no line numbers (see activeRangeIn). */
	private openedText = '';
	private openedColumn: number | undefined;

	async onload(): Promise<void> {
		this.settings = loadSettings((await this.loadData()) as Partial<RichSearchSettings> | null);

		// The panel comes first: a failure in the highlighting below must never leave the panel unregistered (a blank leaf).
		this.addSettingTab(new RichSearchSettingTab(this.app, this));
		this.registerView(VIEW_TYPE_SEARCH, (leaf) => new RichSearchView(leaf, this));
		this.addRibbonIcon('text-search', t('commandOpenSearch'), () => { void this.activateView(); });

		// Command ids are stable API once released: never rename one.
		this.addCommand({
			id: 'open-search',
			name: t('commandOpenSearch'),
			callback: () => { void this.activateView(); },
		});

		this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {
			if (!(file instanceof TFolder) || source !== 'file-explorer-context-menu') return;
			menu.addItem((item) => item
				.setTitle(t('menuSearchInFolder'))
				.setIcon('text-search')
				.onClick(() => { void this.searchInFolder(file.path); }));
		}));

		try {
			this.startHighlighting();
		} catch (error) {
			console.error('Rich Search: highlighting could not start', error);
		}
	}

	/** The opened match as a rendered page can find it: the file, the line's text and which match on it. */
	openedLine(): { path: string; text: string; index: number; page?: number; line?: number; column?: number } | null {
		const hit = this.query.currentHit();
		if (!hit) return null;
		const page = (hit.anchor as { page?: unknown } | undefined)?.page;
		return { path: hit.path, text: this.openedText, index: hit.index, line: hit.line, column: this.openedColumn, ...(typeof page === 'number' ? { page } : {}) };
	}

	/** Records which match the user opened. Null clears it. */
	setOpenedHit(hit: (OpenedHit & { text: string; column?: number }) | null): void {
		this.openedText = hit?.text ?? '';
		this.openedColumn = hit?.column;
		this.query.setHit(hit ? { path: hit.path, line: hit.line, index: hit.index, ...(hit.anchor === undefined ? {} : { anchor: hit.anchor }), ...(hit.block ? { block: hit.block } : {}) } : null);
	}

	private startHighlighting(): void {
		this.applyMatchColor();
		// A popout window is a document of its own: it gets the colour as it opens.
		this.registerEvent(this.app.workspace.on('window-open', (_win, popout) => { setMatchColor([popout.document], this.settings.matchColor); }));
		this.registerEvent(this.app.workspace.on('layout-change', () => { this.applyMatchColor(); }));
		this.registerEditorExtension(editorHighlight);

		// Every open note marks the search that is on screen, and follows it as it changes.
		const markOpenNotes = (): void => {
			const current = this.query.current();
			const hit = this.query.currentHit();
			for (const note of openNotes(this.app)) {
				const cm = codeMirrorOf(note);
				if (!cm) continue;
				markQuery(cm, current);
				markHit(cm, hit && !hit.block && hit.anchor === undefined && hit.path === note.file?.path ? hit : null);
			}
		};
		// Tables are drawn by Obsidian outside the editor, so they are painted separately, after the editor settles.
		const paintOpenTables = (): void => {
			const sources: PageSource[] = openNotes(this.app).map((note) => (
				note.getMode() === 'preview'
					? { kind: 'reading', path: note.file?.path ?? '', root: note.previewMode.containerEl, note: note.editor.getValue() }
					: { kind: 'editor', path: note.file?.path ?? '', note: note.editor.getValue(), root: note.containerEl, lineOf: widgetLine(note) }
			));
			// The pages a PDF viewer has drawn; each has its text layer. A page that is not drawn has none, so it is skipped.
			for (const pdf of openPdfs(this.app)) {
				sources.push({ kind: 'pdf', path: pdf.path, layers: Array.from(pdf.containerEl.querySelectorAll('.page .textLayer')) });
			}
			paintPage(sources, this.query.current(), this.openedLine());
			// The paint wraps the opened match in an element, which the observers below would report as a change of the
			// page and paint again, for ever. What they have collected so far is our own edit, so it is dropped.
			for (const observer of observers) observer.takeRecords();
		};
		const observers = new Set<MutationObserver>();
		const repaint = coalesce(paintOpenTables, (run) => { window.requestAnimationFrame(run); });
		setViewChangeListener(repaint);

		// Reading view renders its sections as they come into view and has no editor to tell us, so watch for them.
		const sections = new Watches<Element>((sizer) => {
			const observer = new MutationObserver(repaint);
			// Sections are filled in as they come into view, which may add nodes anywhere below the sizer.
			observer.observe(sizer, { childList: true, subtree: true });
			observers.add(observer);
			return () => { observers.delete(observer); observer.disconnect(); };
		});
		// A PDF viewer draws a page's text a moment after the page appears and again as the user scrolls, so it is watched the same way.
		const pdfPages = new Watches<Element>((container) => {
			const observer = new MutationObserver(repaint);
			observer.observe(container, { childList: true, subtree: true });
			observers.add(observer);
			return () => { observers.delete(observer); observer.disconnect(); };
		});
		this.register(() => { sections.stopAll(); pdfPages.stopAll(); setViewChangeListener(() => {}); paintPage([], null); });

		const refresh = (): void => {
			markOpenNotes();
			const sizers: Element[] = [];
			for (const note of openNotes(this.app)) {
				const sizer = note.getMode() === 'preview' ? note.previewMode.containerEl.querySelector('.markdown-preview-sizer') : null;
				if (sizer) sizers.push(sizer);
			}
			sizers.forEach((sizer) => sections.ensure(sizer));
			sections.keepOnly(sizers);
			const viewers = openPdfs(this.app).map((pdf) => pdf.containerEl);
			viewers.forEach((viewer) => pdfPages.ensure(viewer));
			pdfPages.keepOnly(viewers);
			repaint();
		};
		this.register(this.query.onChange(refresh));
		this.register(this.query.onHitChange(refresh));
		// A note opened later, or switched between reading and editing, starts with the search already on screen.
		this.registerEvent(this.app.workspace.on('active-leaf-change', refresh));
		this.registerEvent(this.app.workspace.on('file-open', refresh));
		this.registerEvent(this.app.workspace.on('layout-change', refresh));
		this.app.workspace.onLayoutReady(refresh);
	}

	/** Opens the search panel limited to one folder. */
	async searchInFolder(folder: string): Promise<void> {
		await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_SEARCH)[0];
		if (leaf?.view instanceof RichSearchView) leaf.view.searchInFolder(folder);
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
		setMatchColor(this.windowDocuments(), this.settings.matchColor);
	}

	/** The main window's document and that of every popout window that has a pane open. Marks in a popout read the colour from there. */
	private windowDocuments(): Document[] {
		const docs = [this.app.workspace.containerEl.ownerDocument];
		this.app.workspace.iterateAllLeaves((leaf) => { docs.push(leaf.view.containerEl.ownerDocument); });
		return docs;
	}


	onunload(): void {
		this.query.clear();
		clearMatchColor(this.windowDocuments());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

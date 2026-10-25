import { Keymap, MarkdownView, Notice, TFile, type App, type UserEvent } from 'obsidian';
import { centerLine, widgetLine } from './editors';
import { matchStateFor } from './lineoffset';
import { scrollSettled, shouldHideWhileScrolling } from './scrollsettled';
import { fmt, t } from './i18n';
import { planOpen } from './openhit';
import { scrollToTableHit } from './table-highlight';
import { revealBlockWith, type BlockProvider, type ExtensionProvider } from './providers';
import type { MatchOptions, SearchHit } from './types';

/**
 * Opens the file of a hit where the user asked for it (same tab, new tab with Ctrl/Cmd) and goes to the
 * line. Marking the matches is not done here: the editor and the table follow the search that is on
 * screen on their own (main.ts). Other formats are handed to the plugin that owns their view, which is
 * told what to show (docs/superpowers/specs/2026-10-21-provider-contract.md, section 5).
 */
export async function openHit(
	app: App,
	hit: SearchHit,
	query: MatchOptions,
	event: UserEvent | null,
	provider: ExtensionProvider | undefined,
	/** False when the user is moving through the results with the keyboard: the note opens without taking the focus away. */
	takeFocus = true,
	/** The plugin that draws the block the hit sits in, when it does. */
	blockProvider?: BlockProvider,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(hit.path);
	if (!(file instanceof TFile)) {
		new Notice(fmt('fileGone', { path: hit.path }));
		return;
	}

	const plan = planOpen(hit, query, provider);
	const leaf = app.workspace.getLeaf(event ? Keymap.isModEvent(event) : false);
	await leaf.openFile(file, { eState: plan.eState, active: takeFocus });

	if (plan.note === 'cannotJump') new Notice(t('openedCannotJump'));
	if (plan.kind === 'block' && hit.block && blockProvider && leaf.view instanceof MarkdownView) {
		// The plugin switches to the sheet or slide and scrolls to the cell. If it cannot, the user is left at the block.
		await revealBlockWith(blockProvider, leaf, { fromLine: hit.block.fromLine, anchor: hit.anchor }, query);
		return;
	}
	if (plan.kind !== 'note' || !(leaf.view instanceof MarkdownView)) return;

	const view = leaf.view;
	const line = Math.min(hit.line, view.editor.lineCount() - 1);

	if (view.getMode() === 'preview') {
		// Reading view shows the start of the note until it has laid its sections out and scrolled; hide it for that stretch.
		const release = shouldHideWhileScrolling(line) ? holdPage(view) : () => {};
		try {
			// Obsidian's own search hands a note a match, and reading view then scrolls to it, once, into the middle.
			const match = matchStateFor(view.editor.getValue(), line, hit.spans[0]);
			if (match) view.setEphemeralState({ match });
			else centerLine(view, line);
		} catch (error) {
			release();
			throw error;
		}
		return;
	}

	// The editor may not have laid out its document the moment openFile resolves, so wait for the next frame.
	window.requestAnimationFrame(() => {
		view.editor.setCursor({ line, ch: hit.spans[0]?.start ?? 0 });
		centerLine(view, line);
		// A table is drawn by Obsidian's widget; bring the clicked cell into view once it has been built.
		scrollToTableHit(view.containerEl, view.editor.getValue(), hit.line, query, widgetLine(view));
	});
}


const HOLD_LIMIT_MS = 1000;

/** Hides the reading view's page until it has scrolled (or the limit passes), and returns a function that shows it at once. */
function holdPage(view: MarkdownView): () => void {
	const scroller = view.containerEl.querySelector<HTMLElement>('.markdown-preview-view');
	if (!scroller) return () => {};
	scroller.setCssProps({ visibility: 'hidden' });
	const started = performance.now();
	let done = false;
	const show = (): void => {
		if (done) return;
		done = true;
		scroller.setCssProps({ visibility: '' });
	};
	const check = (): void => {
		if (done) return;
		if (scrollSettled({ scrollTop: scroller.scrollTop, waited: performance.now() - started, limit: HOLD_LIMIT_MS })) show();
		else window.requestAnimationFrame(check);
	};
	window.requestAnimationFrame(check);
	return show;
}

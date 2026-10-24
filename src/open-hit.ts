import { Keymap, MarkdownView, Notice, TFile, type App, type UserEvent } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { applyMatches } from './editor-highlight';
import { fmt, t } from './i18n';
import { clearTableHighlight, highlightInRenderedTable } from './table-highlight';
import { tableNumber } from './tablerow';
import { highlightRanges, planOpen } from './openhit';
import type { ExtensionProvider } from './providers';
import type { MatchOptions, SearchHit } from './types';

/** Obsidian's editor exposes its CodeMirror view as `cm`, but not in the public typings. */
function codeMirrorOf(view: MarkdownView): EditorView | undefined {
	const cm = (view.editor as unknown as { cm?: unknown }).cm;
	return typeof cm === 'object' && cm !== null && 'dispatch' in cm ? cm as EditorView : undefined;
}

/**
 * Opens the file of a hit where the user asked for it (same tab, new tab with Ctrl/Cmd, side split with Alt),
 * then goes to the match. Markdown notes are positioned and marked here; other formats are handed to the
 * plugin that owns their view, which is told what to show (docs/superpowers/specs/2026-10-21-provider-contract.md, section 5).
 */
export async function openHit(app: App, hit: SearchHit, query: MatchOptions, event: UserEvent, provider: ExtensionProvider | undefined): Promise<void> {
	const file = app.vault.getAbstractFileByPath(hit.path);
	if (!(file instanceof TFile)) {
		new Notice(fmt('fileGone', { path: hit.path }));
		return;
	}

	const plan = planOpen(hit, query, provider);
	const where = Keymap.isModEvent(event);
	const leaf = app.workspace.getLeaf(where);
	await leaf.openFile(file, { eState: plan.eState });

	if (plan.note === 'cannotJump') new Notice(t('openedCannotJump'));
	if (plan.kind !== 'note' || !(leaf.view instanceof MarkdownView)) return;

	const view = leaf.view;
	// The editor may not have laid out its document the moment openFile resolves, so wait for the next frame.
	window.requestAnimationFrame(() => {
		const line = Math.min(hit.line, view.editor.lineCount() - 1);
		view.editor.setCursor({ line, ch: hit.spans[0]?.start ?? 0 });
		view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);

		const cm = codeMirrorOf(view);
		if (!cm) return;
		const start = view.editor.posToOffset({ line, ch: 0 });
		applyMatches(cm, highlightRanges(start, hit.spans, cm.state.doc.length));

		markRenderedTable(view, hit, query);
	});
}

/**
 * A table in Live Preview is drawn by Obsidian's own widget, outside the editor's decorations, so its
 * matches are marked in the widget's DOM instead. The mark goes away on the next click or key press.
 */
function markRenderedTable(view: MarkdownView, hit: SearchHit, query: MatchOptions): void {
	clearTableHighlight();
	const note = view.editor.getValue();
	const index = tableNumber(note, hit.line);
	if (index === undefined) return;
	if (!highlightInRenderedTable(view.containerEl, note, hit.line, index, query)) return;

	const doc = view.containerEl.ownerDocument;
	const clear = (): void => {
		clearTableHighlight();
		doc.removeEventListener('pointerdown', clear, true);
		doc.removeEventListener('keydown', clear, true);
	};
	// Listen on the next turn, so the click that opened the note does not clear its own mark.
	window.setTimeout(() => {
		doc.addEventListener('pointerdown', clear, true);
		doc.addEventListener('keydown', clear, true);
	}, 0);
}

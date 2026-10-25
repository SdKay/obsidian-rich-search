import { MarkdownView, type App } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { offsetOfLine } from './lineoffset';

/** Obsidian's editor exposes its CodeMirror view as `cm`, but not in the public typings. */
export function codeMirrorOf(view: MarkdownView): EditorView | undefined {
	const cm = (view.editor as unknown as { cm?: unknown }).cm;
	return typeof cm === 'object' && cm !== null && 'dispatch' in cm ? cm as EditorView : undefined;
}

/** Every Markdown note that is open in any pane, including the sidebars and pop-out windows. */
export function openNotes(app: App): MarkdownView[] {
	const views: MarkdownView[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		if (leaf.view instanceof MarkdownView) views.push(leaf.view);
	});
	return views;
}

/** Every PDF that is open in any pane, with the file it shows and its container. */
export function openPdfs(app: App): { path: string; containerEl: HTMLElement }[] {
	const out: { path: string; containerEl: HTMLElement }[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		const view = leaf.view;
		if (view.getViewType() !== 'pdf') return;
		const path = (view as unknown as { file?: { path?: string } }).file?.path;
		if (path) out.push({ path, containerEl: view.containerEl });
	});
	return out;
}

type Renderer = { applyScrollDelayed?: (line: number, options: { center: boolean; highlight: boolean }) => unknown };

/**
 * Puts a line of a note in the middle of the window. Obsidian's own `scrollIntoView(range, true)` does not centre
 * (it sets a margin and scrolls the least it can), and its `eState.line` puts the reading view's line at the top,
 * so both are done here. Reading view's renderer is internal: it is used when it has the method, and otherwise
 * Obsidian's own scroll stands. `applyScrollDelayed` runs at once if the page is laid out and otherwise after it
 * is, in the order the calls were made, so it lands after Obsidian's own scroll to the top without any waiting.
 * `highlight` is what makes it open a section that is not drawn yet.
 */
export function centerLine(view: MarkdownView, line: number): void {
	if (view.getMode() === 'preview') {
		const renderer = (view.previewMode as unknown as { renderer?: Renderer }).renderer;
		if (typeof renderer?.applyScrollDelayed === 'function') renderer.applyScrollDelayed(line, { center: true, highlight: true });
		return;
	}
	const cm = codeMirrorOf(view);
	if (!cm) return;
	cm.dispatch({ effects: EditorView.scrollIntoView(offsetOfLine(cm.state.doc, line), { y: 'center' }) });
}

/**
 * A function that says which line of the note a drawn widget (a table) starts on, or undefined when the editor cannot tell.
 * CodeMirror knows where each block widget sits in the document, which the widget's own element does not say.
 */
export function widgetLine(view: MarkdownView): ((widget: Element) => number | undefined) | undefined {
	const cm = codeMirrorOf(view);
	if (!cm) return undefined;
	return (widget) => {
		try {
			return cm.state.doc.lineAt(cm.posAtDOM(widget)).number - 1;
		} catch {
			// posAtDOM throws for an element the editor does not own, as when the widget is being torn down.
			return undefined;
		}
	};
}

import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { coalesce } from './coalesce';
import { linesInRanges, matchesInLines } from './linematches';
import { sameQuery } from './querystate';
import { activeIndexIn } from './activematch';
import type { MatchOptions } from './types';

/** Tells an editor which search to mark; null clears the marks. */
export const setQuery = StateEffect.define<MatchOptions | null>();

/** Tells an editor which match to draw brighter: a 0-based line and which match on it; null for none. */
export const setHit = StateEffect.define<{ line: number; index: number } | null>();

const hitField = StateField.define<{ line: number; index: number } | null>({
	create: () => null,
	update(value, tr) {
		for (const effect of tr.effects) if (effect.is(setHit)) return effect.value;
		return value;
	},
});

const queryField = StateField.define<MatchOptions | null>({
	create: () => null,
	update(value, tr) {
		for (const effect of tr.effects) if (effect.is(setQuery)) return effect.value;
		return value;
	},
});

const mark = Decoration.mark({ class: 'rs-editor-match' });
const activeMark = Decoration.mark({ class: 'rs-editor-match rs-editor-match-active' });

/**
 * The marks for the lines that `ranges` touch. Only those lines are matched, so a long note costs no more
 * than a screenful. It reads the editor's state, not its view, so what would be drawn can be tested.
 */
export function marksIn(state: EditorState, ranges: readonly { from: number; to: number }[]): DecorationSet {
	const query = state.field(queryField);
	if (!query) return Decoration.none;
	const found = matchesInLines(linesInRanges(state.doc, ranges), query);
	const hit = state.field(hitField);
	// Only the opened line's start is needed, and the lines above it are counted by the document, not walked.
	const active = hit && hit.line >= 0 && hit.line < state.doc.lines
		? activeIndexIn(found, lineStartsAround(state, hit.line), { line: 1, index: hit.index })
		: -1;
	return Decoration.set(found.map((r, i) => (i === active ? activeMark : mark).range(r.from, r.to)));
}

/** Starts of the line before the opened one, the opened one and the next, so a match can be placed without reading the whole note. */
function lineStartsAround(state: EditorState, line: number): number[] {
	const at = (n: number): number => (n >= 1 && n <= state.doc.lines ? state.doc.line(n).from : state.doc.length + 1);
	return [at(line), at(line + 1), at(line + 2)];
}

/** Whether a change to the editor can change what is marked: the text, the view, the search, or which match is opened. */
export function needsRedraw(before: EditorState, after: EditorState, viewportChanged: boolean): boolean {
	return before.doc !== after.doc || viewportChanged
		|| !sameQuery(before.field(queryField), after.field(queryField))
		|| before.field(hitField) !== after.field(hitField);
}

const marksFor = (view: EditorView): DecorationSet => marksIn(view.state, view.visibleRanges);

/**
 * Marks every match of the search that is on screen, the way VS Code does. The marks stay while the
 * search panel is open and its query is not empty: clicking, typing in the note and pressing Escape do
 * not clear them.
 */
const marker = ViewPlugin.fromClass(class {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = marksFor(view);
	}

	update(update: ViewUpdate): void {
		if (needsRedraw(update.startState, update.state, update.viewportChanged)) this.decorations = marksFor(update.view);
	}
}, { decorations: (plugin) => plugin.decorations });

/**
 * Called when what is in view changes (scrolling, editing, a new search). A table drawn by Obsidian is
 * outside the editor's decorations, so whoever paints it needs to know when to look again.
 */
let onViewChange: () => void = () => {};
export function setViewChangeListener(listener: () => void): void {
	onViewChange = listener;
}

// One repaint per frame however many updates arrive, and after the frame so Obsidian has built the tables that came into view.
const requestRepaint = coalesce(() => onViewChange(), (run) => { window.requestAnimationFrame(run); });

const notifier = ViewPlugin.fromClass(class {
	update(update: ViewUpdate): void {
		if (needsRedraw(update.startState, update.state, update.viewportChanged)) requestRepaint();
	}
});

export const editorHighlight: Extension = [queryField, hitField, marker, notifier];

/**
 * Gives one editor the search to mark. Does nothing for an editor that does not carry this extension,
 * or that is already marking this search: switching tabs would otherwise redo the marks of every open note.
 */
export function markQuery(view: EditorView, query: MatchOptions | null): void {
	const current = view.state.field(queryField, false);
	if (current === undefined || sameQuery(current, query)) return;
	view.dispatch({ effects: setQuery.of(query) });
}

/** Gives one editor the match to draw brighter. Does nothing for an editor without this extension, or one already showing it. */
export function markHit(view: EditorView, hit: { line: number; index: number } | null): void {
	const current = view.state.field(hitField, false);
	if (current === undefined) return;
	if (current === hit || (current && hit && current.line === hit.line && current.index === hit.index)) return;
	view.dispatch({ effects: setHit.of(hit) });
}

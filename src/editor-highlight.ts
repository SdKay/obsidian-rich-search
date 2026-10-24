import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import type { Range } from './openhit';

/** Replaces the marked ranges; an empty list clears them. */
export const setMatches = StateEffect.define<Range[]>();

const mark = Decoration.mark({ class: 'rs-editor-match' });

/**
 * Marks the matches of the search that opened this note. The marks go away on the first edit or the
 * first time the user moves the cursor: they say "this is what you searched for", not "this is selected".
 */
export const matchField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setMatches)) {
				return Decoration.set(effect.value.map((r) => mark.range(r.from, r.to)));
			}
		}
		if (tr.docChanged || tr.selection) return Decoration.none;
		return value;
	},
	provide: (field) => EditorView.decorations.from(field),
});

export const editorHighlight: Extension = [matchField];

/**
 * Marks ranges in an editor. Opening a note moves the cursor, which would clear the marks again, so the
 * caller applies this after the cursor has been placed.
 */
export function applyMatches(view: EditorView, ranges: Range[]): void {
	const length = view.state.doc.length;
	const safe = ranges.filter((r) => r.from >= 0 && r.to <= length && r.to > r.from);
	view.dispatch({ effects: setMatches.of(safe) });
}

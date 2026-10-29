/** Where a result opens, as the user chose it in the settings. */
export type OpenIn = 'main' | 'panel';

export type Place =
	/** Obsidian picks: a note in the window the panel is in, or a new tab if Ctrl/Cmd was held. */
	| 'default'
	/** The most recent note of the main window. */
	| 'mainRecent'
	/** A note already open in the pop-out window the panel is in. */
	| 'reusePopout'
	/** No note there yet: make one beside the panel. */
	| 'splitPopout';

export interface PlaceInput {
	openIn: OpenIn;
	/** The search panel is in a pop-out window. A pop-out window has no sidebar, so the panel shares its main area with the notes. */
	panelInPopout: boolean;
	popoutHasNote: boolean;
	/** The user asked for a new tab (Ctrl/Cmd click). */
	newTab: boolean;
}

export function planPlace(input: PlaceInput): Place {
	if (input.newTab || !input.panelInPopout) return 'default';
	if (input.openIn === 'main') return 'mainRecent';
	return input.popoutHasNote ? 'reusePopout' : 'splitPopout';
}

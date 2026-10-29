import { normalizeColor } from './color';
import { sanitizeHistory, type SearchState } from './history';
import type { OpenIn } from './openplace';
import type { BlockMode } from './search';
import type { FileFilter } from './types';

/** Everything the user can configure. Persisted through `loadData` / `saveData`. */
export interface RichSearchSettings {
	filter: FileFilter;
	/** Fenced-block languages whose lines are not searched. Unlisted languages are searched as plain text. */
	blockModes: Record<string, BlockMode>;
	/** Treat `*.excalidraw.md` as the type `.excalidraw`: searched by the words in the drawing, chosen separately from `.md`. */
	excalidraw: boolean;
	/** Background of the words that matched the search, `#rrggbb`. The text colour follows from it. */
	matchColor: string;
	/** Folders left out of every search, whatever the panel's own lists say. Kept apart from `filter`, which the panel rewrites. */
	alwaysExcludeFolders: string[];
	/** Where a result opens when the search panel is in a pop-out window: the main window, or beside the panel. */
	openIn: OpenIn;
	/** Past searches, oldest first. Only ever appended to; a newer version may add fields to an entry. */
	history: SearchState[];
}

/**
 * Defaults for a first run. A saved file from an older version may lack newer keys:
 * always merge it over these (see `loadSettings`), and only ever ADD keys, never rename
 * or repurpose one, so an upgrade cannot misread what a user already saved.
 */
export const DEFAULT_SETTINGS: RichSearchSettings = {
	filter: {
		allowFolders: [],
		denyFolders: [],
		allowExtensions: [],
		// Typical sources of base64-like noise in a notes vault.
		denyExtensions: [],
	},
	// Excalidraw's drawing payload: base64-like noise. The readable "Text Elements" section outside it stays searchable.
	blockModes: { 'compressed-json': 'skip' },
	excalidraw: true,
	matchColor: '#ccff00',
	alwaysExcludeFolders: [],
	openIn: 'main',
	history: [],
};

/** Merges saved data over the defaults, one level deep into `filter`. */
export function loadSettings(saved: Partial<RichSearchSettings> | null | undefined): RichSearchSettings {
	const filter = { ...DEFAULT_SETTINGS.filter, ...saved?.filter };
	return {
		...DEFAULT_SETTINGS,
		...saved,
		// Copy the lists: the view edits them in place, and that must never reach DEFAULT_SETTINGS.
		filter: {
			allowFolders: [...filter.allowFolders],
			denyFolders: [...filter.denyFolders],
			allowExtensions: [...filter.allowExtensions],
			denyExtensions: [...filter.denyExtensions],
		},
		blockModes: { ...DEFAULT_SETTINGS.blockModes, ...saved?.blockModes },
		excalidraw: typeof saved?.excalidraw === 'boolean' ? saved.excalidraw : DEFAULT_SETTINGS.excalidraw,
		matchColor: normalizeColor(saved?.matchColor, DEFAULT_SETTINGS.matchColor),
		alwaysExcludeFolders: Array.isArray(saved?.alwaysExcludeFolders) ? saved.alwaysExcludeFolders.filter((f): f is string => typeof f === 'string') : [],
		openIn: saved?.openIn === 'panel' ? 'panel' : DEFAULT_SETTINGS.openIn,
		history: sanitizeHistory(saved?.history),
	};
}

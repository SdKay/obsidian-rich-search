import type { FileFilter } from './types';

/** Everything the user can configure. Persisted through `loadData` / `saveData`. */
export interface RichSearchSettings {
	filter: FileFilter;
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
};

/** Merges saved data over the defaults, one level deep into `filter`. */
export function loadSettings(saved: Partial<RichSearchSettings> | null | undefined): RichSearchSettings {
	return {
		...DEFAULT_SETTINGS,
		...saved,
		filter: { ...DEFAULT_SETTINGS.filter, ...saved?.filter },
	};
}

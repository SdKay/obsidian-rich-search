import { isAllowed } from './filter';
import { withAlwaysExcluded } from './folders';
import type { FileFilter } from './types';

/** The parts of the settings that decide which files a search covers. */
export interface ScopeSettings {
	filter: FileFilter;
	alwaysExcludeFolders: readonly string[];
	excalidraw: boolean;
}

/** The filter a search runs with. The match highlights use the same one, so they cover exactly the files the results do. */
export function effectiveFilter(settings: ScopeSettings): FileFilter {
	return withAlwaysExcluded(settings.filter, settings.alwaysExcludeFolders);
}

/** Whether the search covers this file. Decided from the path alone. */
export function inScope(path: string, settings: ScopeSettings): boolean {
	return isAllowed(path, effectiveFilter(settings), { excalidraw: settings.excalidraw });
}

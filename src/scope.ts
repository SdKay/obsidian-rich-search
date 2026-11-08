import { isAllowed, type FilterOptions } from './filter';
import { matchesAll, type ValueTypes } from './properties';
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

/**
 * What the metadata cache knows about one note. `found: false` means the cache has no entry for it yet. A note that has
 * an entry but no frontmatter is `found: true` with `frontmatter` undefined.
 */
export type PropertyAnswer = { found: false } | { found: true; frontmatter: Record<string, unknown> | undefined; types?: ValueTypes };
export type PropertyLookup = (path: string) => PropertyAnswer;

const isNote = (path: string): boolean => path.toLowerCase().endsWith('.md');

/**
 * Whether a search with this filter covers this file. The path decides first, from the path alone, and a file it rules out is
 * never looked up. Then, when the filter has property conditions, only a note can pass: a PDF or a diagram has no
 * properties. A note the cache does not know yet is covered, and so is one the lookup fails on, so a search never hides
 * results because the cache was not ready. Without a lookup a condition cannot be decided and the note is covered.
 * Searching, marking the open notes and answering other plugins all use this one function, so they cannot disagree.
 */
export function coversFile(path: string, filter: FileFilter, options: FilterOptions, lookup?: PropertyLookup): boolean {
	if (!isAllowed(path, filter, options)) return false;
	if (filter.properties.length === 0) return true;
	if (!isNote(path)) return false;
	if (!lookup) return true;
	let answer: PropertyAnswer;
	try {
		answer = lookup(path);
	} catch {
		return true;
	}
	if (!answer.found) return true;
	return matchesAll(answer.frontmatter ?? {}, filter.properties, answer.types);
}

/** Whether the search covers this file, for the settings as the plugin holds them. */
export function inScope(path: string, settings: ScopeSettings, lookup?: PropertyLookup): boolean {
	return coversFile(path, effectiveFilter(settings), { excalidraw: settings.excalidraw }, lookup);
}

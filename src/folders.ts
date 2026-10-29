import type { FileFilter } from './types';

const clean = (p: string): string => p.trim().replace(/^\/+/, '').replace(/\/+$/, '');

/**
 * Folders that match what the user typed so far: anywhere in the path, ranked so that the most likely
 * one comes first (path starts with it, then last segment starts with it, then anything containing it).
 * The vault root is never offered: an empty entry means nothing to the scope.
 */
export function suggestFolders(query: string, folders: string[], limit = 20): string[] {
	const q = clean(query).toLowerCase();
	const seen = new Set<string>();
	const scored: { path: string; rank: number }[] = [];

	for (const raw of folders) {
		const path = clean(raw);
		if (path === '' || seen.has(path)) continue;
		seen.add(path);
		const lower = path.toLowerCase();
		if (!lower.includes(q)) continue;
		const last = lower.slice(lower.lastIndexOf('/') + 1);
		const rank = lower.startsWith(q) ? 0 : last.startsWith(q) ? 1 : 2;
		scored.push({ path, rank });
	}

	return scored
		.sort((a, b) => a.rank - b.rank || a.path.length - b.path.length || a.path.localeCompare(b.path))
		.slice(0, limit)
		.map((s) => s.path);
}

/** The filter for "search in this folder": only that folder, nothing excluded, file types as they were. The vault root means every folder, which is an empty include list. */
export function scopeToFolder(filter: FileFilter, folder: string): FileFilter {
	const path = clean(folder);
	return { ...filter, allowFolders: path === '' ? [] : [path], denyFolders: [] };
}

/** The filter a search runs with: the panel's, plus the folders the settings say to exclude from every search. Neither list is changed. */
export function withAlwaysExcluded(filter: FileFilter, always: readonly string[]): FileFilter {
	const extra = always.map((f) => f.trim()).filter((f) => f !== '' && !filter.denyFolders.includes(f));
	return { ...filter, denyFolders: [...filter.denyFolders, ...new Set(extra)] };
}

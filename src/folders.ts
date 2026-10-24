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

/**
 * Splits items by the window they belong to, keeping their order. A pop-out window is a document of its own with its
 * own highlight registry, so a mark made for it has to be registered there, not in the main window's.
 */
export function groupByWindow<T, W>(items: readonly T[], windowOf: (item: T) => W): Map<W, T[]> {
	const groups = new Map<W, T[]>();
	for (const item of items) {
		const key = windowOf(item);
		const group = groups.get(key);
		if (group) group.push(item);
		else groups.set(key, [item]);
	}
	return groups;
}

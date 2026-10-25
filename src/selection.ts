/** One hit as the list shows it, top to bottom: its number, and the file it is listed under. */
export interface Row {
	hit: number;
	file: string;
}

/**
 * The hit to select after an arrow key. Hits of a collapsed file are not on screen and are skipped. With
 * nothing selected (or a selection that is no longer on screen), down picks the first and up the last.
 * At either end the selection stays where it is, as in VS Code.
 */
export function nextSelection(rows: readonly Row[], collapsed: ReadonlySet<string>, current: number | undefined, direction: 'up' | 'down'): number | undefined {
	const step = direction === 'down' ? 1 : -1;
	const shown = (i: number): boolean => {
		const r = rows[i];
		return r !== undefined && !collapsed.has(r.file);
	};

	const from = current === undefined ? -1 : rows.findIndex((r) => r.hit === current);
	if (from >= 0 && shown(from)) {
		// Walk to the next row that is on screen; at the end of the list the selection stays.
		for (let i = from + step; i >= 0 && i < rows.length; i += step) if (shown(i)) return rows[i]?.hit;
		return current;
	}

	if (from < 0) {
		// Nothing selected, or a selection that is no longer in the list: down picks the first row on screen, up the last.
		for (let i = direction === 'down' ? 0 : rows.length - 1; i >= 0 && i < rows.length; i += step) if (shown(i)) return rows[i]?.hit;
		return undefined;
	}

	// A selection that has been hidden keeps its place in the full list: move on from there.
	for (let i = from + step; i >= 0 && i < rows.length; i += step) if (shown(i)) return rows[i]?.hit;
	return current;
}

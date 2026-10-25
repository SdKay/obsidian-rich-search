const same = (a: readonly string[], b: readonly string[]): boolean =>
	a.length === b.length && a.every((cell, i) => cell.trim() === (b[i] ?? '').trim());

/**
 * Which of the tables on a rendered page holds the opened row. A page has no line numbers and draws sections
 * lazily, so the n-th table on it is not necessarily the n-th table of the note; the row is found by what its
 * cells say. Undefined when no table has the row (it is not drawn yet) and when several do (the choice would be a guess).
 */
export function pickTable(pageTables: readonly (readonly (readonly string[])[])[], row: number, cells: readonly string[]): number | undefined {
	const found: number[] = [];
	pageTables.forEach((table, i) => {
		const candidate = table[row];
		if (candidate && same(candidate, cells)) found.push(i);
	});
	return found.length === 1 ? found[0] : undefined;
}

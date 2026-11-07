export const QUERY_FROM_SELECTION_LIMIT = 200;

/**
 * The query to put in the search box for a selection in a note: its first line with text, trimmed and cut to a length the
 * box can show. The box holds one line, so a longer selection would lose its line breaks anyway. Undefined when there is
 * nothing to search for.
 */
export function queryFromSelection(selection: string | undefined): string | undefined {
	const line = (selection ?? '').split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '');
	if (line === undefined) return undefined;
	// Cut by code point, not by UTF-16 unit, so a character outside the basic plane is never split.
	return [...line].slice(0, QUERY_FROM_SELECTION_LIMIT).join('').trimEnd();
}

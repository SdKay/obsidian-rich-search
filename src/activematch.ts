import type { Range } from './linematches';

/**
 * Which of `matches` (document ranges, in order) is the `index`-th match of `line`, or -1. `lineStarts`
 * holds the document offset where each line begins, so a match belongs to the last line that starts at or
 * before it.
 */
export function activeIndexIn(
	matches: readonly Range[],
	lineStarts: readonly number[],
	hit: { line: number; index: number } | null,
): number {
	if (!hit || hit.line < 0 || hit.line >= lineStarts.length) return -1;
	const start = lineStarts[hit.line] ?? 0;
	const next = lineStarts[hit.line + 1] ?? Number.POSITIVE_INFINITY;
	let seen = 0;
	for (let i = 0; i < matches.length; i++) {
		const from = matches[i]?.from ?? -1;
		if (from < start || from >= next) continue;
		if (seen === hit.index) return i;
		seen++;
	}
	return -1;
}

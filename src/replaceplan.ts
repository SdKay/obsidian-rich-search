import { canReplaceHit } from './replace';
import type { Replacement } from './applyreplace';
import type { SearchHit } from './types';

export interface FilePlan {
	path: string;
	lines: Replacement[];
}

export interface ReplacePlan {
	files: FilePlan[];
	fileCount: number;
	/** Lines that will be rewritten. */
	lineCount: number;
	/** Matches on those lines: what the user sees change. */
	matchCount: number;
	/** Hits left out because they are not an ordinary line of a Markdown note. */
	notReplaceable: number;
}

/**
 * What "replace all" would touch: the replaceable hits, grouped by note in the order they were found. Built from every
 * hit of the search, not from the part that is drawn, so the numbers shown to the user are the numbers that change.
 */
export function planReplaceAll(hits: readonly SearchHit[]): ReplacePlan {
	const byPath = new Map<string, FilePlan>();
	let lineCount = 0;
	let matchCount = 0;
	let notReplaceable = 0;
	for (const hit of hits) {
		if (!canReplaceHit(hit)) { notReplaceable++; continue; }
		let file = byPath.get(hit.path);
		if (!file) { file = { path: hit.path, lines: [] }; byPath.set(hit.path, file); }
		file.lines.push({ line: hit.line, text: hit.text });
		lineCount++;
		matchCount += hit.spans.length;
	}
	return { files: [...byPath.values()], fileCount: byPath.size, lineCount, matchCount, notReplaceable };
}

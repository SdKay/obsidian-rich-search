import { replaceInLine } from './replace';
import type { MatchOptions } from './types';

/** A line the user chose to replace in: its 0-based number and the text the search showed for it. */
export interface Replacement {
	line: number;
	text: string;
}

export interface Skipped {
	line: number;
	/** `changed`: the line is not what the search saw, so it is left alone. `no-match`: the pattern finds nothing in it any more. */
	reason: 'changed' | 'no-match';
}

export interface ReplaceResult {
	text: string;
	/** Lines that were rewritten. */
	replaced: number;
	skipped: Skipped[];
}

/**
 * Applies the chosen replacements to the text of a note. Each line is checked against what the search saw before it is
 * touched: if the note was edited in between, that line is skipped and reported, never guessed at. Line endings are kept
 * exactly as they are, line by line, so a file with Windows or mixed endings is not rewritten.
 */
export function applyReplacements(source: string, chosen: readonly Replacement[], opts: MatchOptions, replacement: string): ReplaceResult {
	// Each piece is a line with its own ending, so joining them gives back the file byte for byte.
	const pieces = source.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) ?? [];
	const skipped: Skipped[] = [];
	const done = new Set<number>();
	let replaced = 0;

	for (const { line, text } of chosen) {
		if (done.has(line)) continue;
		done.add(line);
		const piece = pieces[line] ?? '';
		const body = piece.replace(/(?:\r\n|\n|\r)$/, '');
		// A line past the end of the note reads as an empty piece, which no search hit can equal.
		if (piece === '' || body !== text) { skipped.push({ line, reason: 'changed' }); continue; }
		const next = replaceInLine(body, opts, replacement);
		if (next === body) { skipped.push({ line, reason: 'no-match' }); continue; }
		pieces[line] = next + piece.slice(body.length);
		replaced++;
	}
	return { text: pieces.join(''), replaced, skipped };
}

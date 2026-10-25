import { matchLine } from './match';
import type { MatchOptions } from './types';

/** A stretch of a document, from `from` up to but not including `to`. */
export interface Range {
	from: number;
	to: number;
}

/** One line of a document: where it starts and what it says. */
export interface DocLine {
	from: number;
	text: string;
}

/** The most marks drawn in one pass. A single letter matches thousands of times in a screenful. */
export const MARK_LIMIT = 500;

/**
 * Document ranges of every match of `query` in `lines`, in order, stopping at `limit`. Each line is matched
 * on its own, so nothing spans a line break. An empty or invalid query matches nothing, so marks nothing.
 */
export function matchesInLines(lines: DocLine[], query: MatchOptions, limit = MARK_LIMIT): Range[] {
	const out: Range[] = [];
	for (const line of lines) {
		for (const span of matchLine(line.text, query)) {
			out.push({ from: line.from + span.start, to: line.from + span.end });
			if (out.length >= limit) return out;
		}
	}
	return out;
}

/** The part of CodeMirror's document that this needs, so the walk can be tested without an editor. */
export interface LineSource {
	length: number;
	lineAt(pos: number): { from: number; to: number; text: string };
}

/**
 * The lines that the visible ranges touch, each once and in order. `lineAt` throws for a position past
 * the end, so every position asked for is kept inside the document.
 */
export function linesInRanges(doc: LineSource, ranges: readonly { from: number; to: number }[]): DocLine[] {
	const lines: DocLine[] = [];
	let covered = -1;
	for (const range of ranges) {
		const to = Math.min(range.to, doc.length);
		for (let pos = Math.max(range.from, covered + 1); pos <= to;) {
			const line = doc.lineAt(pos);
			lines.push({ from: line.from, text: line.text });
			covered = line.to;
			pos = line.to + 1;
		}
		// A range that sits inside a line already taken adds nothing; one that starts inside it continues after it.
	}
	return lines;
}

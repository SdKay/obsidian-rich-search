import { MARK_LIMIT } from './linematches';
import { matchLine } from './match';
import { renderedLine } from './renderedline';
import { rangesInNodes } from './textranges';
import type { MatchOptions } from './types';

/** A run of text from the page and the block it sits in (a paragraph, a list item, a heading, a cell...). */
export interface TextPiece {
	block: number;
	text: string;
}

/** A stretch of one piece to mark. `piece` is the position in the list that was given. */
export interface PieceRange {
	piece: number;
	start: number;
	end: number;
}

/**
 * Where a search matches in text that a page has split into pieces. Pieces of the same block are joined
 * before matching, so a word cut by bold text or a link is still found; a match never runs from one
 * block into the next. Stops after `limit` marks.
 */
export function rangesInBlocks(pieces: TextPiece[], query: MatchOptions, limit = MARK_LIMIT): PieceRange[] {
	const out: PieceRange[] = [];
	for (let first = 0; first < pieces.length && out.length < limit;) {
		let last = first;
		while (last + 1 < pieces.length && pieces[last + 1]?.block === pieces[first]?.block) last++;

		const texts = pieces.slice(first, last + 1).map((p) => p.text);
		for (const r of rangesInNodes(texts, matchLine(texts.join(''), query))) {
			if (out.length >= limit) break;
			out.push({ piece: first + r.node, start: r.start, end: r.end });
		}
		first = last + 1;
	}
	return out;
}

/**
 * Which of `ranges` (from rangesInBlocks over `pieces`) is the `index`-th match of the line `lineText` of the note, or -1.
 * A page has no line numbers, so the line is found by its text. A paragraph of several source lines is one block on the
 * page, its lines separated by line breaks, so the line only has to be one whole line of a block. A line whose source has
 * markup is compared by what the page shows of it; a line not found leaves every match ordinary rather than marking the
 * wrong one.
 */
export function activeRangeIn(pieces: TextPiece[], ranges: PieceRange[], lineText: string, index: number): number {
	const wanted = renderedLine(lineText);
	for (let first = 0; first < pieces.length;) {
		let last = first;
		while (last + 1 < pieces.length && pieces[last + 1]?.block === pieces[first]?.block) last++;

		const text = pieces.slice(first, last + 1).map((p) => p.text).join('');
		const span = lineSpan(text, wanted);
		if (span) return nthMatchIn(pieces, ranges, first, last, span, index);
		first = last + 1;
	}
	return -1;
}

/** Where, in the text of a block, a whole line equal to `wanted` is: from its first character up to, not including, the line break. */
function lineSpan(block: string, wanted: string): { from: number; to: number } | undefined {
	let from = 0;
	for (const line of block.split('\n')) {
		if (line.trim() === wanted) {
			const lead = line.length - line.trimStart().length;
			return { from: from + lead, to: from + lead + wanted.length };
		}
		from += line.length + 1;
	}
	return undefined;
}

/** The `index`-th match whose first character falls inside `span`, counting the block's pieces `first`..`last` as one text. */
function nthMatchIn(pieces: TextPiece[], ranges: PieceRange[], first: number, last: number, span: { from: number; to: number }, index: number): number {
	const starts: number[] = [];
	let offset = 0;
	for (let i = first; i <= last; i++) {
		starts[i] = offset;
		offset += pieces[i]?.text.length ?? 0;
	}
	let seen = 0;
	for (let i = 0; i < ranges.length; i++) {
		const r = ranges[i];
		if (!r || r.piece < first || r.piece > last) continue;
		const at = (starts[r.piece] ?? 0) + r.start;
		if (at < span.from || at >= span.to) continue;
		if (seen === index) return i;
		seen++;
	}
	return -1;
}

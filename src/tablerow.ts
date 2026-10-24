import { splitNote } from './blocks';

/** One cell of a Markdown table row. `from` and `to` bound its text, without the pipes or the padding spaces. */
export interface Cell {
	index: number;
	from: number;
	to: number;
	text: string;
}

/**
 * The cells of one table row, found the way GFM does: a pipe ends a cell unless a backslash escapes it.
 * Offsets are UTF-16 code units of `line`, so they can be handed straight to the editor.
 */
export function splitRow(line: string): Cell[] {
	if (!line.includes('|')) return [];

	const pipes: number[] = [];
	for (let i = 0; i < line.length; i++) {
		if (line[i] === '\\') { i++; continue; }
		if (line[i] === '|') pipes.push(i);
	}

	const lead = line.length - line.trimStart().length;
	const end = line.trimEnd().length;
	const bounds: [number, number][] = [];
	let from = lead + (line[lead] === '|' ? 1 : 0);
	for (const p of pipes) {
		if (p < from) continue;
		bounds.push([from, p]);
		from = p + 1;
	}
	if (from < end) bounds.push([from, end]);

	return bounds.map(([a, b], index) => {
		let lo = a;
		let hi = b;
		while (lo < hi && line[lo] === ' ') lo++;
		while (hi > lo && line[hi - 1] === ' ') hi--;
		return { index, from: lo, to: hi, text: line.slice(lo, hi) };
	});
}

/** The `| --- | :---: |` line under a table header. */
export function isDelimiterRow(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed.includes('|') && !/^:?-{3,}:?$/.test(trimmed)) return false;
	if (trimmed === '---') return false;
	const cells = splitRow(trimmed.includes('|') ? trimmed : `${trimmed} |`);
	return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.text));
}

export interface TableLocation {
	/** Line of the header row. */
	start: number;
	/** Line of the `| --- |` row, which is not drawn. */
	delimiter: number;
	/** Line of the last row. */
	end: number;
	/** The drawn row of the requested line: 0 for the header, then the body rows in order. */
	row: number;
}

/** A note split once, with the answer to "is this line a table row?" ready. */
interface Scanned {
	lines: string[];
	isRow: (i: number) => boolean;
}

function scan(text: string): Scanned {
	const { lines, blocks } = splitNote(text);
	const code = new Set<number>();
	for (const b of blocks) for (let l = b.fromLine; l <= b.toLine; l++) code.add(l);
	return { lines, isRow: (i) => i >= 0 && i < lines.length && !code.has(i) && splitRow(lines[i] ?? '').length > 0 };
}

/** The table whose header is at `h`, if a header, a matching delimiter row and a body start there. */
function tableFrom({ lines, isRow }: Scanned, h: number): { start: number; delimiter: number; end: number } | undefined {
	const d = h + 1;
	if (!isRow(h) || !isRow(d) || !isDelimiterRow(lines[d] ?? '')) return undefined;
	if (splitRow(lines[h] ?? '').length !== splitRow(lines[d] ?? '').length) return undefined;
	let end = d;
	while (isRow(end + 1)) end++;
	return { start: h, delimiter: d, end };
}

/**
 * Every table of a note in reading order, as GFM reads them: a header row, a delimiter row with the
 * same number of cells, then every following line up to a blank one. Lines in code blocks are never
 * table lines. The note is split once, however many tables it holds.
 */
function allTables(scanned: Scanned): { start: number; delimiter: number; end: number }[] {
	const tables: { start: number; delimiter: number; end: number }[] = [];
	for (let i = 0; i < scanned.lines.length; i++) {
		const t = tableFrom(scanned, i);
		if (!t) continue;
		tables.push(t);
		i = t.end;
	}
	return tables;
}

/**
 * The table that a note line belongs to and which drawn row the line is, so the rendered table can be
 * searched row by row. Called once per click, so it simply scans.
 */
export function tableAt(text: string, line: number): TableLocation | undefined {
	const t = allTables(scan(text)).find((x) => line >= x.start && line <= x.end);
	if (!t || line === t.delimiter) return undefined;
	return { ...t, row: line === t.start ? 0 : line - t.delimiter };
}

/** Which table of the note a line is in, counting from 0 in reading order. Undefined outside a table. */
export function tableNumber(text: string, line: number): number | undefined {
	const index = allTables(scan(text)).findIndex((x) => line >= x.start && line <= x.end && line !== x.delimiter);
	return index < 0 ? undefined : index;
}

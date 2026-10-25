/** The part of CodeMirror's document this needs: its line count, and a line by its 1-based number. */
export interface LineDoc {
	lines: number;
	line(n: number): { from: number };
}

/** Where a 0-based line starts. A line outside the document is moved to the nearest one, so a stale hit never throws. */
export function offsetOfLine(doc: LineDoc, line: number): number {
	return doc.line(Math.min(Math.max(line, 0), doc.lines - 1) + 1).from;
}

/**
 * The `match` state Obsidian's own search opens a note with: the text, and the character range of the match in it.
 * In reading view Obsidian turns the offset back into a line and scrolls it into the middle in one move, which `line`
 * does not do (it puts the line at the top). Undefined when the note has no such line or there is no match.
 */
export function matchStateFor(text: string, line: number, span: { start: number; end: number } | undefined): { content: string; matches: [number, number][] } | undefined {
	if (!span || line < 0) return undefined;
	let start = 0;
	for (let i = 0; i < line; i++) {
		const next = text.indexOf('\n', start);
		if (next < 0) return undefined;
		start = next + 1;
	}
	return { content: text, matches: [[start + span.start, start + span.end]] };
}

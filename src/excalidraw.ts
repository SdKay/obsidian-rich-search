import { splitNote } from './blocks';

/** A note written by the Excalidraw plugin: a drawing stored as Markdown. A plain `.excalidraw` JSON file is not one. */
export function isExcalidrawNote(path: string): boolean {
	const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
	return name.endsWith('.excalidraw.md') && name.length > '.excalidraw.md'.length;
}

export interface TextElementLine {
	/** 0-based line of the note. */
	line: number;
	text: string;
}

const HEADING = /^#{1,6}\s/;
const SECTION = /^##\s+Text Elements\s*$/;
/** Excalidraw ends every text element with ` ^` and an id so other notes can link to it. */
const BLOCK_ID = /\s+\^[A-Za-z0-9-]+\s*$/;

/**
 * The words in a drawing, from the readable `## Text Elements` section. The rest of the note (the hint
 * line, the compressed drawing data) is not text a person wrote and is never returned.
 */
export function textElementLines(text: string): TextElementLine[] {
	const { lines, blocks } = splitNote(text);
	const inBlock = new Set<number>();
	for (const b of blocks) for (let l = b.fromLine; l <= b.toLine; l++) inBlock.add(l);

	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		if (!inBlock.has(i) && SECTION.test(lines[i] ?? '')) { start = i + 1; break; }
	}
	if (start < 0) return [];

	const out: TextElementLine[] = [];
	for (let i = start; i < lines.length; i++) {
		const raw = lines[i] ?? '';
		if (raw.trim() === '%%' || HEADING.test(raw)) break;
		const clean = raw.replace(BLOCK_ID, '').trim();
		if (clean !== '') out.push({ line: i, text: clean });
	}
	return out;
}

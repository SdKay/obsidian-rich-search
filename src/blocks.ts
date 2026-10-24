/** A fenced code block in a note. Lines are 0-based; `fromLine` and `toLine` are the fence lines themselves. */
export interface FencedBlock {
	/** Lower-case first word of the info string, or '' when there is none. */
	language: string;
	fromLine: number;
	toLine: number;
	/** The lines between the fences, with a quote or callout prefix removed. */
	source: string;
}

export interface SplitNote {
	/** The note split on \r?\n. Every line number in `blocks` indexes this array. */
	lines: string[];
	blocks: FencedBlock[];
}

const QUOTE_PREFIX = /^ {0,3}(?:> ?)+/;
const OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** Removes a leading blockquote or callout marker, so a fence inside `> ` is found like any other. */
function stripQuote(line: string): string {
	return line.replace(QUOTE_PREFIX, '');
}

/** The line index after a leading `---` front matter block, or 0 when there is none. */
function bodyStart(lines: string[]): number {
	if (lines[0]?.trimEnd() !== '---') return 0;
	for (let i = 1; i < lines.length; i++) {
		const l = lines[i]?.trimEnd();
		if (l === '---' || l === '...') return i + 1;
	}
	return 0;
}

/**
 * Splits a note into lines and fenced code blocks, following CommonMark: a closing fence uses the same
 * character and is at least as long as the opening one, up to three spaces of indentation, nothing but
 * spaces after it, and an unclosed fence runs to the end of the note. This is the one place fence rules live.
 */
export function splitNote(text: string): SplitNote {
	const lines = text.split(/\r?\n/);
	const blocks: FencedBlock[] = [];

	for (let i = bodyStart(lines); i < lines.length; i++) {
		const open = OPEN.exec(stripQuote(lines[i] ?? ''));
		if (!open) continue;
		const fence = open[1] ?? '';
		const info = (open[2] ?? '').trim();
		// A backtick fence cannot have a backtick in its info string: that is an inline code span.
		if (fence[0] === '`' && info.includes('`')) continue;

		const closer = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`);
		let close = -1;
		for (let j = i + 1; j < lines.length; j++) {
			if (closer.test(stripQuote(lines[j] ?? ''))) { close = j; break; }
		}
		const closed = close >= 0;
		const end = closed ? close : lines.length - 1;

		blocks.push({
			language: (info.split(/\s+/)[0] ?? '').toLowerCase(),
			fromLine: i,
			toLine: end,
			source: lines.slice(i + 1, closed ? end : end + 1).map(stripQuote).join('\n'),
		});
		i = end;
	}

	return { lines, blocks };
}

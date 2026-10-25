const BLOCK_MARKER = /^[ \t]*(?:>[ \t]?|#{1,6}[ \t]+|[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+[.)][ \t]+)/;

/**
 * What a reader sees of one line of a note: the same text without the characters that only say how to draw it
 * (heading, list, quote and task markers; the marks round bold, emphasis, strike-through, highlight and code;
 * the address of a link). A rendered page has no line numbers, so this is how a line is found on it. It covers the
 * common cases and leaves anything unusual as it is, in which case the line is simply not found.
 */
export function renderedLine(source: string): string {
	let text = source.replace(BLOCK_MARKER, '');
	// A quote can hold a list, and a list a quote: take markers off until none is left.
	for (let before = ''; before !== text;) {
		before = text;
		text = text.replace(BLOCK_MARKER, '');
	}
	return text
		.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
		.replace(/\[\[([^\]]*)\]\]/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/(\*\*|__|~~|==|`)(.+?)\1/g, '$2')
		.replace(/(^|[^\w*])([*_])(\S|\S.*?\S)\2(?![\w*])/g, '$1$3')
		.trim();
}

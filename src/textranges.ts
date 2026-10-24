import type { Span } from './types';

/** A stretch of one text node to mark. */
export interface NodeRange {
	node: number;
	start: number;
	end: number;
}

/**
 * Where spans of a block of text fall in the text nodes that make it up. A word cut by bold text lands
 * in two nodes; each piece is returned separately, which is what a DOM Range needs.
 * The input is one table cell or one line: a handful of nodes and spans, so a plain scan is enough.
 */
export function rangesInNodes(nodes: ArrayLike<string>, spans: Span[]): NodeRange[] {
	const out: NodeRange[] = [];
	for (const span of spans) {
		let offset = 0;
		for (let i = 0; i < nodes.length; i++) {
			const length = nodes[i]?.length ?? 0;
			const start = Math.max(span.start, offset);
			const end = Math.min(span.end, offset + length);
			if (end > start) out.push({ node: i, start: start - offset, end: end - offset });
			offset += length;
			if (offset >= span.end) break;
		}
	}
	return out;
}

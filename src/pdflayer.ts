import type { TextPiece } from './blocktext';

/** One child of a PDF viewer's text layer, in order: a run of text, or a line break between lines. */
export type LayerNode = { kind: 'text'; text: string } | { kind: 'break' };

/**
 * The text of a PDF page as pieces for the matcher. A line is a block: text nodes between two breaks are joined, so
 * a word the PDF cut into several nodes is still found, and a match never runs from one line into the next.
 * `nodeOf[i]` is the position in `nodes` of the i-th piece, to put a match back on the page.
 */
export function piecesOfLayer(nodes: readonly LayerNode[]): { pieces: TextPiece[]; nodeOf: number[] } {
	const pieces: TextPiece[] = [];
	const nodeOf: number[] = [];
	let block = 0;
	let open = false;
	nodes.forEach((node, i) => {
		if (node.kind === 'break') {
			if (open) { block++; open = false; }
			return;
		}
		if (node.text === '') return;
		pieces.push({ block, text: node.text });
		nodeOf.push(i);
		open = true;
	});
	return { pieces, nodeOf };
}

/** Whether the layer of `layerPage` may hold the opened match. A slide deck repeats its titles on neighbouring pages, so matching the line's text alone can pick the wrong page. */
export function layerMayHoldOpened(openedPage: number | undefined, layerPage: number | undefined): boolean {
	return openedPage === undefined || layerPage === undefined || openedPage === layerPage;
}

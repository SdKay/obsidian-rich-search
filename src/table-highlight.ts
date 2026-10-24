import { matchLine } from './match';
import { rangesInNodes } from './textranges';
import { tableAt } from './tablerow';
import type { MatchOptions } from './types';

const HIGHLIGHT_NAME = 'rs-match';

/** The text nodes of a cell, in order, skipping the drag-handle icon that sits inside each header cell. */
function textNodesOf(cell: Element): Text[] {
	const wrapper = cell.querySelector('.table-cell-wrapper') ?? cell;
	const walker = cell.ownerDocument.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
	const out: Text[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
	return out;
}

export function clearTableHighlight(): void {
	if (typeof CSS !== 'undefined' && 'highlights' in CSS) CSS.highlights.delete(HIGHLIGHT_NAME);
}

/**
 * Marks the search matches in the rendered table that holds `line` of the note, and scrolls the first
 * marked cell into view. Obsidian draws a table in its own widget, so the editor's decorations cannot
 * reach it; the CSS Custom Highlight API colours text nodes without touching the DOM.
 * `tableIndex` is which table of the note this is (0 for the first), found by counting tables above.
 * Returns whether anything was marked.
 */
export function highlightInRenderedTable(root: Element, note: string, line: number, tableIndex: number, query: MatchOptions): boolean {
	if (typeof CSS === 'undefined' || !('highlights' in CSS)) return false;
	const where = tableAt(note, line);
	if (!where) return false;

	const widget = root.querySelectorAll('.cm-table-widget')[tableIndex];
	const row = widget?.querySelectorAll('tr')[where.row];
	if (!row) return false;

	const ranges: Range[] = [];
	let first: Element | null = null;
	for (const cell of Array.from(row.querySelectorAll('th, td'))) {
		const nodes = textNodesOf(cell);
		const text = nodes.map((n) => n.data).join('');
		const spans = matchLine(text, query);
		for (const r of rangesInNodes(nodes.map((n) => n.data), spans)) {
			const node = nodes[r.node];
			if (!node) continue;
			const range = new Range();
			range.setStart(node, r.start);
			range.setEnd(node, r.end);
			ranges.push(range);
			first ??= cell;
		}
	}
	if (ranges.length === 0) return false;

	CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
	first?.scrollIntoView({ block: 'center', inline: 'nearest' });
	return true;
}

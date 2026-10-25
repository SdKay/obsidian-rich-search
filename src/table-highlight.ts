import { matchLine } from './match';
import { activeRangeIn, rangesInBlocks, type TextPiece } from './blocktext';
import { MARK_LIMIT } from './linematches';
import { boxRange, clearBox } from './activebox';
import { layerMayHoldOpened, piecesOfLayer, type LayerNode } from './pdflayer';
import { renderedLine } from './renderedline';
import { pickTable } from './tablepick';
import { cellAtColumn, splitRow, tableAt, tablesOf, tableStartingAt } from './tablerow';
import { rangesInNodes } from './textranges';
import type { MatchOptions } from './types';

const HIGHLIGHT_NAME = 'rs-match';
const ACTIVE_NAME = 'rs-match-active';
// A PDF's text layer is invisible text over the page image, so its marks are see-through and set no text colour (see styles.css).
const PDF_NAME = 'rs-match-pdf';
const PDF_ACTIVE_NAME = 'rs-match-pdf-active';

/** The match the user opened: the text of its line as the note says it, and which match on that line. */
export interface OpenedLine {
	text: string;
	index: number;
	/** For a PDF: the page it is on (1-based). */
	page?: number;
	/** For a note: the line number, and the column where the match starts in it. A table row is found by these. */
	line?: number;
	column?: number;
}

const supported = (): boolean => typeof CSS !== 'undefined' && 'highlights' in CSS;

/** The text nodes of a cell, in order, skipping the drag-handle icon that sits inside each header cell. */
function textNodesOf(cell: Element): Text[] {
	const wrapper = cell.querySelector('.table-cell-wrapper') ?? cell;
	const walker = cell.ownerDocument.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
	const out: Text[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
	return out;
}

/** The ranges of the matches in one rendered cell, matched on the text as it is drawn. */
function rangesInCell(cell: Element, query: MatchOptions): Range[] {
	const nodes = textNodesOf(cell);
	const text = nodes.map((n) => n.data);
	const out: Range[] = [];
	for (const r of rangesInNodes(text, matchLine(text.join(''), query))) {
		const node = nodes[r.node];
		if (!node) continue;
		const range = new Range();
		range.setStart(node, r.start);
		range.setEnd(node, r.end);
		out.push(range);
	}
	return out;
}

/**
 * A note on screen. In the editor, its tables are drawn by widgets outside the decorations and are matched
 * to the note's text. In reading view the whole page is rendered HTML and is searched as it is.
 */
export type PageSource =
	| { kind: 'editor'; path: string; note: string; root: Element; lineOf?: (widget: Element) => number | undefined }
	| { kind: 'reading'; path: string; root: Element; note?: string }
	/** The text layers of the pages a PDF viewer has drawn. */
	| { kind: 'pdf'; path: string; layers: Element[] };

const BLOCK_DISPLAYS = new Set(['inline', 'contents']);

/**
 * The text of a rendered page as pieces, each tagged with the block it sits in: the nearest ancestor that
 * is not an inline box. Judged by `display`, not by tag name, so a structure Obsidian or a plugin builds
 * that we have not seen is still grouped sensibly. Scripts, styles and hidden elements are left out.
 */
function textPiecesOf(root: Element): { pieces: TextPiece[]; nodes: Text[] } {
	const doc = root.ownerDocument;
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (n) => (n.parentElement?.closest('script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
	});
	const ids = new Map<Element, number>();
	const blockOf = new Map<Element, Element>();
	const pieces: TextPiece[] = [];
	const nodes: Text[] = [];

	for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
		const parent = n.parentElement;
		if (!parent || n.data === '') continue;
		let block = blockOf.get(parent);
		if (!block) {
			let el: Element | null = parent;
			while (el && el !== root && BLOCK_DISPLAYS.has(getComputedStyle(el).display)) el = el.parentElement;
			block = el ?? root;
			blockOf.set(parent, block);
		}
		if (!ids.has(block)) ids.set(block, ids.size);
		pieces.push({ block: ids.get(block) ?? 0, text: n.data });
		nodes.push(n);
	}
	return { pieces, nodes };
}

/** The text nodes of a PDF text layer, in reading order, with the line breaks between them as markers. */
function layerNodesOf(layer: Element): { nodes: LayerNode[]; texts: (Text | null)[] } {
	const doc = layer.ownerDocument;
	const walker = doc.createTreeWalker(layer, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
	const nodes: LayerNode[] = [];
	const texts: (Text | null)[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (n.nodeType === Node.TEXT_NODE) {
			nodes.push({ kind: 'text', text: (n as Text).data });
			texts.push(n as Text);
		} else if ((n as Element).tagName === 'BR') {
			nodes.push({ kind: 'break' });
			texts.push(null);
		}
	}
	return { nodes, texts };
}

/** The ranges of the matches in one PDF page's text layer, and which of them is the opened one. */
function rangesInLayer(layer: Element, query: MatchOptions, opened: OpenedLine | null): { ranges: Range[]; active: number } {
	const { nodes, texts } = layerNodesOf(layer);
	const { pieces, nodeOf } = piecesOfLayer(nodes);
	const found = rangesInBlocks(pieces, query);
	const out: Range[] = [];
	const kept: number[] = [];
	found.forEach((r, i) => {
		const node = texts[nodeOf[r.piece] ?? -1];
		if (!node) return;
		const range = new Range();
		range.setStart(node, r.start);
		range.setEnd(node, r.end);
		out.push(range);
		kept.push(i);
	});
	const at = opened ? activeRangeIn(pieces, found, opened.text, opened.index) : -1;
	return { ranges: out, active: at < 0 ? -1 : kept.indexOf(at) };
}

/** The ranges of the matches in a rendered page, found on the text as it is drawn, and which of them is the opened one. */
/**
 * The cell of a table on a reading page that holds the opened match, found when the opened line is a table row. The
 * page has no line numbers and draws sections as they come into view, so the table is chosen by what the row's cells say.
 */
function openedTableCell(root: Element, note: string | undefined, query: MatchOptions, opened: OpenedLine | null): Element | undefined {
	if (!opened || opened.line === undefined || opened.column === undefined || note === undefined) return undefined;
	const source = note.split(/\r?\n/)[opened.line];
	const where = source === undefined ? undefined : cellAtColumn(source, opened.column, query);
	const location = tableAt(note, opened.line);
	if (source === undefined || !where || !location) return undefined;

	const tables = Array.from(root.querySelectorAll('table'));
	const pageTables = tables.map((t) => Array.from(t.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('th, td')).map((c) => c.textContent ?? '')));
	const sourceCells = splitRow(source).map((c) => renderedLine(c.text));
	const index = pickTable(pageTables, location.row, sourceCells);
	return index === undefined ? undefined : tables[index]?.querySelectorAll('tr')[location.row]?.querySelectorAll('th, td')[where.cell];
}

function rangesInPage(root: Element, query: MatchOptions, opened: OpenedLine | null, note?: string): { ranges: Range[]; active: number } {
	const { pieces, nodes } = textPiecesOf(root);
	const found = rangesInBlocks(pieces, query);
	const out: Range[] = [];
	const kept: number[] = [];
	found.forEach((r, i) => {
		const node = nodes[r.piece];
		if (!node) return;
		const range = new Range();
		range.setStart(node, r.start);
		range.setEnd(node, r.end);
		out.push(range);
		kept.push(i);
	});
	const cell = openedTableCell(root, note, query, opened);
	if (cell) {
		// A match belongs to the cell when its range lies inside it; the opened one is the n-th of those.
		const inside = out.filter((r) => cell.contains(r.startContainer));
		return { ranges: out, active: inside[opened?.index ?? 0] ? out.indexOf(inside[opened?.index ?? 0] as Range) : -1 };
	}
	const at = opened ? activeRangeIn(pieces, found, opened.text, opened.index) : -1;
	return { ranges: out, active: at < 0 ? -1 : kept.indexOf(at) };
}


/**
 * Marks the search in the rendered parts of the notes given (the tables in the editor, the whole page in
 * reading view), or clears the marks when there is no search. Obsidian draws a table in its own widget, outside the editor's decorations, so the CSS Custom
 * Highlight API colours the text nodes instead. All sources go into one highlight, because a highlight
 * name can be set only once. Tables that are not drawn right now (scrolled away, not yet built) are skipped.
 */
export function paintPage(sources: PageSource[], query: MatchOptions | null, opened: (OpenedLine & { path: string }) | null = null): void {
	if (!supported()) return;
	if (!query || query.query === '') {
		for (const name of [HIGHLIGHT_NAME, ACTIVE_NAME, PDF_NAME, PDF_ACTIVE_NAME]) CSS.highlights.delete(name);
		clearBox();
		return;
	}

	// The previous box splits a text node. Taking it away first means the page is read, and the ranges are made, from whole text.
	clearBox();
	const page = { ranges: [] as Range[], active: undefined as Range | undefined };
	const pdf = { ranges: [] as Range[], active: undefined as Range | undefined };
	const count = (): number => page.ranges.length + pdf.ranges.length;
	for (const source of sources) {
		if (count() >= MARK_LIMIT) break;
		const mine = opened && opened.path === source.path ? opened : null;
		if (source.kind === 'reading') {
			const found = rangesInPage(source.root, query, mine, source.note);
			if (found.active >= 0 && !page.active) page.active = found.ranges[found.active];
			page.ranges.push(...found.ranges);
			continue;
		}
		if (source.kind === 'pdf') {
			for (const layer of source.layers) {
				if (count() >= MARK_LIMIT) break;
				const layerPage = Number(layer.closest<HTMLElement>('.page')?.dataset.pageNumber);
				const found = rangesInLayer(layer, query, mine && layerMayHoldOpened(mine.page, Number.isInteger(layerPage) ? layerPage : undefined) ? mine : null);
				if (found.active >= 0 && !pdf.active) pdf.active = found.ranges[found.active];
				pdf.ranges.push(...found.ranges);
			}
			continue;
		}
		const { note, root, lineOf } = source;
		const tables = tablesOf(note);
		const noteLines = mine?.line === undefined ? [] : note.split(/\r?\n/);
		// Live Preview draws only the tables near the view, so the n-th widget is not the n-th table of the note.
		// Each widget is matched to its table by the line it starts on; without that, by position, as the best guess.
		const widgets = Array.from(root.querySelectorAll('.cm-table-widget'));
		widgets.forEach((widget, w) => {
			const line = lineOf?.(widget);
			const table = lineOf ? (line === undefined ? undefined : tableStartingAt(tables, line)) : tables[w];
			const rows = widget.querySelectorAll('tr');
			if (!table) return;
			table.rows.forEach((noteLine, j) => {
				const row = rows[j];
				if (!row) return;
				// The opened match is in this row when it is the opened line; its cell is the one its source column falls in.
				const where = mine && mine.line === noteLine && mine.column !== undefined
					? cellAtColumn(noteLines[noteLine] ?? '', mine.column, query)
					: undefined;
				Array.from(row.querySelectorAll('th, td')).forEach((cell, k) => {
					if (count() >= MARK_LIMIT) return;
					const here = rangesInCell(cell, query);
					if (!page.active && where && where.cell === k) page.active = here[where.index];
					page.ranges.push(...here);
				});
			});
		});
	}

	setHighlights(page.ranges, page.active, HIGHLIGHT_NAME, ACTIVE_NAME);
	setHighlights(pdf.ranges, pdf.active, PDF_NAME, PDF_ACTIVE_NAME);
	drawBox(page.ranges.slice(0, MARK_LIMIT), page.active);
}

/**
 * The editor draws a border round the opened match; the highlight API cannot, so in a rendered page that one match
 * is wrapped in a real element. The ranges are checked first: wrapping splits a text node, which would make every
 * other range that points into it stale, so the box goes in last and the highlights are written before it.
 */
function drawBox(ranges: Range[], active: Range | undefined): void {
	if (active && ranges.includes(active)) boxRange(active);
}


/** Writes one pair of highlights: all the matches, and the opened one on top. A name with nothing to mark is removed. */
function setHighlights(ranges: Range[], active: Range | undefined, name: string, activeName: string): void {
	const kept = ranges.slice(0, MARK_LIMIT);
	if (kept.length === 0) CSS.highlights.delete(name);
	else CSS.highlights.set(name, new Highlight(...kept));
	if (active && kept.includes(active)) {
		// Where highlights overlap, the higher priority wins, whichever was registered last.
		const bright = new Highlight(active);
		bright.priority = 1;
		CSS.highlights.set(activeName, bright);
	} else CSS.highlights.delete(activeName);
}

/**
 * Scrolls the first cell of the clicked note line that holds a match into view. Marking is paintPage's job. The widget is
 * the one that starts where the table does (`lineOf`): Live Preview draws only the tables near the view, so the n-th
 * widget is not the n-th table. Without `lineOf` the widgets are taken in order, as the best guess.
 */
export function scrollToTableHit(root: Element, note: string, line: number, query: MatchOptions, lineOf?: (widget: Element) => number | undefined): void {
	const where = tableAt(note, line);
	if (!where) return;
	const widgets = Array.from(root.querySelectorAll('.cm-table-widget'));
	const widget = lineOf
		? widgets.find((w) => lineOf(w) === where.start)
		: widgets[tablesOf(note).findIndex((t) => t.start === where.start)];
	const row = widget?.querySelectorAll('tr')[where.row];
	const cell = Array.from(row?.querySelectorAll('th, td') ?? []).find((c) => rangesInCell(c, query).length > 0);
	cell?.scrollIntoView({ block: 'center', inline: 'nearest' });
}

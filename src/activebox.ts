/**
 * The CSS Custom Highlight API cannot draw a border, so the one match the user opened is wrapped in a real element
 * that can. Only one element exists at a time: `clear` puts the text back as it was, so the page is left whole.
 */
const CLASS = 'rs-active-box';

let wrapped: HTMLElement | null = null;

/** Puts the box around a range that lies inside one text node. A range across several nodes is left to the highlight alone. */
export function boxRange(range: Range): void {
	clearBox();
	const node = range.startContainer;
	if (node !== range.endContainer || node.nodeType !== Node.TEXT_NODE || range.collapsed) return;
	const span = node.ownerDocument?.createElement('span');
	if (!span) return;
	span.className = CLASS;
	range.surroundContents(span);
	wrapped = span;
}

/** Removes the box and joins the text back into one node, so a later search finds the page as Obsidian drew it. */
export function clearBox(): void {
	const span = wrapped;
	wrapped = null;
	const parent = span?.parentNode;
	if (!span || !parent) return;
	while (span.firstChild) parent.insertBefore(span.firstChild, span);
	parent.removeChild(span);
	parent.normalize();
}

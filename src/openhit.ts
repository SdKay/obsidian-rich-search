import type { ExtensionProvider } from './providers';
import type { MatchOptions, SearchHit, Span } from './types';

export interface OpenPlan {
	/** A note Obsidian shows itself, or a file shown by the plugin that owns its format. */
	kind: 'note' | 'provided';
	/** Handed to `leaf.openFile` as the ephemeral state. */
	eState: Record<string, unknown>;
	/** Set when the file opens but the match cannot be shown: the view that got it does not understand the state. */
	note?: 'cannotJump';
}

const isNote = (path: string): boolean => path.toLowerCase().endsWith('.md');

/**
 * Decides how a clicked hit is opened. A note goes to Obsidian's own editor at the hit line; any other
 * file goes to the view of the plugin that renders it, with the anchor it gave us, unread by us
 * (contract section 5). `provider` is that plugin's entry for the file's extension, if any.
 */
export function planOpen(hit: SearchHit, query: MatchOptions, provider: ExtensionProvider | undefined): OpenPlan {
	if (isNote(hit.path)) {
		return { kind: 'note', eState: { line: hit.line, richSearchSpans: hit.spans.map((s) => ({ ...s })) } };
	}

	const viewOwned = provider !== undefined && provider.status === 'available' && provider.viewRegistered;
	if (!viewOwned) return { kind: 'provided', eState: {}, note: 'cannotJump' };

	return {
		kind: 'provided',
		eState: { richSearch: { ...(hit.anchor === undefined ? {} : { anchor: hit.anchor }), query: { ...query } } },
	};
}

export interface Range {
	from: number;
	to: number;
}

/**
 * Document ranges to mark for a line that starts at `lineStart`. Sorted, because the editor requires
 * decorations in order; empty and reversed spans are dropped; nothing runs past `docLength`.
 */
export function highlightRanges(lineStart: number, spans: Span[], docLength = Infinity): Range[] {
	return spans
		.map((s) => ({ from: lineStart + s.start, to: Math.min(lineStart + s.end, docLength) }))
		.filter((r) => r.to > r.from && r.from < docLength)
		.sort((a, b) => a.from - b.from);
}

import { isPdfAnchor } from './pdftext';
import type { ExtensionProvider } from './providers';
import type { MatchOptions, SearchHit } from './types';

export interface OpenPlan {
	/** A note Obsidian shows itself, or a file shown by the plugin that owns its format. */
	kind: 'note' | 'block' | 'pdf' | 'provided';
	/** Handed to `leaf.openFile` as the ephemeral state. */
	eState: Record<string, unknown>;
	/** Set when the file opens but the match cannot be shown: the view that got it does not understand the state. */
	note?: 'cannotJump';
}

const isNote = (path: string): boolean => path.toLowerCase().endsWith('.md');
const isPdf = (path: string): boolean => path.toLowerCase().endsWith('.pdf');

/**
 * Decides how a clicked hit is opened. A note goes to Obsidian's own editor at the hit line; any other
 * file goes to the view of the plugin that renders it, with the anchor it gave us, unread by us
 * (contract section 5). `provider` is that plugin's entry for the file's extension, if any.
 */
export function planOpen(hit: SearchHit, query: MatchOptions, provider: ExtensionProvider | undefined): OpenPlan {
	// A cursor inside a fence makes Live Preview show the block as source, so a block is scrolled to, not entered.
	if (isNote(hit.path) && hit.block) return { kind: 'block', eState: { scroll: hit.block.fromLine } };
	if (isNote(hit.path)) {
		// No `line` here: Obsidian would scroll the line to the top of reading view first, and the page is then seen to jump. The line is shown once the mode is known.
		return { kind: 'note', eState: {} };
	}

	// Obsidian's own viewer takes a page as a link subpath; the file opens at the top if the anchor is not a page.
	if (isPdf(hit.path)) return { kind: 'pdf', eState: isPdfAnchor(hit.anchor) ? { subpath: `#page=${hit.anchor.page}` } : {} };

	const viewOwned = provider !== undefined && provider.status === 'available' && provider.viewRegistered;
	if (!viewOwned) return { kind: 'provided', eState: {}, note: 'cannotJump' };

	return {
		kind: 'provided',
		eState: { richSearch: { ...(hit.anchor === undefined ? {} : { anchor: hit.anchor }), query: { ...query } } },
	};
}

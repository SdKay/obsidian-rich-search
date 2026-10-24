import type { SearchHit } from './types';

export interface FileGroup {
	path: string;
	name: string;
	/** Folder part of `path`, '' for a file at the root. */
	dir: string;
	hits: SearchHit[];
}

/**
 * How many hits are put on the page. A search for "a" in a large vault finds tens of thousands, and
 * drawing them all (about 250,000 DOM nodes in the author's vault) made Obsidian unresponsive and then
 * quit. The search still collects every hit so the totals are true; only the drawing is capped.
 */
export const DRAW_LIMIT = 2000;
/** How many more "Show more" draws. */
export const DRAW_STEP = 2000;

/** Result hits, all collected, the first `drawn` of them grouped by file for the page. */
export interface GroupState {
	/** Groups of the hits that are drawn. */
	groups: FileGroup[];
	/** Every hit found, in arrival order. A hit's position here is its number, which a row carries. */
	all: SearchHit[];
	count: number;
	/** How many of `all`, from the start, are on the page. */
	drawn: number;
	/** Files with at least one hit, drawn or not. */
	fileCount: number;
	byPath: Map<string, FileGroup>;
	/** Every file that has a hit, drawn or not, to count files once. */
	filesSeen: Set<string>;
}

export function emptyGroups(): GroupState {
	return { groups: [], all: [], count: 0, drawn: 0, fileCount: 0, byPath: new Map(), filesSeen: new Set() };
}

export interface AppendDiff {
	added: FileGroup[];
	grown: { path: string; newHits: SearchHit[]; total: number }[];
	/** The hits to draw now, in order. */
	draw: SearchHit[];
	/** Hits found but not drawn. */
	withheld: number;
	/** The number of each new hit, in the order given. */
	numbers: number[];
	/** The same numbers keyed by hit, for drawing a group whose hits are not consecutive. */
	numberOf: Map<SearchHit, number>;
}

/** Puts `hits` (already in `state.all`, numbers from `first`) into the groups and reports what changed. */
function place(state: GroupState, hits: SearchHit[], first: number): Pick<AppendDiff, 'added' | 'grown' | 'draw' | 'numberOf' | 'numbers'> {
	const added: FileGroup[] = [];
	const grownByPath = new Map<string, { path: string; newHits: SearchHit[]; total: number }>();
	const numberOf = new Map<SearchHit, number>();
	const numbers: number[] = [];

	hits.forEach((hit, i) => {
		let group = state.byPath.get(hit.path);
		if (!group) {
			const slash = hit.path.lastIndexOf('/');
			group = { path: hit.path, name: hit.path.slice(slash + 1), dir: slash >= 0 ? hit.path.slice(0, slash) : '', hits: [] };
			state.byPath.set(hit.path, group);
			state.groups.push(group);
			added.push(group);
		} else if (!added.includes(group)) {
			let entry = grownByPath.get(hit.path);
			if (!entry) { entry = { path: hit.path, newHits: [], total: 0 }; grownByPath.set(hit.path, entry); }
			entry.newHits.push(hit);
		}
		group.hits.push(hit);
		numberOf.set(hit, first + i);
		numbers.push(first + i);
		const entry = grownByPath.get(hit.path);
		if (entry) entry.total = group.hits.length;
	});

	return { added, grown: [...grownByPath.values()], draw: hits, numberOf, numbers };
}

/**
 * Adds a batch of hits. All of them are kept; only as many as fit under DRAW_LIMIT are grouped for the
 * page. The work follows the size of the batch, not of what is already there: regrouping everything on
 * each batch took 1.7 s over 40,000 hits (measured).
 */
export function appendHits(state: GroupState, batch: SearchHit[]): AppendDiff {
	const first = state.count;
	for (const hit of batch) {
		state.all.push(hit);
		state.filesSeen.add(hit.path);
	}
	state.count = state.all.length;
	state.fileCount = state.filesSeen.size;

	// The drawn hits are always the first ones, so what fits is a prefix of this batch.
	const room = Math.max(0, DRAW_LIMIT - state.drawn);
	const fit = Math.min(room, batch.length);
	const placed = place(state, batch.slice(0, fit), first);
	state.drawn += fit;

	// Numbers and lookup cover the whole batch, so a withheld hit can still be found by its number later.
	const numbers = batch.map((_, i) => first + i);
	const numberOf = new Map(batch.map((h, i) => [h, first + i] as [SearchHit, number]));
	return { ...placed, numbers, numberOf, withheld: state.count - state.drawn };
}

/** Draws the next DRAW_STEP withheld hits. */
export function showMore(state: GroupState): AppendDiff {
	const first = state.drawn;
	const next = state.all.slice(first, first + DRAW_STEP);
	const placed = place(state, next, first);
	state.drawn += next.length;
	return { ...placed, withheld: state.count - state.drawn };
}

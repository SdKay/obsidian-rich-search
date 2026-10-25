import type { MatchOptions } from './types';

type Listener = (query: MatchOptions | null) => void;

/** The match the user opened from the results: which file, which line (0-based), and which match on that line (0-based). */
export interface OpenedHit {
	path: string;
	line: number;
	index: number;
	/** Set for a match in a file a plugin shows (a workbook, a diagram): the provider's own anchor for the line. */
	anchor?: unknown;
	/** Set when the match is inside a block a plugin draws: the block's opening fence, and the provider's own anchor for the line. */
	block?: { fromLine: number; anchor: unknown };
}

type HitListener = (hit: OpenedHit | null) => void;

// An anchor is JSON-serialisable by contract, which is also what makes a copy and a comparison safe.
const anchorKey = (hit: OpenedHit): string => JSON.stringify([hit.anchor ?? null, hit.block ? [hit.block.fromLine, hit.block.anchor ?? null] : null]);
const clone = (value: unknown): unknown => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as unknown);
const copyOf = (hit: OpenedHit): OpenedHit => ({
	path: hit.path, line: hit.line, index: hit.index,
	...(hit.anchor === undefined ? {} : { anchor: clone(hit.anchor) }),
	...(hit.block ? { block: { fromLine: hit.block.fromLine, anchor: clone(hit.block.anchor) } } : {}),
});

export const sameHit = (a: OpenedHit | null, b: OpenedHit | null): boolean =>
	a === b || (a !== null && b !== null && a.path === b.path && a.line === b.line && a.index === b.index && anchorKey(a) === anchorKey(b));

/** Whether two searches would find the same thing. An option left out counts as off. */
export const sameQuery = (a: MatchOptions | null, b: MatchOptions | null): boolean =>
	a === b || (a !== null && b !== null
		&& a.query === b.query
		&& Boolean(a.caseSensitive) === Boolean(b.caseSensitive)
		&& Boolean(a.wholeWord) === Boolean(b.wholeWord)
		&& Boolean(a.regex) === Boolean(b.regex));

/**
 * The search that is on screen, shared with the views of other plugins through the host API. There is
 * one copy of it, here; a view only reads it, so two plugins cannot disagree about what is being searched.
 */
export class QueryState {
	private value: MatchOptions | null = null;
	private listeners = new Set<Listener>();
	private hit: OpenedHit | null = null;
	private hitListeners = new Set<HitListener>();

	current(): MatchOptions | null {
		return this.value ? { ...this.value } : null;
	}

	currentHit(): OpenedHit | null {
		return this.hit ? copyOf(this.hit) : null;
	}

	/** The match that is opened now. Ignored while there is no query: there is no search for it to belong to. */
	setHit(hit: OpenedHit | null): void {
		if (this.value === null) return;
		this.changeHit(hit ? copyOf(hit) : null);
	}

	/** Returns a function that stops the calls. */
	onHitChange(listener: HitListener): () => void {
		this.hitListeners.add(listener);
		return () => { this.hitListeners.delete(listener); };
	}

	/** An empty query means there is nothing to mark, the same as no query. */
	set(query: MatchOptions): void {
		this.change(query.query === '' ? null : { ...query });
	}

	clear(): void {
		this.change(null);
	}

	/** Returns a function that stops the calls. */
	onChange(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}

	private change(next: MatchOptions | null): void {
		if (sameQuery(this.value, next)) return;
		this.value = next;
		// An opened match belongs to the search that found it.
		this.changeHit(null);
		// A copy of the set: a listener added while this runs waits for the next change.
		for (const listener of [...this.listeners]) {
			try {
				listener(next ? { ...next } : null);
			} catch (err) {
				console.error('Rich Search: a query listener failed', err);
			}
		}
	}

	private changeHit(next: OpenedHit | null): void {
		if (sameHit(this.hit, next)) return;
		this.hit = next;
		for (const listener of [...this.hitListeners]) {
			try {
				listener(next ? copyOf(next) : null);
			} catch (err) {
				console.error('Rich Search: a hit listener failed', err);
			}
		}
	}
}

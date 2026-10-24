/** The slice of a DOM element this needs; a real `Element` satisfies it. */
export interface ClosestLike {
	closest(selector: string): ClosestLike | null;
	getAttribute(name: string): string | null;
}

/**
 * Which hit row a click landed on. One listener on the whole results list uses this, instead of
 * one listener per row: a common search term has thousands of rows, and each listener would be
 * kept alive until the view closes.
 */
export function hitIndexFrom(target: ClosestLike | null): number | undefined {
	const row = target?.closest('[data-hit]');
	const raw = row?.getAttribute('data-hit') ?? null;
	return raw !== null && /^\d+$/.test(raw) ? Number(raw) : undefined;
}

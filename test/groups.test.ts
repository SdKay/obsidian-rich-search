import { describe, it, expect } from 'vitest';
import { appendHits, emptyGroups, showMore, DRAW_LIMIT, DRAW_STEP, type FileGroup } from '../src/groups';
import type { SearchHit } from '../src/types';

/** The obvious way to group, written for clarity: the incremental code must agree with it. */
function referenceGroups(hits: SearchHit[]): FileGroup[] {
	const order: string[] = [];
	const byPath = new Map<string, SearchHit[]>();
	for (const h of hits) {
		if (!byPath.has(h.path)) { order.push(h.path); byPath.set(h.path, []); }
		byPath.get(h.path)!.push(h);
	}
	return order.map((path) => {
		const slash = path.lastIndexOf('/');
		return { path, name: path.slice(slash + 1), dir: slash >= 0 ? path.slice(0, slash) : '', hits: byPath.get(path)! };
	});
}

const hit = (path: string, line: number): SearchHit => ({ path, line, text: 'x', spans: [{ start: 0, end: 1 }] });

describe('appendHits', () => {
	it('starts from nothing and adds the first hits as new groups', () => {
		const state = emptyGroups();
		const diff = appendHits(state, [hit('a.md', 1), hit('b.md', 2)]);
		expect(diff.added.map((g) => g.path)).toEqual(['a.md', 'b.md']);
		expect(diff.grown).toEqual([]);
		expect(state.groups.map((g) => g.path)).toEqual(['a.md', 'b.md']);
		expect(state.count).toBe(2);
	});

	it('adds a hit for a file already shown to that group and reports only the new hit', () => {
		const state = emptyGroups();
		appendHits(state, [hit('a.md', 1)]);
		const diff = appendHits(state, [hit('a.md', 5)]);
		expect(diff.added).toEqual([]);
		expect(diff.grown).toEqual([{ path: 'a.md', newHits: [hit('a.md', 5)], total: 2 }]);
		expect(state.groups[0]?.hits.map((h) => h.line)).toEqual([1, 5]);
	});

	it('adds new files after the existing ones, in the order they arrive', () => {
		const state = emptyGroups();
		appendHits(state, [hit('b.md', 1)]);
		appendHits(state, [hit('a.md', 1)]);
		expect(state.groups.map((g) => g.path)).toEqual(['b.md', 'a.md']);
	});

	it('does nothing for an empty batch', () => {
		const state = emptyGroups();
		appendHits(state, [hit('a.md', 1)]);
		const diff = appendHits(state, []);
		expect(diff.added).toEqual([]);
		expect(diff.grown).toEqual([]);
		expect(diff.numbers).toEqual([]);
		expect(diff.numberOf.size).toBe(0);
		expect(state.count).toBe(1);
	});

	it('numbers hits in arrival order across batches, so a row can be found again by its number', () => {
		const state = emptyGroups();
		appendHits(state, [hit('a.md', 1), hit('b.md', 1)]);
		appendHits(state, [hit('c.md', 1)]);
		expect(state.all.map((h) => h.path)).toEqual(['a.md', 'b.md', 'c.md']);
		expect(state.count).toBe(3);
	});

	it('reports each new hit with its number', () => {
		const state = emptyGroups();
		appendHits(state, [hit('a.md', 1)]);
		const diff = appendHits(state, [hit('a.md', 2), hit('b.md', 1)]);
		expect(diff.numbers).toEqual([1, 2]);
	});

	it('gives the same groups as grouping all the hits at once', () => {
		const all = [hit('a.md', 1), hit('b.md', 1), hit('a.md', 2), hit('c.md', 3), hit('b.md', 4)];
		const state = emptyGroups();
		appendHits(state, all.slice(0, 2));
		appendHits(state, all.slice(2, 4));
		appendHits(state, all.slice(4));
		expect(state.groups).toEqual(referenceGroups(all));
	});

	it('does not look at hits or files it has already seen: the work follows the batch, not the total', () => {
		const state = emptyGroups();
		appendHits(state, Array.from({ length: 5000 }, (_, i) => hit(`f${i}.md`, 0)));

		// Count every element the call reads from the state it keeps, which is where a rescan would show.
		let touched = 0;
		const watch = <T extends object>(target: T): T => new Proxy(target, {
			get(t, k, r) {
				if (typeof k === 'string' && /^\d+$/.test(k)) touched++;
				if (k === Symbol.iterator || k === 'find' || k === 'map' || k === 'filter' || k === 'some' || k === 'every' || k === 'includes' || k === 'indexOf') touched += 1000;
				return Reflect.get(t, k, r);
			},
		});
		const watched = { ...state, groups: watch(state.groups), all: watch(state.all) };
		appendHits(watched, [hit('new.md', 0), hit('f7.md', 1)]);
		expect(touched).toBeLessThan(50);
	});

	it('a file with several hits in one new batch is added once, with all of its hits', () => {
		const state = emptyGroups();
		const diff = appendHits(state, [hit('a.md', 1), hit('a.md', 2), hit('a.md', 3)]);
		expect(diff.added).toHaveLength(1);
		expect(diff.added[0]?.hits).toHaveLength(3);
		expect(diff.grown).toEqual([]);
		expect(diff.numbers).toEqual([0, 1, 2]);
	});

	it('does not report a new file as both added and grown, even with a hit already shown for another file', () => {
		const state = emptyGroups();
		appendHits(state, [hit('x.md', 1)]);
		const diff = appendHits(state, [hit('a.md', 1), hit('a.md', 2), hit('x.md', 2)]);
		expect(diff.added.map((g) => g.path)).toEqual(['a.md']);
		expect(diff.grown.map((g) => g.path)).toEqual(['x.md']);
	});

	it('keeps a large batch linear: many hits in many new files in one batch', () => {
		const state = emptyGroups();
		const batch: SearchHit[] = [];
		for (let f = 0; f < 400; f++) for (let l = 0; l < 25; l++) batch.push(hit(`f${f}.md`, l));
		const a = performance.now();
		appendHits(state, batch);
		const ms = performance.now() - a;
		expect(state.count).toBe(10000);
		expect(state.fileCount).toBe(400);
		expect(state.drawn).toBe(DRAW_LIMIT);
		expect(state.groups).toHaveLength(DRAW_LIMIT / 25);
		// 10,000 hits in 400 files; a linear pass takes a few milliseconds, a quadratic one hundreds.
		expect(ms).toBeLessThan(150);
	});

	it('looks up the number of any hit it just added, including ones of a new file that arrive between others', () => {
		const state = emptyGroups();
		const diff = appendHits(state, [hit('a.md', 1), hit('b.md', 1), hit('a.md', 2)]);
		const a = diff.added.find((g) => g.path === 'a.md')!;
		const b = diff.added.find((g) => g.path === 'b.md')!;
		expect(a.hits.map((h) => diff.numberOf.get(h))).toEqual([0, 2]);
		expect(b.hits.map((h) => diff.numberOf.get(h))).toEqual([1]);
	});

	it('numbers hits of a file that grew in a later batch from where the previous batch ended', () => {
		const state = emptyGroups();
		appendHits(state, [hit('a.md', 1), hit('b.md', 1)]);
		const diff = appendHits(state, [hit('a.md', 2)]);
		const grown = diff.grown[0]!;
		expect(grown.newHits.map((h) => diff.numberOf.get(h))).toEqual([2]);
		expect(state.all[2]).toBe(grown.newHits[0]);
	});
});

describe('drawing limit', () => {
	const many = (n: number, file = 'a.md'): SearchHit[] => Array.from({ length: n }, (_, i) => hit(file, i));

	it('draws at most DRAW_LIMIT hits from the first batch and keeps the rest to be shown later', () => {
		const state = emptyGroups();
		const diff = appendHits(state, many(DRAW_LIMIT + 500));
		expect(state.count).toBe(DRAW_LIMIT + 500);
		expect(state.drawn).toBe(DRAW_LIMIT);
		expect(diff.draw.length).toBe(DRAW_LIMIT);
		expect(diff.withheld).toBe(500);
	});

	it('draws everything while the total stays under the limit', () => {
		const state = emptyGroups();
		const diff = appendHits(state, many(10));
		expect(state.drawn).toBe(10);
		expect(diff.withheld).toBe(0);
		expect(diff.draw).toHaveLength(10);
	});

	it('draws nothing more once the limit is reached, but keeps counting', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT));
		const diff = appendHits(state, many(300, 'b.md'));
		expect(diff.draw).toEqual([]);
		expect(diff.added).toEqual([]);
		expect(state.count).toBe(DRAW_LIMIT + 300);
		expect(state.drawn).toBe(DRAW_LIMIT);
		expect(diff.withheld).toBe(300);
	});

	it('does not create a group for a file whose hits are all withheld, but still counts the file', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT));
		appendHits(state, many(5, 'later.md'));
		expect(state.groups.map((g) => g.path)).toEqual(['a.md']);
		expect(state.fileCount).toBe(2);
	});

	it('draws only the part of a batch that fits under the limit', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT - 2));
		const diff = appendHits(state, many(10, 'b.md'));
		expect(diff.draw.map((h) => h.line)).toEqual([0, 1]);
		expect(state.drawn).toBe(DRAW_LIMIT);
		expect(diff.withheld).toBe(8);
	});

	it('shows a further step of withheld hits on request, in arrival order', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT + DRAW_STEP + 100));
		const more = showMore(state);
		expect(more.draw).toHaveLength(DRAW_STEP);
		expect(more.draw[0]?.line).toBe(DRAW_LIMIT);
		expect(state.drawn).toBe(DRAW_LIMIT + DRAW_STEP);
		expect(more.withheld).toBe(100);
	});

	it('shows what is left when fewer than a step remains, then nothing', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT + 7));
		expect(showMore(state).draw).toHaveLength(7);
		expect(showMore(state).draw).toEqual([]);
		expect(state.drawn).toBe(DRAW_LIMIT + 7);
	});

	it('gives the hits shown later their place in the groups, and their number', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT + 3));
		const more = showMore(state);
		expect(more.draw.map((h) => more.numberOf.get(h))).toEqual([DRAW_LIMIT, DRAW_LIMIT + 1, DRAW_LIMIT + 2]);
		expect(state.groups[0]?.hits).toHaveLength(DRAW_LIMIT + 3);
	});

	it('reports a group created by showing more as added, and one that grew as grown', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT));
		appendHits(state, [...many(2, 'a.md').map((h, i) => ({ ...h, line: 9000 + i })), ...many(2, 'z.md')]);
		const more = showMore(state);
		expect(more.added.map((g) => g.path)).toEqual(['z.md']);
		expect(more.grown.map((g) => [g.path, g.newHits.length])).toEqual([['a.md', 2]]);
	});

	it('numbers withheld hits too, from where the previous batch ended', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT - 1));
		const batch = many(5, 'b.md');
		const diff = appendHits(state, batch);
		expect(diff.numbers).toEqual([DRAW_LIMIT - 1, DRAW_LIMIT, DRAW_LIMIT + 1, DRAW_LIMIT + 2, DRAW_LIMIT + 3]);
		expect(batch.map((h) => diff.numberOf.get(h))).toEqual(diff.numbers);
		expect(state.all[DRAW_LIMIT + 3]).toBe(batch[4]);
	});

	it('keeps every hit reachable by its number even when it was not drawn', () => {
		const state = emptyGroups();
		appendHits(state, many(DRAW_LIMIT + 5));
		expect(state.all).toHaveLength(DRAW_LIMIT + 5);
	});

	it('uses a limit small enough for the page and a step that is a fraction of it', () => {
		expect(DRAW_LIMIT).toBeLessThanOrEqual(2000);
		expect(DRAW_STEP).toBeLessThanOrEqual(DRAW_LIMIT);
		expect(DRAW_STEP).toBeGreaterThan(0);
	});
});

import { describe, it, expect } from 'vitest';
import { QueryState, sameHit, sameQuery } from '../src/querystate';

const q = (query: string, extra: Record<string, boolean> = {}) => ({ query, ...extra });

describe('QueryState', () => {
	it('starts with no query', () => {
		expect(new QueryState().current()).toBeNull();
	});

	it('returns the query that was set, as a copy the caller cannot change it through', () => {
		const state = new QueryState();
		const input = q('cat', { regex: true });
		state.set(input);
		input.query = 'changed';
		const out = state.current()!;
		expect(out).toEqual({ query: 'cat', regex: true });
		out.query = 'also changed';
		expect(state.current()?.query).toBe('cat');
	});

	it('treats an empty query as no query', () => {
		const state = new QueryState();
		state.set(q('cat'));
		state.set(q(''));
		expect(state.current()).toBeNull();
	});

	it('clears on request, as when the panel closes', () => {
		const state = new QueryState();
		state.set(q('cat'));
		state.clear();
		expect(state.current()).toBeNull();
	});

	it('tells listeners about a new query, with a copy', () => {
		const state = new QueryState();
		const seen: unknown[] = [];
		state.onChange((v) => seen.push(v));
		state.set(q('cat'));
		expect(seen).toEqual([{ query: 'cat' }]);
	});

	it('tells listeners when the query goes away', () => {
		const state = new QueryState();
		state.set(q('cat'));
		const seen: unknown[] = [];
		state.onChange((v) => seen.push(v));
		state.clear();
		expect(seen).toEqual([null]);
	});

	it('does not tell listeners when nothing changed', () => {
		const state = new QueryState();
		state.set(q('cat'));
		let calls = 0;
		state.onChange(() => calls++);
		state.set(q('cat'));
		state.clear();
		state.clear();
		expect(calls).toBe(1);
	});

	it('does tell listeners when only an option changed', () => {
		const state = new QueryState();
		state.set(q('cat'));
		let calls = 0;
		state.onChange(() => calls++);
		state.set(q('cat', { wholeWord: true }));
		state.set(q('cat', { wholeWord: true, caseSensitive: true }));
		expect(calls).toBe(2);
	});

	it('tells listeners when only the regular expression option is switched', () => {
		const state = new QueryState();
		state.set(q('cat'));
		let calls = 0;
		state.onChange(() => calls++);
		state.set(q('cat', { regex: true }));
		state.set(q('cat', { regex: false }));
		expect(calls).toBe(2);
	});

	it('gives a listener its own copy, so changing it does not change the stored query', () => {
		const state = new QueryState();
		state.onChange((v) => { if (v) v.query = 'tampered'; });
		state.set(q('cat'));
		expect(state.current()?.query).toBe('cat');
	});

	it('does not tell listeners when an option is spelled out as false instead of left out', () => {
		const state = new QueryState();
		state.set(q('cat'));
		let calls = 0;
		state.onChange(() => calls++);
		state.set(q('cat', { caseSensitive: false, wholeWord: false, regex: false }));
		expect(calls).toBe(0);
	});

	it('does not tell a listener that was removed', () => {
		const state = new QueryState();
		let calls = 0;
		const off = state.onChange(() => calls++);
		state.set(q('a'));
		off();
		state.set(q('b'));
		expect(calls).toBe(1);
	});

	it('removing one listener leaves the others', () => {
		const state = new QueryState();
		const log: string[] = [];
		const offA = state.onChange(() => log.push('a'));
		state.onChange(() => log.push('b'));
		offA();
		state.set(q('x'));
		expect(log).toEqual(['b']);
	});

	it('calling the remover twice is harmless', () => {
		const state = new QueryState();
		const off = state.onChange(() => {});
		off();
		expect(() => off()).not.toThrow();
	});

	it('keeps telling the other listeners when one throws', () => {
		const state = new QueryState();
		const log: string[] = [];
		state.onChange(() => { throw new Error('boom'); });
		state.onChange(() => log.push('second'));
		expect(() => state.set(q('x'))).not.toThrow();
		expect(log).toEqual(['second']);
	});

	it('does not tell a listener that is added while it is telling the others', () => {
		const state = new QueryState();
		const log: string[] = [];
		state.onChange(() => { state.onChange(() => log.push('late')); });
		state.set(q('x'));
		expect(log).toEqual([]);
	});
});

describe('sameQuery', () => {
	it('is true for two nulls and for equal queries', () => {
		expect(sameQuery(null, null)).toBe(true);
		expect(sameQuery({ query: 'a' }, { query: 'a' })).toBe(true);
	});

	it('is false for a query and null, in either order', () => {
		expect(sameQuery({ query: 'a' }, null)).toBe(false);
		expect(sameQuery(null, { query: 'a' })).toBe(false);
	});

	it('is false when the text or any option differs', () => {
		expect(sameQuery({ query: 'a' }, { query: 'b' })).toBe(false);
		expect(sameQuery({ query: 'a' }, { query: 'a', caseSensitive: true })).toBe(false);
		expect(sameQuery({ query: 'a' }, { query: 'a', wholeWord: true })).toBe(false);
		expect(sameQuery({ query: 'a' }, { query: 'a', regex: true })).toBe(false);
	});

	it('counts an option left out as false', () => {
		expect(sameQuery({ query: 'a' }, { query: 'a', regex: false, wholeWord: false, caseSensitive: false })).toBe(true);
	});

	it('is true for the very same object', () => {
		const q = { query: 'a' };
		expect(sameQuery(q, q)).toBe(true);
	});
});

describe('QueryState: the hit that was opened', () => {
	const hit = (path: string, line: number, index = 0) => ({ path, line, index });

	it('starts with no hit, and keeps the one that was set as a copy', () => {
		const state = new QueryState();
		expect(state.currentHit()).toBeNull();
		const input = hit('a.md', 3, 1);
		state.set(q('cat'));
		state.setHit(input);
		input.line = 99;
		expect(state.currentHit()).toEqual({ path: 'a.md', line: 3, index: 1 });
	});

	it('tells listeners when the hit changes, and not when it is set to the same one', () => {
		const state = new QueryState();
		state.set(q('cat'));
		const seen: unknown[] = [];
		state.onHitChange((h) => seen.push(h));
		state.setHit(hit('a.md', 1));
		state.setHit(hit('a.md', 1));
		state.setHit(hit('a.md', 2));
		expect(seen).toEqual([hit('a.md', 1), hit('a.md', 2)]);
	});

	it('forgets the hit when the query is emptied, since there is nothing left to be current in', () => {
		const state = new QueryState();
		state.set(q('cat'));
		state.setHit(hit('a.md', 1));
		state.clear();
		expect(state.currentHit()).toBeNull();
	});

	it('forgets the hit when the query changes to another search', () => {
		const state = new QueryState();
		state.set(q('cat'));
		state.setHit(hit('a.md', 1));
		state.set(q('dog'));
		expect(state.currentHit()).toBeNull();
	});

	it('keeps the hit when the same search is set again', () => {
		const state = new QueryState();
		state.set(q('cat'));
		state.setHit(hit('a.md', 1));
		state.set(q('cat'));
		expect(state.currentHit()).toEqual(hit('a.md', 1));
	});

	it('does not take a hit while there is no query', () => {
		const state = new QueryState();
		state.setHit(hit('a.md', 1));
		expect(state.currentHit()).toBeNull();
	});

	it('stops calling a listener that was removed, and survives one that throws', () => {
		const state = new QueryState();
		state.set(q('cat'));
		const seen: number[] = [];
		const stop = state.onHitChange(() => seen.push(1));
		state.onHitChange(() => { throw new Error('boom'); });
		state.onHitChange(() => seen.push(2));
		state.setHit(hit('a.md', 1));
		stop();
		state.setHit(hit('a.md', 2));
		expect(seen).toEqual([1, 2, 2]);
	});

	it('compares hits by file, line and which match on the line', () => {
		expect(sameHit(hit('a.md', 1, 0), hit('a.md', 1, 0))).toBe(true);
		expect(sameHit(hit('a.md', 1, 0), hit('a.md', 1, 1))).toBe(false);
		expect(sameHit(hit('a.md', 1), hit('b.md', 1))).toBe(false);
		expect(sameHit(null, null)).toBe(true);
		expect(sameHit(null, hit('a.md', 1))).toBe(false);
	});
});

describe('QueryState: a hit inside a block a plugin draws', () => {
	const inBlock = (anchor: unknown) => ({ path: 'a.md', line: 7, index: 0, block: { fromLine: 7, anchor } });

	it('carries the block and the anchor of the hit, as copies', () => {
		const state = new QueryState();
		state.set(q('cat'));
		const anchor = { sheet: 'S1', row: 2 };
		state.setHit(inBlock(anchor));
		anchor.row = 99;
		expect(state.currentHit()).toEqual(inBlock({ sheet: 'S1', row: 2 }));
	});

	it('is another hit when only the anchor differs, so the bright cell can move inside one block', () => {
		const state = new QueryState();
		state.set(q('cat'));
		const seen: unknown[] = [];
		state.onHitChange((h) => seen.push(h));
		state.setHit(inBlock({ row: 1 }));
		state.setHit(inBlock({ row: 1 }));
		state.setHit(inBlock({ row: 2 }));
		expect(seen).toHaveLength(2);
	});

	it('tells a hit in a block from a hit on the same line outside any block', () => {
		expect(sameHit(inBlock({ row: 1 }), { path: 'a.md', line: 7, index: 0 })).toBe(false);
	});
});

describe('QueryState: a hit in a file a plugin shows', () => {
	it('carries the anchor of the hit, so the plugin\'s view can tell which mark is the opened one', () => {
		const state = new QueryState();
		state.set(q('cat'));
		state.setHit({ path: 'b.xlsx', line: 3, index: 0, anchor: { sheet: 'S1', row: 4 } });
		expect(state.currentHit()).toEqual({ path: 'b.xlsx', line: 3, index: 0, anchor: { sheet: 'S1', row: 4 } });
	});

	it('is another hit when only the anchor differs', () => {
		expect(sameHit({ path: 'b.xlsx', line: 0, index: 0, anchor: { row: 1 } }, { path: 'b.xlsx', line: 0, index: 0, anchor: { row: 2 } })).toBe(false);
	});
});

describe('sameHit: two blocks of one note', () => {
	it('tells a hit in one block from a hit with the same anchor in another block', () => {
		const a = { path: 'a.md', line: 3, index: 0, block: { fromLine: 3, anchor: { row: 2 } } };
		const b = { path: 'a.md', line: 3, index: 0, block: { fromLine: 9, anchor: { row: 2 } } };
		expect(sameHit(a, b)).toBe(false);
	});
});

describe('QueryState: scope', () => {
	it('covers every path until a scope is given', () => {
		expect(new QueryState().covers('a/b.drawio')).toBe(true);
	});

	it('says whether the search covers a path, by the rule it was given', () => {
		const state = new QueryState();
		state.setScope((path) => path.startsWith('notes/'));
		expect(state.covers('notes/a.md')).toBe(true);
		expect(state.covers('other/b.drawio')).toBe(false);
	});

	it('tells listeners when the scope changes, and not before there is one', () => {
		const state = new QueryState();
		let calls = 0;
		state.onScopeChange(() => { calls++; });
		state.setScope(() => true);
		expect(calls).toBe(1);
		state.setScope(() => false);
		expect(calls).toBe(2);
	});

	it('stops calling a listener that was removed, and survives one that throws', () => {
		const state = new QueryState();
		let calls = 0;
		const stop = state.onScopeChange(() => { calls++; });
		state.onScopeChange(() => { throw new Error('boom'); });
		state.setScope(() => true);
		stop();
		state.setScope(() => false);
		expect(calls).toBe(1);
	});
});

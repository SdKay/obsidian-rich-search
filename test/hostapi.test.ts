import { describe, it, expect } from 'vitest';
import { createHostApi } from '../src/hostapi';
import { QueryState } from '../src/querystate';

describe('createHostApi', () => {
	it('declares version 1, which the providers check', () => {
		expect(createHostApi(new QueryState()).apiVersion).toBe(1);
	});

	it('offers the one implementation of the matching rules', () => {
		const api = createHostApi(new QueryState());
		expect(api.matchLine('a cat and a cat', { query: 'cat' })).toEqual([{ start: 2, end: 5 }, { start: 12, end: 15 }]);
		expect(api.matchLine('concat cat', { query: 'cat', wholeWord: true })).toEqual([{ start: 7, end: 10 }]);
		expect(api.matchLine('今天，搜索，很好', { query: '搜索', wholeWord: true })).toEqual([{ start: 3, end: 5 }]);
	});

	it('returns no spans for an invalid pattern instead of throwing', () => {
		const api = createHostApi(new QueryState());
		expect(api.matchLine('abc', { query: '(', regex: true })).toEqual([]);
	});

	it('reports the search that is on screen, and none when there is none', () => {
		const state = new QueryState();
		const api = createHostApi(state);
		expect(api.currentQuery?.()).toBeNull();
		state.set({ query: 'cat', regex: true });
		expect(api.currentQuery?.()).toEqual({ query: 'cat', regex: true });
		state.clear();
		expect(api.currentQuery?.()).toBeNull();
	});

	it('lets a view follow the query and stop following it', () => {
		const state = new QueryState();
		const api = createHostApi(state);
		const seen: unknown[] = [];
		const off = api.onQueryChange?.((q) => seen.push(q));
		state.set({ query: 'a' });
		off?.();
		state.set({ query: 'b' });
		expect(seen).toEqual([{ query: 'a' }]);
	});

	it('is read-only: the object is frozen, so another plugin cannot replace a method', () => {
		const api = createHostApi(new QueryState());
		expect(Object.isFrozen(api)).toBe(true);
	});

	it('has exactly the members the contract lists', () => {
		expect(Object.keys(createHostApi(new QueryState())).sort()).toEqual(['apiVersion', 'currentHit', 'currentQuery', 'inScope', 'matchLine', 'onHitChange', 'onQueryChange', 'onScopeChange']);
	});
});

describe('createHostApi: the opened hit', () => {
	it('reports the hit that was opened and calls back when it changes', () => {
		const state = new QueryState();
		const api = createHostApi(state);
		state.set({ query: 'cat' });
		expect(api.currentHit?.()).toBeNull();
		const seen: unknown[] = [];
		const stop = api.onHitChange?.((h) => seen.push(h));
		state.setHit({ path: 'a.md', line: 4, index: 0 });
		expect(api.currentHit?.()).toEqual({ path: 'a.md', line: 4, index: 0 });
		stop?.();
		state.setHit({ path: 'a.md', line: 5, index: 0 });
		expect(seen).toEqual([{ path: 'a.md', line: 4, index: 0 }]);
	});

	it('says which files the search covers, and tells a view when that changes', () => {
		const state = new QueryState();
		const api = createHostApi(state);
		expect(api.inScope?.('a/b.drawio')).toBe(true);
		let calls = 0;
		const stop = api.onScopeChange?.(() => { calls++; });
		state.setScope((path) => path.startsWith('notes/'));
		expect(api.inScope?.('notes/a.md')).toBe(true);
		expect(api.inScope?.('a/b.drawio')).toBe(false);
		expect(calls).toBe(1);
		stop?.();
		state.setScope(() => true);
		expect(calls).toBe(1);
	});
});

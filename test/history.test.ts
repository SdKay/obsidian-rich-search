import { describe, it, expect } from 'vitest';
import { HistoryCursor, cloneState, recordState, sameState, sanitizeHistory, type SearchState } from '../src/history';

const state = (query: string, extra: Partial<SearchState> = {}): SearchState => ({
	query,
	caseSensitive: false,
	wholeWord: false,
	regex: false,
	filter: { allowFolders: [], denyFolders: [], allowExtensions: [], denyExtensions: [] },
	...extra,
});

describe('sameState', () => {
	it('is true for equal states and false when any part differs', () => {
		expect(sameState(state('a'), state('a'))).toBe(true);
		expect(sameState(state('a'), state('b'))).toBe(false);
		expect(sameState(state('a'), state('a', { caseSensitive: true }))).toBe(false);
		expect(sameState(state('a'), state('a', { wholeWord: true }))).toBe(false);
		expect(sameState(state('a'), state('a', { regex: true }))).toBe(false);
	});

	it('compares every scope list', () => {
		const base = state('a');
		for (const key of ['allowFolders', 'denyFolders', 'allowExtensions', 'denyExtensions'] as const) {
			expect(sameState(base, state('a', { filter: { ...base.filter, [key]: ['x'] } }))).toBe(false);
		}
		const withScope = state('a', { filter: { ...base.filter, denyFolders: ['x', 'y'] } });
		expect(sameState(withScope, cloneState(withScope))).toBe(true);
	});
});

describe('cloneState', () => {
	it('copies the scope lists so editing one state never changes the other', () => {
		const a = state('a', { filter: { allowFolders: ['n'], denyFolders: [], allowExtensions: [], denyExtensions: [] } });
		const b = cloneState(a);
		b.filter.allowFolders.push('m');
		expect(a.filter.allowFolders).toEqual(['n']);
	});
});

describe('recordState', () => {
	it('appends a new state at the end and does not change the input list', () => {
		const before = [state('a')];
		const after = recordState(before, state('b'));
		expect(after.map((s) => s.query)).toEqual(['a', 'b']);
		expect(before.map((s) => s.query)).toEqual(['a']);
	});

	it('ignores an empty query', () => {
		expect(recordState([state('a')], state(''))).toHaveLength(1);
	});

	it('records a query that is only spaces', () => {
		expect(recordState([], state('  '))).toHaveLength(1);
	});

	it('moves an identical earlier entry to the end instead of duplicating it', () => {
		const after = recordState([state('a'), state('b')], state('a'));
		expect(after.map((s) => s.query)).toEqual(['b', 'a']);
	});

	it('keeps the same query with different options as separate entries', () => {
		const after = recordState([state('a')], state('a', { regex: true }));
		expect(after).toHaveLength(2);
	});

	it('drops the oldest entries beyond the limit', () => {
		let list: SearchState[] = [];
		for (const q of ['a', 'b', 'c', 'd']) list = recordState(list, state(q), 3);
		expect(list.map((s) => s.query)).toEqual(['b', 'c', 'd']);
	});

	it('keeps at most 50 entries by default and drops the oldest', () => {
		let list: SearchState[] = [];
		for (let i = 0; i < 60; i++) list = recordState(list, state(`q${i}`));
		expect(list).toHaveLength(50);
		expect(list[0]?.query).toBe('q10');
		expect(list[49]?.query).toBe('q59');
	});

	it('stores a copy, not the caller\'s object', () => {
		const s = state('a');
		const list = recordState([], s);
		s.filter.denyFolders.push('x');
		expect(list[0]?.filter.denyFolders).toEqual([]);
	});
});

describe('sanitizeHistory', () => {
	it('returns an empty list for anything that is not an array', () => {
		for (const raw of [undefined, null, 5, 'x', {}]) expect(sanitizeHistory(raw)).toEqual([]);
	});

	it('keeps well-formed entries', () => {
		const good = state('a', { regex: true });
		expect(sanitizeHistory([good])).toEqual([good]);
	});

	it('drops entries that are missing a field or have the wrong type', () => {
		const good = state('ok');
		const bad = [
			null,
			'x',
			{ query: 'q' },
			{ ...state('q'), query: 5 },
			{ ...state('q'), regex: 'yes' },
			{ ...state('q'), filter: null },
			{ ...state('q'), filter: { allowFolders: 'a', denyFolders: [], allowExtensions: [], denyExtensions: [] } },
			{ ...state('q'), filter: { allowFolders: [1], denyFolders: [], allowExtensions: [], denyExtensions: [] } },
			{ ...state('q'), query: '' },
		];
		expect(sanitizeHistory([...bad, good])).toEqual([good]);
	});

	it('keeps only the newest entries when the saved list is too long', () => {
		const raw = ['a', 'b', 'c', 'd'].map((q) => state(q));
		expect(sanitizeHistory(raw, 2).map((s) => s.query)).toEqual(['c', 'd']);
	});
});

describe('HistoryCursor', () => {
	const make = (...queries: string[]) => {
		const history = queries.map((q) => state(q));
		return { history, cursor: new HistoryCursor(() => history) };
	};

	it('does nothing when the history is empty', () => {
		const { cursor } = make();
		expect(cursor.older(state('draft'))).toBeUndefined();
		expect(cursor.newer()).toBeUndefined();
	});

	it('steps back from the newest to the oldest and then stops', () => {
		const { cursor } = make('a', 'b', 'c');
		expect(cursor.older(state('now'))?.query).toBe('c');
		expect(cursor.older(state('now'))?.query).toBe('b');
		expect(cursor.older(state('now'))?.query).toBe('a');
		expect(cursor.older(state('now'))).toBeUndefined();
		expect(cursor.older(state('now'))).toBeUndefined();
	});

	it('steps forward again and ends on the draft that was there before the first step back', () => {
		const { cursor } = make('a', 'b');
		cursor.older(state('half typed'));
		cursor.older(state('ignored'));
		expect(cursor.newer()?.query).toBe('b');
		expect(cursor.newer()?.query).toBe('half typed');
		expect(cursor.newer()).toBeUndefined();
	});

	it('keeps the draft with its options, not just its text', () => {
		const { cursor } = make('a');
		cursor.older(state('draft', { regex: true, wholeWord: true }));
		const back = cursor.newer();
		expect(back).toMatchObject({ query: 'draft', regex: true, wholeWord: true });
	});

	it('takes the draft once: later calls during navigation do not replace it', () => {
		const { cursor } = make('a', 'b');
		cursor.older(state('draft'));
		cursor.older(state('something else'));
		cursor.newer();
		expect(cursor.newer()?.query).toBe('draft');
	});

	it('does not move forward when it is not navigating', () => {
		const { cursor } = make('a');
		expect(cursor.newer()).toBeUndefined();
	});

	it('skips history entries equal to the current state, so the first step back changes something', () => {
		const { cursor } = make('a', 'b');
		expect(cursor.older(state('b'))?.query).toBe('a');
	});

	it('does not skip an entry with the same text but different options', () => {
		const { cursor } = make('b');
		expect(cursor.older(state('b', { regex: true }))?.query).toBe('b');
	});

	it('stays put when every entry equals the current state', () => {
		const { cursor } = make('a');
		expect(cursor.older(state('a'))).toBeUndefined();
		expect(cursor.newer()).toBeUndefined();
	});

	it('starts again from the newest entry after reset', () => {
		const { cursor } = make('a', 'b', 'c');
		cursor.older(state('x'));
		cursor.older(state('x'));
		cursor.reset();
		expect(cursor.newer()).toBeUndefined();
		expect(cursor.older(state('y'))?.query).toBe('c');
	});

	it('returns copies, so editing a returned state never changes the history', () => {
		const { history, cursor } = make('a');
		const got = cursor.older(state('x'));
		got?.filter.denyFolders.push('z');
		expect(history[0]?.filter.denyFolders).toEqual([]);
	});

	it('copes with the history shrinking while navigating', () => {
		const history = [state('a'), state('b'), state('c')];
		const cursor = new HistoryCursor(() => history);
		cursor.older(state('x'));
		cursor.older(state('x'));
		history.length = 1;
		expect(() => cursor.newer()).not.toThrow();
		expect(() => cursor.older(state('x'))).not.toThrow();
	});
});

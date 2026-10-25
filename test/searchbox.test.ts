import { describe, it, expect } from 'vitest';
import { SearchBoxModel } from '../src/searchbox';
import type { SearchState } from '../src/history';

const scope = { allowFolders: [], denyFolders: [], allowExtensions: [], denyExtensions: [] };
const state = (query: string, extra: Partial<SearchState> = {}): SearchState => ({
	query, caseSensitive: false, wholeWord: false, regex: false, filter: { ...scope }, ...extra,
});

function make(initial: SearchState[] = []) {
	let history = initial;
	const saved: SearchState[][] = [];
	const model = new SearchBoxModel({
		getHistory: () => history,
		setHistory: (h) => { history = h; saved.push(h); },
	});
	return { model, saved, history: () => history };
}

describe('SearchBoxModel: remembering', () => {
	it('does not remember while typing', () => {
		const { model, saved } = make();
		model.type(state('c'));
		model.type(state('ca'));
		model.type(state('cat'));
		expect(saved).toEqual([]);
	});

	it('remembers a search when Enter is pressed', () => {
		const { model, history } = make();
		model.submit(state('cat'));
		expect(history().map((s) => s.query)).toEqual(['cat']);
	});

	it('does not save again when Enter repeats a search already remembered', () => {
		const { model, saved } = make();
		model.submit(state('cat'));
		model.submit(state('cat'));
		expect(saved).toHaveLength(2);
		expect(saved[1]?.map((s) => s.query)).toEqual(['cat']);
	});

	it('does not remember an empty query', () => {
		const { model, saved, history } = make();
		model.submit(state(''));
		expect(history()).toEqual([]);
		expect(saved).toEqual([]);
	});

	it('remembers the options and scope together with the text', () => {
		const { model, history } = make();
		model.submit(state('cat', { regex: true, wholeWord: true, filter: { ...scope, denyFolders: ['archive'] } }));
		expect(history()[0]).toMatchObject({ query: 'cat', regex: true, wholeWord: true, filter: { denyFolders: ['archive'] } });
	});
});

describe('SearchBoxModel: arrows', () => {
	it('Up goes back to the last remembered search and Down returns to the draft', () => {
		const { model } = make();
		model.submit(state('first'));
		model.submit(state('second'));
		expect(model.up(state('dra'))?.query).toBe('second');
		expect(model.up(state('second'))?.query).toBe('first');
		expect(model.down()?.query).toBe('second');
		expect(model.down()?.query).toBe('dra');
	});

	it('Up with nothing remembered does nothing', () => {
		const { model } = make();
		expect(model.up(state('x'))).toBeUndefined();
	});

	it('Up works on history loaded from a previous session', () => {
		const { model } = make([state('old1'), state('old2')]);
		expect(model.up(state(''))?.query).toBe('old2');
	});

	it('typing ends navigation: the next Up starts again from the newest entry', () => {
		const { model } = make([state('a'), state('b'), state('c')]);
		model.up(state('x'));
		model.up(state('x'));
		model.type(state('xy'));
		expect(model.up(state('xy'))?.query).toBe('c');
	});

	it('submitting while navigating ends navigation: the next Up starts from the newest entry', () => {
		const { model } = make([state('a'), state('b'), state('c')]);
		model.up(state(''));
		model.up(state(''));
		model.submit(state('new'));
		expect(model.up(state('new'))?.query).toBe('c');
	});

	it('Up from a search the user just submitted goes to the one before it', () => {
		const { model } = make([state('a')]);
		model.submit(state('b'));
		expect(model.up(state('b'))?.query).toBe('a');
	});

	it('Up restores options and scope, not just the text', () => {
		const { model } = make();
		model.submit(state('x', { regex: true, filter: { ...scope, allowFolders: ['n'] } }));
		model.submit(state('y'));
		expect(model.up(state('y'))).toMatchObject({ query: 'x', regex: true, filter: { allowFolders: ['n'] } });
	});

	it('works when the search was changed by an option toggle only', () => {
		const { model } = make();
		model.submit(state('cat'));
		model.submit(state('cat', { caseSensitive: true }));
		expect(model.up(state('cat', { caseSensitive: true }))).toMatchObject({ query: 'cat', caseSensitive: false });
	});

	it('toggling an option ends navigation', () => {
		const { model } = make([state('a'), state('b')]);
		model.up(state(''));
		model.optionChanged();
		expect(model.up(state(''))?.query).toBe('b');
	});
});

describe('SearchBoxModel: managing the history', () => {
	function box(initial: SearchState[]) {
		let history = initial;
		const model = new SearchBoxModel({ getHistory: () => history, setHistory: (h) => { history = h; } });
		return { model, get: () => history };
	}
	const q = (query: string): SearchState => ({ query, caseSensitive: false, wholeWord: false, regex: false, filter: { allowFolders: [], denyFolders: [], allowExtensions: [], denyExtensions: [] } });

	it('forgets one search by its position', () => {
		const b = box([q('a'), q('b'), q('c')]);
		b.model.forget(1);
		expect(b.get().map((s) => s.query)).toEqual(['a', 'c']);
	});

	it('forgets every search', () => {
		const b = box([q('a'), q('b')]);
		b.model.forgetAll();
		expect(b.get()).toEqual([]);
	});

	it('ends history navigation, so an arrow key does not return an entry that is gone', () => {
		const b = box([q('a'), q('b'), q('c')]);
		expect(b.model.up(q('x'))?.query).toBe('c');
		expect(b.model.up(q('c'))?.query).toBe('b');
		b.model.forget(1);
		// Navigation starts over from the newest entry that is left.
		expect(b.model.up(q('x'))?.query).toBe('c');
		expect(b.model.up(q('c'))?.query).toBe('a');
	});

	it('ends history navigation when everything is forgotten', () => {
		const b = box([q('a')]);
		b.model.up(q('x'));
		b.model.forgetAll();
		expect(b.model.up(q('x'))).toBeUndefined();
		expect(b.model.down()).toBeUndefined();
	});

	it('does not save when the position is not in the list', () => {
		let saved = 0;
		const model = new SearchBoxModel({ getHistory: () => [q('a')], setHistory: () => { saved++; } });
		model.forget(5);
		expect(saved).toBe(0);
	});

	it('does not save when there is nothing to forget', () => {
		let saved = 0;
		const model = new SearchBoxModel({ getHistory: () => [], setHistory: () => { saved++; } });
		model.forgetAll();
		expect(saved).toBe(0);
	});
});

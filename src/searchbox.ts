import { HistoryCursor, recordState, removeState, type SearchState } from './history';

export interface SearchBoxStore {
	getHistory(): SearchState[];
	setHistory(history: SearchState[]): void;
}

/**
 * The decisions behind the search box that do not need a DOM: when a search is remembered, and which
 * state an arrow key returns. The view only forwards key presses and applies what this returns.
 */
export class SearchBoxModel {
	private readonly cursor: HistoryCursor;

	constructor(private readonly store: SearchBoxStore) {
		this.cursor = new HistoryCursor(() => store.getHistory());
	}

	/** The user edited the text. Typing is not remembered (only Enter is) and ends any history navigation. */
	type(_state: SearchState): void {
		this.cursor.reset();
	}

	/** An option or the scope changed by hand: also ends history navigation. */
	optionChanged(): void {
		this.cursor.reset();
	}

	/** Enter: remember this search. */
	submit(state: SearchState): void {
		this.cursor.reset();
		const before = this.store.getHistory();
		const after = recordState(before, state);
		if (after !== before) this.store.setHistory(after);
	}

	/** Forget one remembered search, by its position in the list. Navigation starts over: its place in the list may have moved. */
	forget(position: number): void {
		this.cursor.reset();
		const before = this.store.getHistory();
		const after = removeState(before, position);
		if (after !== before) this.store.setHistory(after);
	}

	/** Forget every remembered search. */
	forgetAll(): void {
		this.cursor.reset();
		if (this.store.getHistory().length > 0) this.store.setHistory([]);
	}

	/** Arrow up: the next older search, or undefined when there is none. */
	up(current: SearchState): SearchState | undefined {
		return this.cursor.older(current);
	}

	/** Arrow down: the next newer search, ending on the draft. Undefined when not navigating. */
	down(): SearchState | undefined {
		return this.cursor.newer();
	}
}

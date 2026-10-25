import type { FileFilter } from './types';

/** Everything that defines one search: what was typed, how it matches, and where it looks. */
export interface SearchState {
	query: string;
	caseSensitive: boolean;
	wholeWord: boolean;
	regex: boolean;
	filter: FileFilter;
}

export const HISTORY_LIMIT = 50;

const LISTS = ['allowFolders', 'denyFolders', 'allowExtensions', 'denyExtensions'] as const;

export function cloneState(s: SearchState): SearchState {
	return {
		query: s.query,
		caseSensitive: s.caseSensitive,
		wholeWord: s.wholeWord,
		regex: s.regex,
		filter: {
			allowFolders: [...s.filter.allowFolders],
			denyFolders: [...s.filter.denyFolders],
			allowExtensions: [...s.filter.allowExtensions],
			denyExtensions: [...s.filter.denyExtensions],
		},
	};
}

export function sameState(a: SearchState, b: SearchState): boolean {
	return a.query === b.query
		&& a.caseSensitive === b.caseSensitive
		&& a.wholeWord === b.wholeWord
		&& a.regex === b.regex
		&& LISTS.every((k) => a.filter[k].length === b.filter[k].length && a.filter[k].every((v, i) => v === b.filter[k][i]));
}

/** A new list with `state` as the newest entry. An empty query is not worth remembering; a repeat moves to the end. */
export function recordState(history: SearchState[], state: SearchState, limit = HISTORY_LIMIT): SearchState[] {
	if (state.query === '') return history;
	const kept = history.filter((h) => !sameState(h, state));
	return [...kept, cloneState(state)].slice(-limit);
}

/** A new list without the entry at `position`; the same list when there is no such entry. */
export function removeState(history: SearchState[], position: number): SearchState[] {
	if (!Number.isInteger(position) || position < 0 || position >= history.length) return history;
	return [...history.slice(0, position), ...history.slice(position + 1)];
}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function isState(v: unknown): v is SearchState {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	const f = o.filter as Record<string, unknown> | null | undefined;
	return typeof o.query === 'string' && o.query !== ''
		&& typeof o.caseSensitive === 'boolean'
		&& typeof o.wholeWord === 'boolean'
		&& typeof o.regex === 'boolean'
		&& typeof f === 'object' && f !== null
		&& LISTS.every((k) => isStringList(f[k]));
}

/** Saved history comes from disk and may be old or hand-edited: keep only entries that are fully well-formed. */
export function sanitizeHistory(raw: unknown, limit = HISTORY_LIMIT): SearchState[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(isState).map(cloneState).slice(-limit);
}

/**
 * Walks back and forth through the history like a shell or VS Code's find box. The first step back
 * remembers what the user had typed (the draft), and stepping forward past the newest entry returns to it.
 */
export class HistoryCursor {
	/** Index into the history while navigating; -1 when not navigating. */
	private index = -1;
	private draft: SearchState | null = null;

	constructor(private readonly history: () => SearchState[]) {}

	reset(): void {
		this.index = -1;
		this.draft = null;
	}

	/** The next older state that differs from `current`, or undefined when there is none. */
	older(current: SearchState): SearchState | undefined {
		const list = this.history();
		const from = this.index === -1 ? list.length : Math.min(this.index, list.length);
		for (let i = from - 1; i >= 0; i--) {
			const entry = list[i];
			if (!entry || sameState(entry, current)) continue;
			if (this.index === -1) this.draft = cloneState(current);
			this.index = i;
			return cloneState(entry);
		}
		return undefined;
	}

	/** The next newer state; after the newest entry, the draft. Undefined when not navigating. */
	newer(): SearchState | undefined {
		if (this.index === -1) return undefined;
		const list = this.history();
		for (let i = this.index + 1; i < list.length; i++) {
			const entry = list[i];
			if (!entry) continue;
			this.index = i;
			return cloneState(entry);
		}
		const draft = this.draft;
		this.reset();
		return draft ?? undefined;
	}
}

const LABEL_LENGTH = 40;

/**
 * A one-line description of a remembered search, for a menu: the query, the options that are on (written as the
 * toggles are), and the folders it was limited to. `inFolders` turns the folders into words, in the user's language.
 */
export function describeState(s: SearchState, inFolders: (folders: string) => string = (f) => f): string {
	const flat = s.query.replace(/\s*[\r\n]+\s*/g, ' ');
	const query = flat.length > LABEL_LENGTH ? `${flat.slice(0, LABEL_LENGTH)}…` : flat;
	const flags = [s.caseSensitive && 'Aa', s.wholeWord && 'ab', s.regex && '.*'].filter((f): f is string => f !== false);
	const folders = s.filter.allowFolders.length > 0 ? `  ${inFolders(s.filter.allowFolders.join(', '))}` : '';
	return `${query}${flags.length > 0 ? `  [${flags.join(' ')}]` : ''}${folders}`;
}

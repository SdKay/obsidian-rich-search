import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { editorHighlight, marksIn, needsRedraw, setHit, setQuery } from '../src/editor-highlight';

const withQuery = (doc: string, query: Parameters<typeof setQuery.of>[0]) =>
	EditorState.create({ doc, extensions: [editorHighlight] }).update({ effects: setQuery.of(query) }).state;

const classes = (set: DecorationSet): { from: number; to: number; cls: string }[] => {
	const out: { from: number; to: number; cls: string }[] = [];
	const cursor = set.iter();
	while (cursor.value) { out.push({ from: cursor.from, to: cursor.to, cls: (cursor.value.spec as { class: string }).class }); cursor.next(); }
	return out;
};

/** The ranges a decoration set covers, so a test can read what would be drawn. */
function covered(set: DecorationSet): { from: number; to: number }[] {
	const out: { from: number; to: number }[] = [];
	const cursor = set.iter();
	while (cursor.value) { out.push({ from: cursor.from, to: cursor.to }); cursor.next(); }
	return out;
}

describe('marksIn', () => {
	it('marks the matched words and nothing else on the line', () => {
		const state = withQuery('a cat and a cat', { query: 'cat' });
		expect(covered(marksIn(state, [{ from: 0, to: state.doc.length }]))).toEqual([{ from: 2, to: 5 }, { from: 12, to: 15 }]);
	});

	it('marks nothing when there is no search', () => {
		const state = withQuery('a cat', null);
		expect(covered(marksIn(state, [{ from: 0, to: state.doc.length }]))).toEqual([]);
	});

	it('marks the words on several lines with their document offsets', () => {
		const state = withQuery('one\ntwo cat\nthree cat', { query: 'cat' });
		expect(covered(marksIn(state, [{ from: 0, to: state.doc.length }]))).toEqual([{ from: 8, to: 11 }, { from: 18, to: 21 }]);
	});

	it('marks only the lines in view', () => {
		const state = withQuery('cat\nmid\ncat', { query: 'cat' });
		expect(covered(marksIn(state, [{ from: 8, to: 11 }]))).toEqual([{ from: 8, to: 11 }]);
	});

	it('follows the options of the search', () => {
		const state = withQuery('Cat concat cat', { query: 'cat', caseSensitive: true, wholeWord: true });
		expect(covered(marksIn(state, [{ from: 0, to: state.doc.length }]))).toEqual([{ from: 11, to: 14 }]);
	});

	it('marks the words of a Chinese line', () => {
		const state = withQuery('全文搜索很快', { query: '搜索' });
		expect(covered(marksIn(state, [{ from: 0, to: state.doc.length }]))).toEqual([{ from: 2, to: 4 }]);
	});

	it('keeps the marks after the note is edited, shifted to where the words now are', () => {
		let state = withQuery('a cat', { query: 'cat' });
		state = state.update({ changes: { from: 0, insert: 'the ' } }).state;
		expect(covered(marksIn(state, [{ from: 0, to: state.doc.length }]))).toEqual([{ from: 6, to: 9 }]);
	});

	it('is not cleared by moving the cursor', () => {
		let state = withQuery('a cat', { query: 'cat' });
		state = state.update({ selection: { anchor: 3 } }).state;
		expect(covered(marksIn(state, [{ from: 0, to: state.doc.length }]))).toEqual([{ from: 2, to: 5 }]);
	});
});

describe('marksIn: the match that was opened', () => {
	const stateWith = (doc: string, hit: Parameters<typeof setHit.of>[0]) =>
		withQuery(doc, { query: 'cat' }).update({ effects: setHit.of(hit) }).state;
	const all = (state: EditorState) => classes(marksIn(state, [{ from: 0, to: state.doc.length }]));

	it('marks only the opened match as active, the others as ordinary', () => {
		const state = stateWith('cat\na cat and cat', { line: 1, index: 1 });
		expect(all(state)).toEqual([
			{ from: 0, to: 3, cls: 'rs-editor-match' },
			{ from: 6, to: 9, cls: 'rs-editor-match' },
			{ from: 14, to: 17, cls: 'rs-editor-match rs-editor-match-active' },
		]);
	});

	it('counts the lines from 0 and the matches of a line from 0', () => {
		const state = stateWith('cat cat\ncat', { line: 0, index: 0 });
		expect(all(state).map((m) => m.cls.includes('active'))).toEqual([true, false, false]);
	});

	it('marks nothing as active when there is no opened match', () => {
		const state = stateWith('a cat', null);
		expect(all(state).some((m) => m.cls.includes('active'))).toBe(false);
	});

	it('marks nothing as active when the line has fewer matches than the index', () => {
		const state = stateWith('a cat', { line: 0, index: 3 });
		expect(all(state).some((m) => m.cls.includes('active'))).toBe(false);
	});

	it('marks nothing as active when the line is gone, as after the note was shortened', () => {
		const state = stateWith('a cat', { line: 9, index: 0 });
		expect(all(state).some((m) => m.cls.includes('active'))).toBe(false);
	});
});

describe('needsRedraw', () => {
	const base = withQuery('a cat', { query: 'cat' });
	const hit = (state: EditorState, h: { line: number; index: number } | null) => state.update({ effects: setHit.of(h) }).state;

	it('is false when nothing that decides the marks changed', () => {
		expect(needsRedraw(base, base.update({ selection: { anchor: 2 } }).state, false)).toBe(false);
	});

	it('is true when only the opened match changed, which is what moves the bright mark', () => {
		expect(needsRedraw(base, hit(base, { line: 0, index: 0 }), false)).toBe(true);
	});

	it('is true when the search, the text or what is in view changed', () => {
		expect(needsRedraw(base, base.update({ effects: setQuery.of({ query: 'a' }) }).state, false)).toBe(true);
		expect(needsRedraw(base, base.update({ changes: { from: 0, insert: 'x' } }).state, false)).toBe(true);
		expect(needsRedraw(base, base, true)).toBe(true);
	});
});

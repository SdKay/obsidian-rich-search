import { describe, it, expect } from 'vitest';
import { planOpen, highlightRanges } from '../src/openhit';
import type { SearchHit } from '../src/types';
import type { ExtensionProvider } from '../src/providers';

const query = { query: 'cat' };
const noteHit: SearchHit = { path: 'notes/a.md', line: 4, text: 'a cat and a cat', spans: [{ start: 2, end: 5 }, { start: 12, end: 15 }] };
const sheetHit: SearchHit = { path: 'data/b.xlsx', line: 2, text: 'cat food', spans: [{ start: 0, end: 3 }], location: 'Sheet1!B4', anchor: { sheet: 'Sheet1', row: 4, col: 2 } };

const provider = (extra: Partial<ExtensionProvider> = {}): ExtensionProvider => ({ ext: 'xlsx', status: 'available', plugin: 'Rich Table', viewRegistered: true, ...extra });

describe('planOpen: notes', () => {
	it('opens a note at its line with the matches, keeping the hit line 0-based', () => {
		const plan = planOpen(noteHit, query, undefined);
		expect(plan.eState).toEqual({ line: 4, richSearchSpans: [{ start: 2, end: 5 }, { start: 12, end: 15 }] });
		expect(plan.note).toBeUndefined();
	});

	it('hands out its own copy of the spans, so the editor cannot change the hit', () => {
		const plan = planOpen(noteHit, query, undefined);
		(plan.eState.richSearchSpans as { start: number }[])[0]!.start = 99;
		expect(noteHit.spans[0]?.start).toBe(2);
	});

	it('does not need a provider for a note', () => {
		expect(planOpen(noteHit, query, undefined).kind).toBe('note');
	});

	it('is a note even if a provider exists for some other extension', () => {
		expect(planOpen(noteHit, query, provider()).kind).toBe('note');
	});

	it('treats .md in any case as a note', () => {
		expect(planOpen({ ...noteHit, path: 'A.MD' }, query, undefined).kind).toBe('note');
	});
});

describe('planOpen: files owned by a provider', () => {
	it('hands the anchor and the query to the provider\'s view, unchanged', () => {
		const plan = planOpen(sheetHit, query, provider());
		expect(plan.kind).toBe('provided');
		expect(plan.eState).toEqual({ richSearch: { anchor: { sheet: 'Sheet1', row: 4, col: 2 }, query } });
	});

	it('does not pass a line number to a provider\'s view, since its line is only an index', () => {
		expect(planOpen(sheetHit, query, provider()).eState).not.toHaveProperty('line');
	});

	it('says nothing when the provider\'s own view is registered', () => {
		expect(planOpen(sheetHit, query, provider({ viewRegistered: true })).note).toBeUndefined();
	});

	it('warns that it cannot jump when the provider\'s view lost the extension', () => {
		expect(planOpen(sheetHit, query, provider({ viewRegistered: false })).note).toBe('cannotJump');
	});

	it('still opens the file when the provider is gone, with a note that it cannot jump', () => {
		const plan = planOpen(sheetHit, query, undefined);
		expect(plan.kind).toBe('provided');
		expect(plan.note).toBe('cannotJump');
		expect(plan.eState).toEqual({});
	});

	it('does not include the anchor key when the hit has none', () => {
		const { anchor: _a, ...bare } = sheetHit;
		const plan = planOpen(bare, query, provider());
		expect(plan.eState).toStrictEqual({ richSearch: { query } });
	});

	it('does not trust a provider that speaks another version of the contract', () => {
		const plan = planOpen(sheetHit, query, provider({ status: 'outdated' }));
		expect(plan.note).toBe('cannotJump');
		expect(plan.eState).toEqual({});
	});

	it('does not trust a provider that is not installed', () => {
		expect(planOpen(sheetHit, query, provider({ status: 'missing' })).note).toBe('cannotJump');
	});

	it('does not share the hit\'s query object with the state it hands out', () => {
		const q = { query: 'cat', regex: false };
		const plan = planOpen(sheetHit, q, provider());
		q.regex = true;
		expect((plan.eState as { richSearch: { query: { regex: boolean } } }).richSearch.query.regex).toBe(false);
	});
});

describe('highlightRanges', () => {
	it('turns line-relative spans into document offsets', () => {
		expect(highlightRanges(100, [{ start: 2, end: 5 }, { start: 12, end: 15 }])).toEqual([{ from: 102, to: 105 }, { from: 112, to: 115 }]);
	});

	it('returns nothing for no spans', () => {
		expect(highlightRanges(10, [])).toEqual([]);
	});

	it('drops empty or reversed spans', () => {
		expect(highlightRanges(0, [{ start: 3, end: 3 }, { start: 5, end: 2 }, { start: 1, end: 2 }])).toEqual([{ from: 1, to: 2 }]);
	});

	it('sorts the ranges, which the editor requires', () => {
		expect(highlightRanges(0, [{ start: 8, end: 9 }, { start: 1, end: 2 }])).toEqual([{ from: 1, to: 2 }, { from: 8, to: 9 }]);
	});

	it('clamps ranges to the end of the document', () => {
		expect(highlightRanges(0, [{ start: 4, end: 20 }], 10)).toEqual([{ from: 4, to: 10 }]);
		expect(highlightRanges(0, [{ start: 12, end: 20 }], 10)).toEqual([]);
	});
});

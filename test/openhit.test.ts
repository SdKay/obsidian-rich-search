import { describe, it, expect } from 'vitest';
import { planOpen } from '../src/openhit';
import type { SearchHit } from '../src/types';
import type { ExtensionProvider } from '../src/providers';

const query = { query: 'cat' };
const noteHit: SearchHit = { path: 'notes/a.md', line: 4, text: 'a cat and a cat', spans: [{ start: 2, end: 5 }, { start: 12, end: 15 }] };
const sheetHit: SearchHit = { path: 'data/b.xlsx', line: 2, text: 'cat food', spans: [{ start: 0, end: 3 }], location: 'Sheet1!B4', anchor: { sheet: 'Sheet1', row: 4, col: 2 } };

const provider = (extra: Partial<ExtensionProvider> = {}): ExtensionProvider => ({ ext: 'xlsx', status: 'available', plugin: 'Rich Table', viewRegistered: true, ...extra });

describe('planOpen: notes', () => {
	it('opens a note without any position of its own: the line is shown afterwards, by the mode the note opened in', () => {
		const plan = planOpen(noteHit, query, undefined);
		expect(plan.eState).toStrictEqual({});
		expect(plan.note).toBeUndefined();
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

describe('planOpen: a hit inside a block a provider renders', () => {
	const blockHit: SearchHit = { path: 'notes/a.md', line: 7, text: 'cat', spans: [{ start: 0, end: 3 }], location: 'Table 1 · row 2', anchor: { r: 2 }, block: { fromLine: 7, language: 'rich-table' } };

	it('scrolls to the block and puts no cursor in it, because a cursor in a fence shows the block as source', () => {
		const plan = planOpen(blockHit, query, undefined);
		expect(plan.kind).toBe('block');
		expect(plan.eState).toEqual({ scroll: 7 });
		expect(plan.eState).not.toHaveProperty('line');
	});

	it('does not depend on the extension provider of the file', () => {
		expect(planOpen(blockHit, query, provider()).eState).toEqual({ scroll: 7 });
	});
});

describe('planOpen: a PDF', () => {
	const pdfHit: SearchHit = { path: 'docs/a.pdf', line: 40, text: 'cat', spans: [{ start: 0, end: 3 }], location: 'Page 7', anchor: { page: 7 } };

	it('opens the page in Obsidian\'s own viewer, without any plugin', () => {
		expect(planOpen(pdfHit, query, undefined)).toEqual({ kind: 'pdf', eState: { subpath: '#page=7' } });
	});

	it('opens the file without a page, and says nothing, when the anchor is not a page', () => {
		expect(planOpen({ ...pdfHit, anchor: { page: 'x' } }, query, undefined)).toEqual({ kind: 'pdf', eState: {} });
	});

	it('treats the extension in any case', () => {
		expect(planOpen({ ...pdfHit, path: 'A.PDF' }, query, undefined).eState).toEqual({ subpath: '#page=7' });
	});
});

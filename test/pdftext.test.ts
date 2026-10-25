import { describe, it, expect } from 'vitest';
import { extractPages, isPdfAnchor, linesOfItems, type PdfItem } from '../src/pdftext';

const item = (str: string, hasEOL = false): PdfItem => ({ str, hasEOL });
const noWait = (): Promise<void> => Promise.resolve();
const doc = (pages: PdfItem[][]) => ({ count: pages.length, page: (n: number) => Promise.resolve(pages[n - 1] ?? []) });

describe('linesOfItems', () => {
	it('joins the pieces of one line and starts a new line at each end-of-line mark', () => {
		expect(linesOfItems([item('Hello '), item('world', true), item('second', true)])).toEqual(['Hello world', 'second']);
	});

	it('keeps the last line when the page does not end with a mark', () => {
		expect(linesOfItems([item('a', true), item('b')])).toEqual(['a', 'b']);
	});

	it('drops lines with nothing but spaces, and trims the ends', () => {
		expect(linesOfItems([item('  x  ', true), item('   ', true), item('', true)])).toEqual(['x']);
	});

	it('is empty for a page with no text', () => {
		expect(linesOfItems([])).toEqual([]);
	});
});

describe('extractPages', () => {
	it('lists each line with its page as the location and the anchor, in page order', async () => {
		const r = await extractPages(doc([[item('one', true)], [item('two', true), item('three', true)]]), { maxPages: 500, wait: noWait });
		expect(r).toEqual({ ok: true, value: [
			{ text: 'one', location: 'Page 1', anchor: { page: 1 } },
			{ text: 'two', location: 'Page 2', anchor: { page: 2 } },
			{ text: 'three', location: 'Page 2', anchor: { page: 2 } },
		] });
	});

	it('reads only the pages it is allowed to and says so when there are more', async () => {
		const asked: number[] = [];
		const d = { count: 4, page: (n: number) => { asked.push(n); return Promise.resolve([item('x', true)]); } };
		const r = await extractPages(d, { maxPages: 2, wait: noWait });
		expect(asked).toEqual([]);
		expect(r).toEqual({ ok: false, error: 'More than 2 pages' });
	});

	it('accepts a document of exactly the limit', async () => {
		const r = await extractPages(doc([[item('a', true)], [item('b', true)]]), { maxPages: 2, wait: noWait });
		expect(r.ok).toBe(true);
	});

	it('fails with a clear reason when no page has text, as in a scanned document', async () => {
		const r = await extractPages(doc([[], [item('  ', true)]]), { maxPages: 500, wait: noWait });
		expect(r).toEqual({ ok: false, error: 'No text layer (scanned?)' });
	});

	it('does not call a document with no pages scanned, but empty', async () => {
		expect(await extractPages(doc([]), { maxPages: 500, wait: noWait })).toEqual({ ok: true, value: [] });
	});

	it('gives the UI a turn between batches of pages', async () => {
		let waits = 0;
		const pages = Array.from({ length: 25 }, () => [item('x', true)]);
		await extractPages(doc(pages), { maxPages: 500, wait: () => { waits++; return Promise.resolve(); } });
		expect(waits).toBe(2);
	});

	it('stops reading at the next batch once cancelled, so a changed query does not wait for a long document', async () => {
		const read: number[] = [];
		const controller = new AbortController();
		const d = { count: 100, page: (n: number) => { read.push(n); return Promise.resolve([item('x', true)]); } };
		const r = await extractPages(d, { maxPages: 500, wait: () => { controller.abort(); return Promise.resolve(); }, signal: controller.signal });
		expect(read.length).toBe(10);
		expect(r).toEqual({ ok: false, error: 'Cancelled' });
	});

	it('turns a page that cannot be read into a failure instead of throwing', async () => {
		const d = { count: 2, page: (n: number) => (n === 2 ? Promise.reject(new Error('bad page')) : Promise.resolve([item('a', true)])) };
		expect(await extractPages(d, { maxPages: 500, wait: noWait })).toEqual({ ok: false, error: 'bad page' });
	});
});

describe('isPdfAnchor', () => {
	it('accepts a positive whole page number and nothing else', () => {
		expect(isPdfAnchor({ page: 3 })).toBe(true);
		for (const bad of [null, undefined, 3, 'x', {}, { page: 0 }, { page: -1 }, { page: 1.5 }, { page: '2' }]) expect(isPdfAnchor(bad)).toBe(false);
	});
});

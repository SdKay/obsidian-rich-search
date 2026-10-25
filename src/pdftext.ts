import type { ExtractedLine, ExtractResult } from './richSearchApi';

/** The part of a PDF.js text item that is used: its text, and whether a line ends after it. */
export interface PdfItem {
	str: string;
	hasEOL?: boolean;
}

/** A document as far as searching needs it; `page` is 1-based. */
export interface PdfSource {
	count: number;
	page(n: number): Promise<PdfItem[]>;
}

export const PDF_PAGES_PER_BATCH = 10;

export interface PdfOptions {
	/** More pages than this and the file is not read: parsing a very long document takes seconds. */
	maxPages: number;
	/** Gives the UI a turn between batches of pages. */
	wait: () => Promise<void>;
	/** Checked between batches: a long document stops soon after the search that asked for it is cancelled. */
	signal?: AbortSignal;
}

/** What a hit in a PDF points at: the page. */
export interface PdfAnchor {
	page: number;
}

export function isPdfAnchor(v: unknown): v is PdfAnchor {
	return typeof v === 'object' && v !== null && Number.isInteger((v as { page?: unknown }).page) && (v as { page: number }).page >= 1;
}

/** The lines of one page: pieces are joined until the viewer says the line ends; blank lines are dropped. */
export function linesOfItems(items: PdfItem[]): string[] {
	const lines: string[] = [];
	let current = '';
	for (const it of items) {
		current += it.str;
		if (it.hasEOL === true) {
			lines.push(current);
			current = '';
		}
	}
	lines.push(current);
	return lines.map((l) => l.trim()).filter((l) => l !== '');
}

/** The text of a document, page by page, each line pointing at its page. A document with no text at all is a failure, not an empty result. */
export async function extractPages(source: PdfSource, options: PdfOptions): Promise<ExtractResult> {
	if (source.count > options.maxPages) return { ok: false, error: `More than ${options.maxPages} pages` };
	const out: ExtractedLine[] = [];
	try {
		for (let n = 1; n <= source.count; n++) {
			for (const text of linesOfItems(await source.page(n))) out.push({ text, location: `Page ${n}`, anchor: { page: n } });
			if (n % PDF_PAGES_PER_BATCH === 0 && n < source.count) {
				await options.wait();
				if (options.signal?.aborted) return { ok: false, error: 'Cancelled' };
			}
		}
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
	if (out.length === 0 && source.count > 0) return { ok: false, error: 'No text layer (scanned?)' };
	return { ok: true, value: out };
}

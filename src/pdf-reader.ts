import { loadPdfJs } from 'obsidian';
import { extractPages, type PdfItem } from './pdftext';
import type { ExtractResult } from './richSearchApi';

/** Obsidian's own PDF.js, a public API. Read per call: it loads on first use and is shared with the PDF viewer. */
const PDF_EXTRACT_VERSION = 4;
// A safety net, not a normal limit: standards run to 1,200 pages and are exactly what people search for.
export const PDF_MAX_PAGES = 5000;

export const pdfExtractVersion = (): number => PDF_EXTRACT_VERSION;

/** The text of a PDF, a page at a time. Never throws; a file PDF.js cannot open is a failure with its reason. */
export async function extractPdf(content: ArrayBuffer, signal?: AbortSignal): Promise<ExtractResult> {
	try {
		const pdfjs = await loadPdfJs() as { getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDocument>; destroy?(): Promise<void> } };
		const task = pdfjs.getDocument({ data: new Uint8Array(content) });
		try {
			const doc = await task.promise;
			return await extractPages(
				{
					count: doc.numPages,
					page: async (n) => {
						const page = await doc.getPage(n);
						const text = await page.getTextContent();
						page.cleanup?.();
						return text.items.filter((i): i is PdfItem => typeof (i as PdfItem).str === 'string');
					},
				},
				{ maxPages: PDF_MAX_PAGES, ...(signal ? { signal } : {}), wait: () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())) },
			);
		} finally {
			void task.destroy?.();
		}
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

interface PdfDocument {
	numPages: number;
	getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }>; cleanup?(): void }>;
}

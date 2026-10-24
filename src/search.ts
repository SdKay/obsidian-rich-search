import { splitNote } from './blocks';
import { isExcalidrawNote, textElementLines } from './excalidraw';
import { isAllowed } from './filter';
import { compile, matchLine } from './match';
import { cacheKey } from './providers';
import type { ExtractResult } from './richSearchApi';
import type { FileFilter, MatchOptions, SearchHit } from './types';

export interface SearchFile {
	path: string;
}

export interface SearchProgress {
	scanned: number;
	total: number;
	/** The hits so far. A copy: later batches do not change it. */
	hits: SearchHit[];
}

/** How a fenced block's lines are treated, by language. A language not listed is searched as plain text. */
export type BlockMode = 'skip';

/**
 * Reads files that are not notes by asking the plugin that renders them. Everything Obsidian-specific
 * (reading bytes, finding the plugin) stays behind this, so search.ts is testable without Obsidian.
 */
export interface BinaryReader {
	/** Whether a provider is available for this file, judged from the path alone. */
	handles(path: string): boolean;
	/** The provider's extractVersion for this file, part of the cache key. */
	version(path: string): number;
	/** Modification time, from file metadata: cheap, and asked before the bytes so a cached result can skip the read. */
	mtime(path: string): Promise<number>;
	read(path: string): Promise<ArrayBuffer>;
	extract(path: string, bytes: ArrayBuffer): Promise<ExtractResult>;
}

export interface SearchRequest {
	files: SearchFile[];
	/** Reads a note's text. Called only for files the path filter allows. */
	read: (path: string) => Promise<string>;
	/** Gives the UI thread a turn between batches. */
	yieldToUi: () => Promise<void>;
	match: MatchOptions;
	filter: FileFilter;
	blockModes?: Record<string, BlockMode>;
	/** Search a drawing note (`*.excalidraw.md`) by the words in the drawing only, not by its source. */
	excalidraw?: boolean;
	/** Present when a provider can read formats Obsidian cannot. Without it only notes are searched. */
	binary?: BinaryReader;
	/** Extracted text kept between searches, keyed by path + mtime + provider version. Only successes are kept. */
	cache?: Map<string, ExtractResult>;
	batchSize?: number;
	signal?: AbortSignal;
	onProgress?: (progress: SearchProgress) => void;
}

export type SearchResult =
	| { ok: true; hits: SearchHit[]; cancelled: boolean; failed: { path: string; error: string }[] }
	| { ok: false; error: string };

const DEFAULT_BATCH = 50;

/** Only Markdown notes have a reader so far; anything else is skipped, never read as raw bytes. */
const isNote = (path: string): boolean => path.toLowerCase().endsWith('.md');

/** Line numbers that belong to a block set to be skipped, fence lines included. */
function skippedLines(text: string, modes: Record<string, BlockMode>): { lines: string[]; skip: Set<number> } {
	const { lines, blocks } = splitNote(text);
	const skip = new Set<number>();
	for (const block of blocks) {
		if (modes[block.language] !== 'skip') continue;
		for (let l = block.fromLine; l <= block.toLine; l++) skip.add(l);
	}
	return { lines, skip };
}

/**
 * Searches notes in batches, yielding between them so a large vault never blocks the UI thread.
 * The path filter runs before anything is read: a file that is filtered out is never opened.
 */
export async function search(req: SearchRequest): Promise<SearchResult> {
	const compiled = compile(req.match);
	if (!compiled.ok) return { ok: false, error: compiled.error };

	const readable = (path: string): boolean => isNote(path) || (req.binary?.handles(path) ?? false);
	const todo = req.files.filter((f) => readable(f.path) && isAllowed(f.path, req.filter, { excalidraw: req.excalidraw === true }));
	const batchSize = req.batchSize ?? DEFAULT_BATCH;
	const modes = req.blockModes ?? {};
	const hits: SearchHit[] = [];
	const failed: { path: string; error: string }[] = [];
	let scanned = 0;

	for (let start = 0; start < todo.length; start += batchSize) {
		if (req.signal?.aborted) return { ok: true, hits, cancelled: true, failed };

		for (const file of todo.slice(start, start + batchSize)) {
			try {
				if (isNote(file.path)) searchNote(file.path, await req.read(file.path), req, modes, hits);
				else await searchProvided(file.path, req, hits, failed);
			} catch (err) {
				failed.push({ path: file.path, error: err instanceof Error ? err.message : String(err) });
			}
			scanned++;
		}

		req.onProgress?.({ scanned, total: todo.length, hits: [...hits] });
		if (start + batchSize < todo.length) await req.yieldToUi();
	}

	return { ok: true, hits, cancelled: req.signal?.aborted ?? false, failed };
}

function searchNote(path: string, text: string, req: SearchRequest, modes: Record<string, BlockMode>, hits: SearchHit[]): void {
	if (req.excalidraw && isExcalidrawNote(path)) {
		for (const { line, text: words } of textElementLines(text)) {
			const spans = matchLine(words, req.match);
			if (spans.length > 0) hits.push({ path, line, text: words, spans });
		}
		return;
	}
	const { lines, skip } = skippedLines(text, modes);
	lines.forEach((line, index) => {
		if (skip.has(index)) return;
		const spans = matchLine(line, req.match);
		if (spans.length > 0) hits.push({ path, line: index, text: line, spans });
	});
}

async function searchProvided(
	path: string,
	req: SearchRequest,
	hits: SearchHit[],
	failed: { path: string; error: string }[],
): Promise<void> {
	const binary = req.binary;
	if (!binary) return;
	const key = cacheKey(path, await binary.mtime(path), binary.version(path));

	let result = req.cache?.get(key);
	if (!result) {
		result = await binary.extract(path, await binary.read(path));
		if (result.ok) req.cache?.set(key, result);
	}
	if (!result.ok) {
		failed.push({ path, error: result.error });
		return;
	}

	result.value.forEach((line, index) => {
		const spans = matchLine(line.text, req.match);
		if (spans.length === 0) return;
		hits.push({
			path, line: index, text: line.text, spans,
			...(line.location === undefined ? {} : { location: line.location }),
			...(line.anchor === undefined ? {} : { anchor: line.anchor }),
		});
	});
}

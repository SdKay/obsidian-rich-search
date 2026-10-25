import { splitNote, type FencedBlock } from './blocks';
import { isExcalidrawNote, textElementLines } from './excalidraw';
import { isAllowed } from './filter';
import { compile, matchLine } from './match';
import { blockCacheKey, cacheKey } from './providers';
import type { ExtractedLine, ExtractResult } from './richSearchApi';
import type { FileFilter, MatchOptions, SearchHit } from './types';

export interface SearchFile {
	path: string;
}

export interface SearchProgress {
	scanned: number;
	total: number;
	/** The hits found since the last report: each is handed out once, so the receiver appends and never re-reads what it has. */
	newHits: SearchHit[];
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
	/** `signal` is the search's own: a reader that takes long should stop when it is aborted. */
	extract(path: string, bytes: ArrayBuffer, signal?: AbortSignal): Promise<ExtractResult>;
}

/** Reads what a plugin draws inside a fenced block of a note. Same idea as BinaryReader: the Obsidian part stays behind it. */
export interface BlockReader {
	handles(language: string): boolean;
	version(language: string): number;
	extract(path: string, language: string, source: string): Promise<ExtractResult>;
}

export interface SearchRequest {
	files: SearchFile[];
	/** Reads a note's text. Called only for files the path filter allows. */
	read: (path: string) => Promise<string>;
	/** Gives the UI thread a turn: after a stretch of work that took long, and at the latest every `batchSize` files. */
	yieldToUi: () => Promise<void>;
	match: MatchOptions;
	filter: FileFilter;
	blockModes?: Record<string, BlockMode>;
	/** Search a drawing note (`*.excalidraw.md`) by the words in the drawing only, not by its source. */
	excalidraw?: boolean;
	/** Present when a provider can read formats Obsidian cannot. Without it only notes are searched. */
	binary?: BinaryReader;
	/** Present when a provider draws some fenced blocks. Those blocks are searched by what they show, not by their source. */
	blocks?: BlockReader;
	/** Extracted text kept between searches, keyed by path + mtime + provider version. Only successes are kept. */
	cache?: Map<string, ExtractResult>;
	batchSize?: number;
	/** Milliseconds; replaceable so tests need no real waiting. */
	now?: () => number;
	signal?: AbortSignal;
	onProgress?: (progress: SearchProgress) => void;
}

export type SearchResult =
	| { ok: true; hits: SearchHit[]; cancelled: boolean; failed: { path: string; error: string }[] }
	| { ok: false; error: string };

const DEFAULT_BATCH = 50;
/** A slow file must not hold back what was already found: report again once this long has passed. */
const REPORT_EVERY_MS = 100;
/** Work for longer than this and the UI is given a turn, so a few huge notes cannot freeze it the way 50 small ones cannot. */
const YIELD_AFTER_MS = 12;

/** Only Markdown notes have a reader so far; anything else is skipped, never read as raw bytes. */
const isNote = (path: string): boolean => path.toLowerCase().endsWith('.md');

/**
 * Searches notes in batches, yielding between them so a large vault never blocks the UI thread.
 * The path filter runs before anything is read: a file that is filtered out is never opened.
 */
export async function search(req: SearchRequest): Promise<SearchResult> {
	const compiled = compile(req.match);
	if (!compiled.ok) return { ok: false, error: compiled.error };

	const readable = (path: string): boolean => isNote(path) || (req.binary?.handles(path) ?? false);
	const allowed = req.files.filter((f) => readable(f.path) && isAllowed(f.path, req.filter, { excalidraw: req.excalidraw === true }));
	// Notes are quick and documents (a PDF of 1,200 pages) are not: notes go first, so their hits are on screen before the slow reads start.
	const todo = [...allowed.filter((f) => isNote(f.path)), ...allowed.filter((f) => !isNote(f.path))];
	const notes = allowed.length - allowed.filter((f) => !isNote(f.path)).length;
	const batchSize = req.batchSize ?? DEFAULT_BATCH;
	const modes = req.blockModes ?? {};
	const hits: SearchHit[] = [];
	const failed: { path: string; error: string }[] = [];
	let scanned = 0;

	const now = req.now ?? (() => performance.now());
	let lastReport = now();
	let lastTurn = lastReport;
	let reported = 0;
	const report = (): void => {
		req.onProgress?.({ scanned, total: todo.length, newHits: hits.slice(reported) });
		reported = hits.length;
		lastReport = now();
	};

	let sinceTurn = 0;
	for (const file of todo) {
		if (req.signal?.aborted) return { ok: true, hits, cancelled: true, failed };
		try {
			if (isNote(file.path)) await searchNote(file.path, await req.read(file.path), req, modes, hits, failed);
			else await searchProvided(file.path, req, hits, failed);
		} catch (err) {
			failed.push({ path: file.path, error: err instanceof Error ? err.message : String(err) });
		}
		scanned++;
		sinceTurn++;

		const lastNote = scanned === notes && notes < todo.length;
		const last = scanned === todo.length;
		const slow = now() - lastTurn >= YIELD_AFTER_MS;
		if (lastNote || last || slow || sinceTurn >= batchSize || now() - lastReport >= REPORT_EVERY_MS) report();
		if (!last && (slow || sinceTurn >= batchSize)) {
			await req.yieldToUi();
			sinceTurn = 0;
			lastTurn = now();
		}
	}

	return { ok: true, hits, cancelled: req.signal?.aborted ?? false, failed };
}

async function searchNote(
	path: string,
	text: string,
	req: SearchRequest,
	modes: Record<string, BlockMode>,
	hits: SearchHit[],
	failed: { path: string; error: string }[],
): Promise<void> {
	if (req.excalidraw && isExcalidrawNote(path)) {
		for (const { line, text: words } of textElementLines(text)) {
			const spans = matchLine(words, req.match);
			if (spans.length > 0) hits.push({ path, line, text: words, spans });
		}
		return;
	}
	const { lines, blocks } = splitNote(text);
	const skip = new Set<number>();
	const drawn = new Map<number, SearchHit[]>();
	for (const block of blocks) {
		if (modes[block.language] === 'skip') {
			markLines(skip, block);
			continue;
		}
		if (!req.blocks?.handles(block.language)) continue;
		const result = await blockLines(path, block, req.blocks, req.cache);
		if (!result.ok) {
			if (!failed.some((f) => f.path === path)) failed.push({ path, error: result.error });
			continue;
		}
		markLines(skip, block);
		drawn.set(block.fromLine, blockHits(path, block, result.value, req.match));
	}
	lines.forEach((line, index) => {
		const shown = drawn.get(index);
		if (shown) hits.push(...shown);
		if (skip.has(index)) return;
		const spans = matchLine(line, req.match);
		if (spans.length > 0) hits.push({ path, line: index, text: line, spans });
	});
}

/** The fence lines and everything between them. */
function markLines(into: Set<number>, block: FencedBlock): void {
	for (let l = block.fromLine; l <= block.toLine; l++) into.add(l);
}

async function blockLines(path: string, block: FencedBlock, reader: BlockReader, cache: Map<string, ExtractResult> | undefined): Promise<ExtractResult> {
	const key = blockCacheKey(path, block.language, reader.version(block.language), block.source);
	const kept = cache?.get(key);
	if (kept) return kept;
	const result = await reader.extract(path, block.language, block.source);
	if (result.ok) cache?.set(key, result);
	return result;
}

/** The hits of one drawn block: they sit at the block's opening fence and carry which block it is. */
function blockHits(path: string, block: FencedBlock, lines: ExtractedLine[], match: MatchOptions): SearchHit[] {
	const out: SearchHit[] = [];
	for (const line of lines) {
		const spans = matchLine(line.text, match);
		if (spans.length === 0) continue;
		out.push({
			path, line: block.fromLine, text: line.text, spans,
			...(line.location === undefined ? {} : { location: line.location }),
			...(line.anchor === undefined ? {} : { anchor: line.anchor }),
			block: { fromLine: block.fromLine, language: block.language },
		});
	}
	return out;
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
		result = await binary.extract(path, await binary.read(path), req.signal);
		if (result.ok) req.cache?.set(key, result);
		// A read that was cut short is not a file that cannot be read.
		if (!result.ok && req.signal?.aborted) return;
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

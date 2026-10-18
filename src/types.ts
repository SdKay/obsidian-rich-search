/** A half-open character range `[start, end)` within one line. */
export interface Span {
	start: number;
	end: number;
}

/** What the user typed into the search box and its toggles. */
export interface MatchOptions {
	query: string;
	/** Case sensitive. Default false. */
	caseSensitive?: boolean;
	/** Match whole words only. See match.ts for how this treats CJK text. */
	wholeWord?: boolean;
	/** Treat `query` as a regular expression. Default false (literal text). */
	regex?: boolean;
}

/**
 * Which files are searched. Applied to the PATH, before any file is read: reading a large
 * Excalidraw or base64 file only to discard its matches is the cost this plugin exists to avoid.
 *
 * Contract for the filter implementation (not written yet):
 *  - an empty allow list means "everything"; a non-empty one means "only these";
 *  - deny always wins over allow;
 *  - folder entries match the folder and everything below it, compared on whole path segments
 *    (`notes` must not match `notes-old/`); extensions are compared case-insensitively,
 *    with or without the leading dot.
 */
export interface FileFilter {
	allowFolders: string[];
	denyFolders: string[];
	allowExtensions: string[];
	denyExtensions: string[];
}

/** One matching line in one file. Lines and columns are 0-based. */
export interface SearchHit {
	path: string;
	line: number;
	text: string;
	spans: Span[];
	/**
	 * Where the hit sits inside a file that has no lines, e.g. "Sheet1!B4", "slide 3", "Text element".
	 * Absent for ordinary text files. `line` is then the index of the extracted line, not a line of the file.
	 */
	location?: string;
}

/**
 * Turns one non-Markdown file into the text a person would read in it, one entry per line.
 * Searching raw content is wrong for these formats: an Excalidraw file stores compressed base64 and
 * an .xlsx is a zip. A format with no reader is skipped, never searched as bytes.
 *
 * Contract for implementations (none written yet):
 *  - pure: no Obsidian, no I/O of its own; the adapter hands over the file content;
 *  - never throws on a corrupt file: return `{ ok: false, error }` so the search can report and move on;
 *  - may attach a `location` to each line.
 */
export interface FileReader {
	/** Lower-case extensions without the dot, e.g. `['xlsx']`. A compound one like `excalidraw.md` is allowed. */
	extensions: string[];
	/** Whether the reader needs the raw bytes (a zip) rather than text. */
	binary: boolean;
	read(content: string | ArrayBuffer): Result<ExtractedLine[]>;
}

export interface ExtractedLine {
	text: string;
	location?: string;
}

/** Either a result or a user-facing reason it could not be produced (e.g. an invalid regex). */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

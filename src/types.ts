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
 *  - folder scope is set subtraction: (allowFolders, or every folder when it is empty) minus denyFolders;
 *    so a deny entry inside an allowed folder carves it out, one outside every allowed folder changes nothing,
 *    and a deny entry that is a parent of an allowed folder removes it;
 *  - extensions work the same way with allowExtensions / denyExtensions;
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
	/** Opaque to us: whatever the provider attached to the line, handed back unchanged when the hit is opened. */
	anchor?: unknown;
	/**
	 * Set when the line is something a plugin draws inside a fenced block of the note (a table, a diagram) and
	 * not a line of the note. `line` is then the block's opening fence, and the row is opened without a cursor.
	 */
	block?: { fromLine: number; language: string };
}

/** Either a result or a user-facing reason it could not be produced (e.g. an invalid regex). */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

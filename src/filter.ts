import { isExcalidrawNote } from './excalidraw';
import type { FileFilter } from './types';

/** Folder entries as path segments; blank entries and bare slashes mean nothing and are dropped. */
function folderSegments(entries: string[]): string[][] {
	return entries
		.map((e) => e.split('/').filter((s) => s.trim() !== ''))
		.filter((segs) => segs.length > 0);
}

/** `a/b` covers `a/b/...` on whole segments; the file itself is never a folder, so only its parents count. */
function isInside(fileDirs: string[], folder: string[]): boolean {
	return folder.length <= fileDirs.length && folder.every((seg, i) => seg === fileDirs[i]);
}

/** Lower-case, no leading dot; blank or dot-only entries are dropped. */
function normalizeExtensions(entries: string[]): string[] {
	return entries.map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter((e) => e !== '');
}

/** True when the file name ends in `.ext`, so `md` matches `a.md` and `d.excalidraw.md`, never `readmemd`. */
function hasExtension(name: string, ext: string): boolean {
	return name.toLowerCase().endsWith(`.${ext}`) && name.length > ext.length + 1;
}

export interface FilterOptions {
	/** Treat `*.excalidraw.md` as the type `excalidraw` instead of `md`, so the two are chosen separately. */
	excalidraw?: boolean;
}

/**
 * Decides from the path alone whether a file is searched, so a filtered-out file is never read.
 * Each scope is a set subtraction: (the allow list, or everything when it is empty) minus the deny list.
 */
export function isAllowed(path: string, filter: FileFilter, options: FilterOptions = {}): boolean {
	const parts = path.split('/');
	const name = parts[parts.length - 1] ?? '';
	const dirs = parts.slice(0, -1);

	const deniedFolders = folderSegments(filter.denyFolders);
	if (deniedFolders.some((f) => isInside(dirs, f))) return false;
	const allowedFolders = folderSegments(filter.allowFolders);
	if (allowedFolders.length > 0 && !allowedFolders.some((f) => isInside(dirs, f))) return false;

	// With the setting on a drawing is its own type, `excalidraw`, and a plain note is never one.
	const drawing = options.excalidraw === true && isExcalidrawNote(path);
	const inType = (ext: string): boolean => {
		if (options.excalidraw !== true) return hasExtension(name, ext);
		return drawing ? ext === 'excalidraw' : ext !== 'excalidraw' && hasExtension(name, ext);
	};

	const deniedExts = normalizeExtensions(filter.denyExtensions);
	if (deniedExts.some(inType)) return false;
	const allowedExts = normalizeExtensions(filter.allowExtensions);
	if (allowedExts.length > 0 && !allowedExts.some(inType)) return false;

	return true;
}

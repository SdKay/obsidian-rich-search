import type { ExtensionProvider, PluginState } from './providers';
import type { FileFilter } from './types';

/** One file type the settings can show: whether anything can search it, and if not, what is missing. */
export interface FileTypeSource {
	ext: string;
	available: boolean;
	/** Name of the plugin that would make this type searchable, shown when `available` is false. */
	needs?: string;
	/** What to do about an unavailable type: install the plugin, switch it on, or update it. */
	hint?: 'install' | 'enable' | 'update';
}

export interface FileTypeRow extends FileTypeSource {
	/** Whether a search currently includes this type. Never true for an unavailable type. */
	checked: boolean;
}

const norm = (e: string): string => e.trim().replace(/^\./, '').toLowerCase();
const same = (a: string, b: string): boolean => norm(a) === norm(b);

export function fileTypeRows(filter: FileFilter, sources: FileTypeSource[]): FileTypeRow[] {
	return sources.map((s) => {
		const denied = filter.denyExtensions.some((e) => same(e, s.ext));
		const allowed = filter.allowExtensions.length === 0 || filter.allowExtensions.some((e) => same(e, s.ext));
		return { ...s, checked: s.available && !denied && allowed };
	});
}

/** Checking or unchecking one type. Unchecking always denies; checking undoes the deny and any include-list gap. */
export function toggleType(filter: FileFilter, ext: string, checked: boolean): FileFilter {
	const deny = filter.denyExtensions.filter((e) => !same(e, ext));
	const needsAllow = checked && filter.allowExtensions.length > 0 && !filter.allowExtensions.some((e) => same(e, ext));
	return {
		...filter,
		denyExtensions: checked ? deny : [...deny, norm(ext)],
		allowExtensions: needsAllow ? [...filter.allowExtensions, norm(ext)] : [...filter.allowExtensions],
	};
}

/** Select all or deselect all across the listed types; entries for other types are left as they were. */
export function setAllTypes(filter: FileFilter, sources: FileTypeSource[], checked: boolean): FileFilter {
	return sources.reduce((f, s) => toggleType(f, s.ext, checked), filter);
}

export interface TypeSourceOptions {
	/** The "treat .excalidraw.md as a drawing" setting. */
	excalidraw: boolean;
	/** The Excalidraw plugin, which a drawing needs to be shown: running, installed but off, or absent. */
	excalidrawPlugin: PluginState;
}

/**
 * The file types the scope can offer: Markdown always; `.excalidraw` when drawings are treated as their
 * own type; and each format another plugin can read, available when that plugin is installed.
 */
export function buildFileTypeSources(found: ExtensionProvider[], options: TypeSourceOptions): FileTypeSource[] {
	const drawing = options.excalidrawPlugin;
	return [
		{ ext: 'md', available: true },
		...(options.excalidraw
			? [{ ext: 'excalidraw', available: drawing === 'enabled', needs: 'Excalidraw', ...(drawing === 'enabled' ? {} : { hint: drawing === 'disabled' ? 'enable' as const : 'install' as const }) }]
			: []),
		...found.map((f): FileTypeSource => {
			if (f.status === 'available') return { ext: f.ext, available: true };
			const hint = f.status === 'outdated' ? 'update' : f.status === 'disabled' ? 'enable' : 'install';
			return { ext: f.ext, available: false, needs: f.plugin, hint };
		}),
	];
}

/** Whether two type lists would draw the same panel, so a refresh can be skipped when nothing changed. */
export function sameSources(a: FileTypeSource[], b: FileTypeSource[]): boolean {
	return a.length === b.length && a.every((x, i) => {
		const y = b[i];
		return y !== undefined && x.ext === y.ext && x.available === y.available && x.needs === y.needs && x.hint === y.hint;
	});
}

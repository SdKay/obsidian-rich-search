import type { WorkspaceLeaf } from 'obsidian';
import type { ExtractedLine, ExtractResult, RichSearchProvider } from './richSearchApi';
import type { MatchOptions } from './types';

/** The plugins that can supply text for file types Obsidian cannot read, and which extensions each is responsible for. */
export const PROVIDER_PLUGINS = [
	{ id: 'rich-table', name: 'Rich Table', extensions: ['xlsx'] },
	{ id: 'rich-view', name: 'Rich View', extensions: ['drawio', 'pptx', 'vsdx'] },
] as const;

/** The part of Obsidian's (non-public) plugin registry we read. Everything about it is feature-detected. */
export interface PluginsLike {
	/** Plugins that are loaded, by id. */
	plugins?: Record<string, unknown>;
	/** Plugins that are installed, loaded or not, by id. */
	manifests?: Record<string, unknown>;
}

export type PluginState = 'enabled' | 'disabled' | 'missing';

/** Whether a plugin is running, installed but switched off, or not there at all. */
export function pluginState(registry: PluginsLike | undefined, id: string): PluginState {
	const has = (map: Record<string, unknown> | undefined): boolean => map !== undefined && Object.prototype.hasOwnProperty.call(map, id);
	if (has(registry?.plugins)) return 'enabled';
	if (has(registry?.manifests)) return 'disabled';
	return 'missing';
}

export type ProviderStatus = 'available' | 'missing' | 'disabled' | 'outdated';

/** What is known about one file extension: whether text can be extracted for it, and from whom. */
export interface ExtensionProvider {
	ext: string;
	status: ProviderStatus;
	/** Display name of the plugin responsible, for "Needs Rich Table". */
	plugin: string;
	/** False only when the provider says its own file view lost the extension to another plugin. */
	viewRegistered: boolean;
	provider?: RichSearchProvider;
}

const normExt = (e: string): string => e.trim().replace(/^\./, '').toLowerCase();

const isProvider = (v: unknown): v is RichSearchProvider => {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	return Array.isArray(o.extensions) && o.extensions.every((e) => typeof e === 'string')
		&& typeof o.extractVersion === 'number'
		&& typeof o.extract === 'function';
};

function viewRegisteredFor(provider: RichSearchProvider, ext: string): boolean {
	if (typeof provider.viewRegistered !== 'function') return true;
	try {
		return provider.viewRegistered(ext) !== false;
	} catch {
		return true;
	}
}

/**
 * Looks each provider plugin up at call time, never remembering the answer: plugins are enabled and
 * disabled while Obsidian runs. A plugin that is absent, malformed or speaks another apiVersion simply
 * leaves its extensions unavailable.
 */
export function findProviders(registry: PluginsLike | undefined): ExtensionProvider[] {
	const out: ExtensionProvider[] = [];
	for (const entry of PROVIDER_PLUGINS) {
		const raw = (registry?.plugins?.[entry.id] as { richSearch?: unknown } | undefined)?.richSearch;
		const versioned = typeof raw === 'object' && raw !== null ? (raw as { apiVersion?: unknown }).apiVersion : undefined;
		const valid = isProvider(raw) && versioned === 1 ? raw : undefined;
		const served = new Set(valid ? valid.extensions.map(normExt) : []);

		for (const ext of entry.extensions) {
			if (valid && served.has(ext)) {
				out.push({ ext, status: 'available', plugin: entry.name, viewRegistered: viewRegisteredFor(valid, ext), provider: valid });
			} else {
				const outdated = isProvider(raw) && versioned !== 1;
				const state = pluginState(registry, entry.id);
				const status: ProviderStatus = outdated ? 'outdated' : state === 'disabled' ? 'disabled' : 'missing';
				out.push({ ext, status, plugin: entry.name, viewRegistered: true });
			}
		}
	}
	return out;
}

/** A fence language whose content a plugin draws inside notes, and who to ask about it. */
export interface BlockProvider {
	language: string;
	plugin: string;
	provider: RichSearchProvider;
}

const hasBlocks = (p: RichSearchProvider): p is RichSearchProvider & { blockLanguages: unknown[]; extractBlock: NonNullable<RichSearchProvider['extractBlock']> } =>
	Array.isArray(p.blockLanguages) && typeof p.extractBlock === 'function';

/** The fence languages that installed providers render, looked up at call time like findProviders. First plugin in id order wins a language. */
export function findBlockProviders(registry: PluginsLike | undefined): BlockProvider[] {
	const out = new Map<string, BlockProvider>();
	for (const entry of [...PROVIDER_PLUGINS].sort((a, b) => a.id.localeCompare(b.id))) {
		const raw = (registry?.plugins?.[entry.id] as { richSearch?: unknown } | undefined)?.richSearch;
		if (!isProvider(raw) || (raw as { apiVersion?: unknown }).apiVersion !== 1 || !hasBlocks(raw)) continue;
		for (const language of raw.blockLanguages) {
			if (typeof language !== 'string') continue;
			const name = language.trim().toLowerCase();
			if (name !== '' && !out.has(name)) out.set(name, { language: name, plugin: entry.name, provider: raw });
		}
	}
	return [...out.values()];
}

/** Cache key for what a block shows. A block has no modification time of its own, so its source is part of the key. */
export function blockCacheKey(path: string, language: string, extractVersion: number, source: string): string {
	return JSON.stringify(['block', path, language, extractVersion, source]);
}

/** Cache key for extracted text: a changed file, or a provider that now extracts differently, must not hit. */
export function cacheKey(path: string, mtime: number, extractVersion: number): string {
	return JSON.stringify([path, mtime, extractVersion]);
}

/** Asks the provider for text. A provider is outside code: whatever it throws or returns becomes a failure here. */
export async function extractWith(
	entry: ExtensionProvider,
	file: { path: string; content: ArrayBuffer },
): Promise<ExtractResult> {
	if (entry.status !== 'available' || !entry.provider) return { ok: false, error: `${entry.plugin} is not available` };
	try {
		const result: unknown = await entry.provider.extract(file);
		if (isResult(result)) return result;
		return { ok: false, error: `${entry.plugin} returned an unreadable result` };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

function isResult(v: unknown): v is ExtractResult {
	if (typeof v !== 'object' || v === null) return false;
	const o = v as Record<string, unknown>;
	if (o.ok === false) return typeof o.error === 'string';
	if (o.ok !== true || !Array.isArray(o.value)) return false;
	return o.value.every((l) => typeof l === 'object' && l !== null && typeof (l as ExtractedLine).text === 'string');
}

/** Asks the provider for what a block shows. Outside code: whatever it throws or returns becomes a failure. */
export async function extractBlockWith(
	entry: BlockProvider,
	block: { path: string; language: string; source: string },
): Promise<ExtractResult> {
	try {
		const result: unknown = await entry.provider.extractBlock?.(block);
		if (isResult(result)) return result;
		return { ok: false, error: `${entry.plugin} returned an unreadable result` };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/** Asks the provider to show an anchor in the block it drew. False when it cannot or throws: the user is left at the block. */
export async function revealBlockWith(
	entry: BlockProvider,
	leaf: WorkspaceLeaf,
	target: { fromLine: number; anchor: unknown },
	query: MatchOptions,
): Promise<boolean> {
	try {
		return (await entry.provider.revealBlock?.(leaf, target, query)) === true;
	} catch {
		return false;
	}
}

import type { ExtractedLine, ExtractResult, RichSearchProvider } from './richSearchApi';

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

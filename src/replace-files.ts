import { TFile, type App } from 'obsidian';
import { applyReplacements, type ReplaceResult, type Replacement } from './applyreplace';
import type { MatchOptions } from './types';

/**
 * Rewrites the chosen lines of one note. The note is read and written in one step (`Vault.process`), so what is checked
 * is the text on disk now, not what the search saw earlier. A note that is gone or is not a file is reported as skipped.
 */
export async function replaceInNote(app: App, path: string, chosen: readonly Replacement[], opts: MatchOptions, replacement: string): Promise<ReplaceResult> {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) {
		return { text: '', replaced: 0, skipped: chosen.map((c) => ({ line: c.line, reason: 'changed' as const })) };
	}
	let result: ReplaceResult | undefined;
	await app.vault.process(file, (data) => {
		result = applyReplacements(data, chosen, opts, replacement);
		return result.text;
	});
	return result ?? { text: '', replaced: 0, skipped: [] };
}

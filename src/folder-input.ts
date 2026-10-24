import { AbstractInputSuggest, type App } from 'obsidian';
import { suggestFolders } from './folders';

/** Offers the vault's folders under a text box; arrow keys and Enter come from Obsidian's base class. */
class FolderSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, private readonly inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	protected getSuggestions(query: string): string[] {
		return suggestFolders(query, this.app.vault.getAllFolders(false).map((f) => f.path));
	}

	renderSuggestion(path: string, el: HTMLElement): void {
		el.setText(path);
	}

	selectSuggestion(path: string): void {
		this.setValue(path);
		this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
		this.close();
	}
}

/**
 * Makes a folder text box complete from the vault's folders. Returns a function that closes the popup.
 * Dragging a folder in from the file explorer is not supported: Obsidian hands over only its name,
 * which is ambiguous when two folders share it.
 */
export function attachFolderInput(app: App, input: HTMLInputElement): () => void {
	const suggest = new FolderSuggest(app, input);
	return () => suggest.close();
}

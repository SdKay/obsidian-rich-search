/** English: the source of truth. Every other language must define exactly these keys. */
export const en = {
	// Commands
	commandOpenSearch: 'Open search',

	// Settings tab
	settingsFilterHeading: 'Search scope',
	settingsAllowFoldersName: 'Only search these folders',
	settingsAllowFoldersDesc: 'One folder per line. Leave empty to search every folder.',
	settingsDenyFoldersName: 'Never search these folders',
	settingsDenyFoldersDesc: 'One folder per line. Takes priority over the list above.',
	settingsAllowExtensionsName: 'Only search these file types',
	settingsAllowExtensionsDesc: 'One extension per line, for example md. Leave empty to search every type.',
	settingsDenyExtensionsName: 'Never search these file types',
	settingsDenyExtensionsDesc: 'One extension per line. Takes priority over the list above.',

	settingsExcalidrawName: 'Treat .excalidraw.md as Excalidraw drawings',
	settingsExcalidrawDesc: 'Search a drawing by the words in it, and choose it separately from .md under file types. When off, a drawing is an ordinary note and is searched as plain text.',

	settingsMatchColorName: 'Match highlight colour',
	settingsMatchColorDesc: 'The background behind the words that matched your search, in results and in the notes you open.',
	settingsMatchColorReset: 'Reset to default',

	// Search box
	searchPlaceholder: 'Search',
	optionCaseSensitive: 'Match case',
	optionWholeWord: 'Whole word',
	optionRegex: 'Regular expression',

	// Messages with variable parts use {placeholders}; fill them with fmt()
	invalidPattern: 'Invalid pattern: {reason}',
	resultsSummary: '{hits} results in {files} files',
	noResults: 'No results',
	searching: 'Searching {done}/{total}',
	showMore: 'Show {count} more',
	showingOf: 'showing {shown}',
	unreadableFiles: '{count} files could not be read',

	// Search view
	viewTitle: 'Rich search',
	clearQuery: 'Clear',
	removeItem: 'Remove',
	emptyHint: 'Type to search your notes',
	scopeLabel: 'Scope',
	scopeAll: 'All folders and file types',
	scopeSummary: '{inc} included · {exc} excluded · {on}/{total} types',
	scopeIncludeFolders: 'Include folders',
	scopeExcludeFolders: 'Exclude folders',
	scopeFileTypes: 'File types',
	scopeNeeds: 'Needs {plugin}',
	scopeNeedsUpdate: 'Update {plugin}',
	scopeNeedsEnable: 'Enable {plugin}',
	scopeSelectAll: 'Select all',
	scopeDeselectAll: 'Deselect all',
	addFolder: 'Add folder',
	folderPlaceholder: 'Folder path',
	collapseAll: 'Collapse all',
	expandAll: 'Expand all',
	fileGone: 'File not found: {path}',
	openedCannotJump: 'Opened, but this file cannot jump to the match',
} as const;

export type Dict = { [K in keyof typeof en]: string };

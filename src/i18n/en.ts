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

	// Search box
	searchPlaceholder: 'Search',
	optionCaseSensitive: 'Match case',
	optionWholeWord: 'Whole word',
	optionRegex: 'Regular expression',

	// Messages with variable parts use {placeholders}; fill them with fmt()
	invalidPattern: 'Invalid pattern: {reason}',
	resultsSummary: '{hits} results in {files} files',
	noResults: 'No results',
} as const;

export type Dict = { [K in keyof typeof en]: string };

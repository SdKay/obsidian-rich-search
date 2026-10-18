import type { Dict } from './en';

export const zh: Dict = {
	commandOpenSearch: '打开搜索',

	settingsFilterHeading: '搜索范围',
	settingsAllowFoldersName: '只搜索这些目录',
	settingsAllowFoldersDesc: '每行一个目录。留空表示搜索所有目录。',
	settingsDenyFoldersName: '不搜索这些目录',
	settingsDenyFoldersDesc: '每行一个目录。优先于上面的列表。',
	settingsAllowExtensionsName: '只搜索这些文件类型',
	settingsAllowExtensionsDesc: '每行一个扩展名，例如 md。留空表示搜索所有类型。',
	settingsDenyExtensionsName: '不搜索这些文件类型',
	settingsDenyExtensionsDesc: '每行一个扩展名。优先于上面的列表。',

	searchPlaceholder: '搜索',
	optionCaseSensitive: '区分大小写',
	optionWholeWord: '全词匹配',
	optionRegex: '正则表达式',

	invalidPattern: '无效的表达式：{reason}',
	resultsSummary: '{files} 个文件中共 {hits} 条结果',
	noResults: '没有结果',
};

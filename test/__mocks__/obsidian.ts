/**
 * Minimal stand-in for the `obsidian` module so modules that import it can load under vitest.
 * Keep pure logic out of files that need this; test it directly instead. Add a stub here only
 * when a module under test genuinely imports it.
 */
export class Notice {
	static shown: string[] = [];
	constructor(message: string) { Notice.shown.push(message); }
}
export class Plugin {}
export class PluginSettingTab {}

let language = 'en';
export function getLanguage(): string { return language; }
/** Test hook: the Obsidian UI language the code under test sees. */
export function __setLanguage(code: string): void { language = code; }

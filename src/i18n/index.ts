import { getLanguage } from 'obsidian';
import { en, type Dict } from './en';
import { zh } from './zh';

/**
 * Adding a language: create `src/i18n/<code>.ts` typed `Dict` (a missing key fails `tsc`), then add
 * one line here. Nothing else changes: feature code never branches on the language.
 */
const DICTS: Record<string, Dict> = { en, zh };

/** The Obsidian UI language reduced to a key of DICTS; anything unsupported is English. */
export function currentLang(): string {
	const code = getLanguage().toLowerCase().split(/[-_]/)[0] ?? 'en';
	return code in DICTS ? code : 'en';
}

export type I18nKey = keyof typeof en;

export function t(key: I18nKey): string {
	return (DICTS[currentLang()] ?? en)[key];
}

/** Fills `{name}` placeholders in the translated string for `key`; an unknown name stays visible. */
export function fmt(key: I18nKey, vars: Record<string, string | number>): string {
	return t(key).replace(/\{(\w+)\}/g, (whole, name: string) => String(vars[name] ?? whole));
}

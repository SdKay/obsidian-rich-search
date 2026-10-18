import { describe, it, expect, afterEach } from 'vitest';
import { __setLanguage } from 'obsidian';
import { t, fmt, currentLang } from '../src/i18n';
import { en } from '../src/i18n/en';
import { zh } from '../src/i18n/zh';

afterEach(() => __setLanguage('en'));

describe('language resolution', () => {
	it.each([
		['en', 'en'], ['en-GB', 'en'], ['zh', 'zh'], ['zh-TW', 'zh'], ['zh_CN', 'zh'], ['ZH', 'zh'],
		['pt-BR', 'en'], ['ru', 'en'], ['', 'en'],
	])('%s -> %s', (code, expected) => {
		__setLanguage(code);
		expect(currentLang()).toBe(expected);
	});
});

describe('t and fmt', () => {
	it('reads the current language and falls back to English for an unsupported one', () => {
		__setLanguage('zh');
		expect(t('searchPlaceholder')).toBe('搜索');
		__setLanguage('ru');
		expect(t('searchPlaceholder')).toBe('Search');
	});

	it('fills every placeholder, including repeated ones, and leaves an unknown one visible', () => {
		expect(fmt('resultsSummary', { hits: 12, files: 3 })).toBe('12 results in 3 files');
		expect(fmt('resultsSummary', { hits: 12 })).toBe('12 results in {files} files');
	});
});

// The type system already forces every language to define the same keys; these guard what it cannot:
// a translation that dropped or invented a {placeholder}, or was left as an untranslated copy.
describe('dictionaries', () => {
	const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]!).sort();

	it('every language keeps exactly the placeholders of the English string', () => {
		for (const [key, value] of Object.entries(en)) {
			expect(placeholders(zh[key as keyof typeof en]), `zh.${key}`).toEqual(placeholders(value));
		}
	});

	it('no value is empty', () => {
		for (const dict of [en, zh]) for (const [key, value] of Object.entries(dict)) expect(value, key).not.toBe('');
	});
});

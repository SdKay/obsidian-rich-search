import { describe, expect, it } from 'vitest';
import { dictionaryFromVault, type PropertyDictionary } from '../src/propdict';

const notes = (list: Record<string, unknown>[]): Iterable<Record<string, unknown>> => list;

describe('dictionaryFromVault', () => {
	it('lists the properties that appear, once each, in the order they are most used', () => {
		const dict = dictionaryFromVault(notes([{ status: 'a', tags: ['x'] }, { status: 'b' }, { status: 'c', owner: 'me' }]));
		expect(dict.fields().map((f) => f.key)).toEqual(['status', 'tags', 'owner']);
	});

	it('puts the most used property first, not the first one seen', () => {
		const dict = dictionaryFromVault(notes([{ rare: 'x' }, { common: 'a' }, { common: 'b' }, { common: 'c' }, { middling: 'a' }, { middling: 'b' }]));
		expect(dict.fields().map((f) => f.key)).toEqual(['common', 'middling', 'rare']);
	});

	it('does not list a property that is never set in any note', () => {
		const dict = dictionaryFromVault(notes([{ a: null, b: '', c: [], d: { '{ date }': null }, e: 'x' }]));
		expect(dict.fields().map((f) => f.key)).toEqual(['e']);
	});

	it('gives out copies, so a caller that changes a field cannot change the dictionary', () => {
		const dict = dictionaryFromVault(notes([{ a: 'x' }]));
		const first = dict.fields();
		first[0]!.key = 'changed';
		first.push({ key: 'extra', valueType: 'text' });
		expect(dict.fields().map((f) => f.key)).toEqual(['a']);
	});

	it('ignores the case of a name and keeps its most common spelling', () => {
		const dict = dictionaryFromVault(notes([{ Created: 'x' }, { created: 'y' }, { created: 'z' }]));
		expect(dict.fields().map((f) => f.key)).toEqual(['created']);
	});

	it('gives the values a property takes, most used first, once each', () => {
		const dict = dictionaryFromVault(notes([{ status: 'done' }, { status: 'todo' }, { status: 'done' }, { status: 'Done' }]));
		expect(dict.valuesOf('status')?.map((v) => v.value)).toEqual(['done', 'todo']);
	});

	it('reads the elements of a list as values', () => {
		const dict = dictionaryFromVault(notes([{ tags: ['a', 'b'] }, { tags: ['b'] }]));
		expect(dict.valuesOf('tags')?.map((v) => v.value)).toEqual(['b', 'a']);
	});

	it('has no fixed list for a property with too many different values, such as a date or a title', () => {
		const many = Array.from({ length: 80 }, (_, i) => ({ created: `2026-01-${i}` }));
		expect(dictionaryFromVault(notes(many)).valuesOf('created')).toBeUndefined();
	});

	it('has no fixed list for a property that is only ever a date, a number or a boolean', () => {
		const dict = dictionaryFromVault(notes([{ due: '2026-11-03', n: 3, ok: true }, { due: '2026-11-04', n: 4, ok: false }]));
		expect(dict.valuesOf('due')).toBeUndefined();
		expect(dict.valuesOf('n')).toBeUndefined();
		expect(dict.valuesOf('ok')).toBeUndefined();
	});

	it('reads a property by name without regard to case', () => {
		const dict = dictionaryFromVault(notes([{ Status: 'done' }]));
		expect(dict.valuesOf('STATUS')?.map((v) => v.value)).toEqual(['done']);
	});

	it('has no list for a property it has not seen', () => {
		expect(dictionaryFromVault(notes([{ a: 'x' }])).valuesOf('nope')).toBeUndefined();
	});

	it('leaves out what is not set, and a note with no properties', () => {
		const dict = dictionaryFromVault(notes([{}, { a: null, b: '', c: [], d: { '{ date }': null } }, { a: 'x' }]));
		expect(dict.fields().map((f) => f.key)).toContain('a');
		expect(dict.valuesOf('a')?.map((v) => v.value)).toEqual(['x']);
		expect(dict.valuesOf('b')).toBeUndefined();
	});

	it('offers no colour, solid flag or description: the vault does not know them', () => {
		const v = dictionaryFromVault(notes([{ s: 'a' }])).valuesOf('s')?.[0];
		expect(v).toEqual({ value: 'a' });
	});

	it('says what kind a property looks like, so the row can offer the right operators', () => {
		const dict = dictionaryFromVault(notes([{ tags: ['a'], n: 1, ok: true, due: '2026-11-03', at: '2026-11-03 10:00:00', t: 'text' }]));
		const kind = Object.fromEntries(dict.fields().map((f) => [f.key, f.valueType]));
		expect(kind).toEqual({ tags: 'list', n: 'number', ok: 'boolean', due: 'date', at: 'datetime', t: 'text' });
	});

	it('calls a property that varies in shape text, the safest reading', () => {
		const dict = dictionaryFromVault(notes([{ year: '2024' }, { year: 2024 }, { year: 'n/a' }]));
		expect(dict.fields().find((f) => f.key === 'year')?.valueType).toBe('text');
	});

	it('reads a number kept as a string and a number alike, because that is how the matcher reads them', () => {
		const dict = dictionaryFromVault(notes([{ year: '2024' }, { year: 2025 }]));
		expect(dict.fields().find((f) => f.key === 'year')?.valueType).toBe('number');
	});

	it('has an onChange that can be stopped', () => {
		const dict: PropertyDictionary = dictionaryFromVault(notes([]));
		const stop = dict.onChange(() => undefined);
		expect(typeof stop).toBe('function');
		expect(() => stop()).not.toThrow();
	});

	it('is empty for an empty vault, which is a normal answer', () => {
		const dict = dictionaryFromVault(notes([]));
		expect(dict.fields()).toEqual([]);
		expect(dict.valuesOf('x')).toBeUndefined();
	});
});

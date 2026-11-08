import { afterEach, describe, expect, it } from 'vitest';
import { cloneConditions, matchesAll, readConditions, readNumber, sameConditions, type PropertyCondition } from '../src/properties';

const c = (key: string, op: PropertyCondition['op'], ...values: string[]): PropertyCondition => ({ key, op, values });
const original = process.env.TZ;
afterEach(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });

describe('is / isNot / in', () => {
	it('is: equal text, without regard to case', () => {
		expect(matchesAll({ status: 'Done' }, [c('status', 'is', 'done')])).toBe(true);
		expect(matchesAll({ status: 'todo' }, [c('status', 'is', 'done')])).toBe(false);
	});

	it('is: a list holds it when any element is equal', () => {
		expect(matchesAll({ tags: ['a', 'Work'] }, [c('tags', 'is', 'work')])).toBe(true);
		expect(matchesAll({ tags: ['a', 'b'] }, [c('tags', 'is', 'work')])).toBe(false);
	});

	it('isNot: true when no element is equal, and true when the property is missing', () => {
		expect(matchesAll({ tags: ['a', 'b'] }, [c('tags', 'isNot', 'work')])).toBe(true);
		expect(matchesAll({ tags: ['a', 'Work'] }, [c('tags', 'isNot', 'work')])).toBe(false);
		expect(matchesAll({}, [c('tags', 'isNot', 'work')])).toBe(true);
	});

	it('in: any of the values', () => {
		expect(matchesAll({ status: 'doing' }, [c('status', 'in', 'todo', 'doing')])).toBe(true);
		expect(matchesAll({ status: 'done' }, [c('status', 'in', 'todo', 'doing')])).toBe(false);
		expect(matchesAll({ tags: ['x', 'doing'] }, [c('tags', 'in', 'todo', 'doing')])).toBe(true);
	});

	it('is never holds for a property the note does not have', () => {
		expect(matchesAll({}, [c('status', 'is', 'done')])).toBe(false);
		expect(matchesAll({}, [c('status', 'in', 'done')])).toBe(false);
	});

	it('reads a number or a boolean as its text', () => {
		expect(matchesAll({ schema: 1 }, [c('schema', 'is', '1')])).toBe(true);
		expect(matchesAll({ 'ai-first': true }, [c('ai-first', 'is', 'TRUE')])).toBe(true);
		expect(matchesAll({ 'ai-first': false }, [c('ai-first', 'is', 'false')])).toBe(true);
	});

	it('an empty value list never matches', () => {
		expect(matchesAll({ status: 'done' }, [{ key: 'status', op: 'is', values: [] }])).toBe(false);
		expect(matchesAll({ status: 'done' }, [{ key: 'status', op: 'in' }])).toBe(false);
	});
});

describe('set / unset', () => {
	it('set: has something a person would call a value', () => {
		expect(matchesAll({ a: 'x' }, [c('a', 'set')])).toBe(true);
		expect(matchesAll({ a: 0 }, [c('a', 'set')])).toBe(true);
		expect(matchesAll({ a: false }, [c('a', 'set')])).toBe(true);
	});

	it('unset: missing, null, empty string, empty list and an object all count', () => {
		for (const value of [undefined, null, '', [], { '{ date }': null }]) {
			const fm = value === undefined ? {} : { a: value };
			expect(matchesAll(fm, [c('a', 'unset')]), JSON.stringify(value)).toBe(true);
			expect(matchesAll(fm, [c('a', 'set')]), JSON.stringify(value)).toBe(false);
		}
	});
});

describe('property names', () => {
	it('match without regard to case', () => {
		expect(matchesAll({ Status: 'done' }, [c('status', 'is', 'done')])).toBe(true);
		expect(matchesAll({ status: 'done' }, [c('STATUS', 'is', 'done')])).toBe(true);
	});

	it('read created and Created as one property: every spelling counts', () => {
		const fm = { created: '2026-11-01', Created: '2026-12-01' };
		expect(matchesAll(fm, [c('created', 'is', '2026-12-01')])).toBe(true);
		expect(matchesAll(fm, [c('created', 'is', '2026-11-01')])).toBe(true);
		expect(matchesAll(fm, [c('created', 'is', '2027-01-01')])).toBe(false);
	});

	it('a note whose only spelling is the other case still has it', () => {
		expect(matchesAll({ Modified: '2026-11-01' }, [c('modified', 'set')])).toBe(true);
	});
});

describe('numbers', () => {
	it('readNumber takes a number, or a string that is entirely one', () => {
		expect(readNumber(2024)).toBe(2024);
		expect(readNumber('2024')).toBe(2024);
		expect(readNumber('-3')).toBe(-3);
		expect(readNumber('1.5')).toBe(1.5);
		expect(readNumber(' 7 ')).toBe(7);
	});

	it('readNumber refuses the rest', () => {
		for (const v of ['2024年', '12abc', '', ' ', 'abc', '1,5', '1e', 'Infinity', 'NaN', NaN, Infinity, true, null, undefined, {}, [], '0x10']) {
			expect(readNumber(v), String(v)).toBeUndefined();
		}
	});

	it('compares a string and a number alike, so quotes in the note do not matter', () => {
		expect(matchesAll({ year: '2024' }, [c('year', 'gte', '2024')])).toBe(true);
		expect(matchesAll({ year: 2024 }, [c('year', 'gte', '2024')])).toBe(true);
		expect(matchesAll({ year: '2023' }, [c('year', 'gt', '2023')])).toBe(false);
		expect(matchesAll({ year: 2025 }, [c('year', 'gt', '2024')])).toBe(true);
	});

	it('compares as numbers, not as text: 10 is more than 9', () => {
		expect(matchesAll({ n: 10 }, [c('n', 'gt', '9')])).toBe(true);
		expect(matchesAll({ n: '10' }, [c('n', 'lt', '9')])).toBe(false);
	});

	it('lt and lte', () => {
		expect(matchesAll({ n: 3 }, [c('n', 'lt', '4')])).toBe(true);
		expect(matchesAll({ n: 4 }, [c('n', 'lt', '4')])).toBe(false);
		expect(matchesAll({ n: 4 }, [c('n', 'lte', '4')])).toBe(true);
	});

	it('a comparison holds when any element of a list satisfies it', () => {
		expect(matchesAll({ n: [1, 5] }, [c('n', 'gt', '4')])).toBe(true);
		expect(matchesAll({ n: [1, 2] }, [c('n', 'gt', '4')])).toBe(false);
	});

	it('does not hold for a value that is not a number, or a missing property', () => {
		expect(matchesAll({ year: '2024年' }, [c('year', 'gte', '2000')])).toBe(false);
		expect(matchesAll({}, [c('year', 'gte', '2000')])).toBe(false);
		expect(matchesAll({ year: null }, [c('year', 'lte', '3000')])).toBe(false);
	});

	it('does not hold when the condition value is not a number', () => {
		expect(matchesAll({ year: 2024 }, [c('year', 'gt', 'abc')])).toBe(false);
		expect(matchesAll({ year: 2024 }, [{ key: 'year', op: 'gt' }])).toBe(false);
	});
});

describe('dates', () => {
	it('a date written without a time compares by calendar day', () => {
		expect(matchesAll({ due: '2026-11-03' }, [c('due', 'lte', '2026-11-03')])).toBe(true);
		expect(matchesAll({ due: '2026-11-04' }, [c('due', 'lte', '2026-11-03')])).toBe(false);
		expect(matchesAll({ due: '2026-11-03' }, [c('due', 'gte', '2026-11-03')])).toBe(true);
	});

	it('a value with a time is compared by instant, with a space or a T', () => {
		expect(matchesAll({ created: '2026-11-01 10:00:00' }, [c('created', 'gt', '2026-11-01 09:59:59')])).toBe(true);
		expect(matchesAll({ created: '2026-11-01T10:00:00' }, [c('created', 'lt', '2026-11-01 10:00:01')])).toBe(true);
		expect(matchesAll({ created: '2026-11-01 10:00:00' }, [c('created', 'lt', '2026-11-01 10:00:00')])).toBe(false);
	});

	it('a time-of-day on a date-only condition value starts at midnight, so a later time on that day is later', () => {
		expect(matchesAll({ created: '2026-11-03 14:00:00' }, [c('created', 'gt', '2026-11-03')])).toBe(true);
	});

	it('is and isNot on a date compare the calendar day', () => {
		expect(matchesAll({ due: '2026-11-03' }, [c('due', 'is', '2026-11-03')])).toBe(true);
		expect(matchesAll({ due: '2026-11-03 18:30:00' }, [c('due', 'is', '2026-11-03')])).toBe(true);
		expect(matchesAll({ due: '2026-11-04' }, [c('due', 'is', '2026-11-03')])).toBe(false);
	});

	it('is, isNot and in against a date condition read the whole value or nothing: a date-range is plain text', () => {
		const range = { range: '2026-11-03 ~ 2026-11-10' };
		expect(matchesAll(range, [c('range', 'is', '2026-11-03')])).toBe(false);
		expect(matchesAll(range, [c('range', 'is', '2026-11-10')])).toBe(false);
		expect(matchesAll(range, [c('range', 'is', '2026-11-03 ~ 2026-11-10')])).toBe(true);
		expect(matchesAll(range, [c('range', 'isNot', '2026-11-03')])).toBe(true);
	});

	it('each value of an in is judged on its own: a plain date by day, a timed one by instant', () => {
		const note = { at: '2026-11-03 18:30:00' };
		expect(matchesAll(note, [c('at', 'in', '2026-11-03')])).toBe(true);
		expect(matchesAll(note, [c('at', 'in', '2026-11-05', '2026-11-03')])).toBe(true);
		expect(matchesAll(note, [c('at', 'in', '2026-11-03 18:30:00')])).toBe(true);
		expect(matchesAll(note, [c('at', 'in', '2026-11-03 18:30:01')])).toBe(false);
		expect(matchesAll(note, [c('at', 'in', '2026-11-05', '2026-11-03 18:30:01')])).toBe(false);
	});

	it('a timed condition against a note value with no time reads that value as local midnight', () => {
		expect(matchesAll({ due: '2026-11-03' }, [c('due', 'is', '2026-11-03 00:00:00')])).toBe(true);
		expect(matchesAll({ due: '2026-11-03' }, [c('due', 'is', '2026-11-03 00:00:01')])).toBe(false);
	});

	it('isNot is the opposite of is on a date, and a list holds when any element does', () => {
		expect(matchesAll({ at: '2026-11-03 18:30:00' }, [c('at', 'isNot', '2026-11-03')])).toBe(false);
		expect(matchesAll({ at: '2026-11-04 09:00:00' }, [c('at', 'isNot', '2026-11-03')])).toBe(true);
		expect(matchesAll({ at: ['2026-11-01', '2026-11-03 07:00:00'] }, [c('at', 'is', '2026-11-03')])).toBe(true);
	});

	it('does not hold for a value that is no date', () => {
		expect(matchesAll({ due: 'next week' }, [c('due', 'gte', '2026-01-01')])).toBe(false);
		expect(matchesAll({ due: { '{ date }': null } }, [c('due', 'gte', '2026-01-01')])).toBe(false);
	});

	it('local time depends on the machine, an offset does not', () => {
		// 2026-11-03 07:00 written without a zone is 2026-11-02 23:00 UTC in Shanghai and 2026-11-03 07:00 UTC in UTC.
		process.env.TZ = 'Asia/Shanghai';
		expect(matchesAll({ at: '2026-11-03 07:00:00' }, [c('at', 'lt', '2026-11-03T00:00:00Z')])).toBe(true);
		expect(matchesAll({ at: '2026-11-03 07:00:00' }, [c('at', 'gt', '2026-11-02T22:00:00Z')])).toBe(true);
		process.env.TZ = 'UTC';
		expect(matchesAll({ at: '2026-11-03 07:00:00' }, [c('at', 'lt', '2026-11-03T00:00:00Z')])).toBe(false);
		expect(matchesAll({ at: '2026-11-03 07:00:00' }, [c('at', 'gt', '2026-11-03T06:00:00Z')])).toBe(true);
		// A value written with an offset means the same instant wherever the machine is.
		for (const tz of ['Asia/Shanghai', 'UTC', 'America/New_York']) {
			process.env.TZ = tz;
			expect(matchesAll({ at: '2026-11-03T07:00:00+08:00' }, [c('at', 'lt', '2026-11-02T23:00:01Z')]), tz).toBe(true);
			expect(matchesAll({ at: '2026-11-03T07:00:00+08:00' }, [c('at', 'gt', '2026-11-02T22:59:59Z')]), tz).toBe(true);
		}
	});
});

describe('valueType decides how a comparison reads a value', () => {
	it('a number-typed property reads "2024" as a number even if it looks like a date', () => {
		expect(matchesAll({ x: '2024' }, [c('x', 'gt', '3')], { x: 'number' })).toBe(true);
	});

	it('a text-typed property is never compared as a number or date', () => {
		expect(matchesAll({ range: '2026-11-02 ~ 2026-11-08' }, [c('range', 'gt', '2026-01-01')], { range: 'text' })).toBe(false);
		expect(matchesAll({ x: '5' }, [c('x', 'gt', '3')], { x: 'text' })).toBe(false);
	});

	it('a date-typed property compares by calendar day, a datetime-typed one by instant', () => {
		expect(matchesAll({ d: '2026-11-03 23:59:59' }, [c('d', 'lte', '2026-11-03')], { d: 'date' })).toBe(true);
		expect(matchesAll({ d: '2026-11-03 23:59:59' }, [c('d', 'lte', '2026-11-03')], { d: 'datetime' })).toBe(false);
	});

	it('the type is looked up without regard to the case of the name', () => {
		expect(matchesAll({ X: '5' }, [c('x', 'gt', '3')], { x: 'number' })).toBe(true);
	});

	it('an unknown type is read as text', () => {
		expect(matchesAll({ x: '5' }, [c('x', 'gt', '3')], { x: 'weird' as never })).toBe(false);
	});
});

describe('all conditions together', () => {
	it('every condition must hold', () => {
		const fm = { type: 'task', status: 'doing', year: 2026 };
		expect(matchesAll(fm, [c('type', 'is', 'task'), c('status', 'in', 'todo', 'doing'), c('year', 'gte', '2026')])).toBe(true);
		expect(matchesAll(fm, [c('type', 'is', 'task'), c('status', 'is', 'done')])).toBe(false);
	});

	it('no conditions holds for every note', () => {
		expect(matchesAll({}, [])).toBe(true);
	});

	it('between is two conditions on one property', () => {
		const between = [c('year', 'gte', '2020'), c('year', 'lte', '2024')];
		expect(matchesAll({ year: 2022 }, between)).toBe(true);
		expect(matchesAll({ year: 2025 }, between)).toBe(false);
	});
});

describe('readConditions: conditions read back from saved data', () => {
	it('is empty when the data has none, so an older saved search still loads', () => {
		for (const raw of [undefined, null, [], 'x', 5, {}]) expect(readConditions(raw)).toEqual([]);
	});

	it('keeps well-formed conditions', () => {
		const raw = [{ key: 'status', op: 'in', values: ['todo', 'doing'] }, { key: 'owner', op: 'unset' }];
		expect(readConditions(raw)).toEqual([{ key: 'status', op: 'in', values: ['todo', 'doing'] }, { key: 'owner', op: 'unset' }]);
	});

	it('drops one that is malformed and keeps the rest, rather than losing the whole search', () => {
		const raw = [
			{ key: 'a', op: 'is', values: ['x'] },
			{ key: '', op: 'is', values: ['x'] },
			{ key: 'b', op: 'between', values: ['x'] },
			{ key: 'c', op: 'is', values: 'x' },
			{ key: 'd', op: 'is', values: [1] },
			null, 5, 'z',
			{ key: 'e', op: 'set' },
		];
		expect(readConditions(raw)).toEqual([{ key: 'a', op: 'is', values: ['x'] }, { key: 'e', op: 'set' }]);
	});

	it('does not share the saved objects, so editing a row cannot change what was saved', () => {
		const raw = [{ key: 'a', op: 'in', values: ['x'] }];
		const out = readConditions(raw);
		out[0]?.values?.push('y');
		expect(raw[0]?.values).toEqual(['x']);
	});
});

describe('cloneConditions and sameConditions', () => {
	const a: PropertyCondition[] = [{ key: 'status', op: 'in', values: ['todo', 'doing'] }, { key: 'owner', op: 'unset' }];

	it('clone is equal but not shared', () => {
		const b = cloneConditions(a);
		expect(sameConditions(a, b)).toBe(true);
		b[0]?.values?.push('x');
		expect(a[0]?.values).toEqual(['todo', 'doing']);
	});

	it('differ by key, operator, a value, the order of values, or the number of conditions', () => {
		expect(sameConditions(a, [{ ...a[0]!, key: 'other' }, a[1]!])).toBe(false);
		expect(sameConditions(a, [{ ...a[0]!, op: 'is' }, a[1]!])).toBe(false);
		expect(sameConditions(a, [{ ...a[0]!, values: ['todo'] }, a[1]!])).toBe(false);
		expect(sameConditions(a, [{ ...a[0]!, values: ['doing', 'todo'] }, a[1]!])).toBe(false);
		expect(sameConditions(a, [a[0]!])).toBe(false);
		// And the other way round: a longer list is not the same as a shorter one it starts with.
		expect(sameConditions([a[0]!], a)).toBe(false);
		expect(sameConditions([{ ...a[0]!, values: ['todo'] }], [a[0]!])).toBe(false);
		expect(sameConditions([{ ...a[0]!, values: ['todo'] }], [{ ...a[0]!, values: ['todo', 'doing'] }])).toBe(false);
	});

	it('treats a missing values list and an empty one as the same', () => {
		expect(sameConditions([{ key: 'k', op: 'set' }], [{ key: 'k', op: 'set', values: [] }])).toBe(true);
	});

	it('copies a missing list as an empty one, so a filter built by older code does not crash', () => {
		expect(cloneConditions(undefined)).toEqual([]);
	});

	it('compares a missing list as an empty one', () => {
		expect(sameConditions(undefined, [])).toBe(true);
		expect(sameConditions([], undefined)).toBe(true);
		expect(sameConditions(undefined, a)).toBe(false);
		expect(sameConditions(a, undefined)).toBe(false);
	});

	it('two empty lists are the same', () => {
		expect(sameConditions([], [])).toBe(true);
	});
});

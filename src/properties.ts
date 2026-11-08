import { compareDays, compareInstants, parseDate, type ParsedDate } from './propdate';
import { isSet, textsOf } from './propvalue';

export type Operator = 'is' | 'isNot' | 'in' | 'set' | 'unset' | 'gt' | 'gte' | 'lt' | 'lte';

/** One row of the property scope. `values` is empty for `set` and `unset`. */
export interface PropertyCondition {
	key: string;
	op: Operator;
	values?: string[];
}

/** What a property is, as Rich Property reports it. Without it, a value is read by what it looks like. */
export type ValueType = 'text' | 'list' | 'number' | 'boolean' | 'date' | 'datetime';
export type ValueTypes = Record<string, ValueType | undefined>;

const lower = (s: string): string => s.trim().toLowerCase();

/** A number, or a string that is entirely one (`"2024"`, `"-3"`, `"1.5"`). `"2024年"`, `""` and `"0x10"` are not. */
export function readNumber(value: unknown): number | undefined {
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	if (typeof value !== 'string') return undefined;
	const text = value.trim();
	return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : undefined;
}

/** The values of every key that names this property, whatever its case: `created` and `Created` are one property. */
function valuesOfKey(frontmatter: Record<string, unknown>, key: string): unknown[] {
	const wanted = lower(key);
	const out: unknown[] = [];
	for (const [name, value] of Object.entries(frontmatter)) if (lower(name) === wanted) out.push(value);
	return out;
}

/** Every element a comparison may look at: the elements of a list, or the value itself. */
function elementsOf(values: readonly unknown[]): unknown[] {
	const out: unknown[] = [];
	for (const value of values) {
		if (Array.isArray(value)) for (const element of value) out.push(Array.isArray(element) ? element[0] : element);
		else out.push(value);
	}
	return out;
}

type Kind = 'number' | 'date' | 'datetime' | 'none';

const HAS_TIME = /[ T]\d{2}:\d{2}/;

/** Which way one value is compared. A declared type decides; without one, the value itself does (contract section 5). */
function kindOf(type: ValueType | undefined, element: unknown): Kind {
	if (type === 'number') return 'number';
	if (type === 'date') return 'date';
	if (type === 'datetime') return 'datetime';
	if (type !== undefined) return 'none';
	if (readNumber(element) !== undefined && !(typeof element === 'string' && parseDate(element))) return 'number';
	if (typeof element === 'string' && parseDate(element)) return HAS_TIME.test(element) ? 'datetime' : 'date';
	// Not a number or a date by its own look: nothing to compare.
	return 'none';
}

function compareValue(type: ValueType | undefined, element: unknown, condition: string, op: 'gt' | 'gte' | 'lt' | 'lte'): boolean {
	const kind = kindOf(type, element);
	let order: number;
	if (kind === 'number') {
		const left = readNumber(element);
		const right = readNumber(condition);
		if (left === undefined || right === undefined) return false;
		order = left - right;
	} else if (kind === 'date' || kind === 'datetime') {
		if (typeof element !== 'string') return false;
		const left: ParsedDate | undefined = parseDate(element);
		const right: ParsedDate | undefined = parseDate(condition);
		if (!left || !right) return false;
		order = kind === 'date' ? compareDays(left, right) : compareInstants(left, right);
	} else {
		return false;
	}
	return op === 'gt' ? order > 0 : op === 'gte' ? order >= 0 : op === 'lt' ? order < 0 : order <= 0;
}

/**
 * Whether one value of the note equals one value of the condition. Text is equal without regard to case. When both are
 * whole dates, a plain date in the condition means the calendar day and a timed one means that instant, so
 * `created is 2026-11-03` finds `created: "2026-11-03 18:30:00"`. Only a whole string is a date: a `date-range` is text.
 */
function sameValue(text: string, wanted: string): boolean {
	if (text === wanted) return true;
	const left = parseDate(text);
	const right = parseDate(wanted);
	if (!left || !right) return false;
	return HAS_TIME.test(wanted) ? compareInstants(left, right) === 0 : compareDays(left, right) === 0;
}

function matches(frontmatter: Record<string, unknown>, condition: PropertyCondition, types: ValueTypes): boolean {
	const values = valuesOfKey(frontmatter, condition.key);
	const wanted = (condition.values ?? []).map(lower);
	const texts = values.flatMap((v) => textsOf(v).map(lower));
	const hasAny = (): boolean => texts.some((t) => wanted.some((w) => sameValue(t, w)));

	const op = condition.op;
	switch (op) {
		case 'set': return values.some(isSet);
		case 'unset': return !values.some(isSet);
		case 'is':
		case 'in': return hasAny();
		case 'isNot': return !hasAny();
		case 'gt':
		case 'gte':
		case 'lt':
		case 'lte': {
			const target = condition.values?.[0];
			if (target === undefined) return false;
			const type = types[lower(condition.key)] ?? types[condition.key];
			return elementsOf(values).some((element) => compareValue(type, element, target, op));
		}
	}
}

/**
 * Whether a note's frontmatter satisfies every condition. Names and values are compared without regard to case. `types`
 * holds the declared type of a property, keyed by its name in lower case; an unknown or missing type is read by what the
 * condition's value looks like. No conditions hold for every note.
 */
export function matchesAll(frontmatter: Record<string, unknown>, conditions: readonly PropertyCondition[], types: ValueTypes = {}): boolean {
	return conditions.every((condition) => matches(frontmatter, condition, types));
}

const OPERATORS: readonly Operator[] = ['is', 'isNot', 'in', 'set', 'unset', 'gt', 'gte', 'lt', 'lte'];

/**
 * The conditions in saved data (a search in the history, the settings file), which may be old or edited by hand. A search
 * saved before conditions existed has none and gives an empty list; one malformed condition is dropped and the others are
 * kept, so a bad entry never costs the user the rest of a saved search. Returns copies.
 */
export function readConditions(raw: unknown): PropertyCondition[] {
	if (!Array.isArray(raw)) return [];
	const out: PropertyCondition[] = [];
	for (const item of raw as unknown[]) {
		if (typeof item !== 'object' || item === null) continue;
		const o = item as Record<string, unknown>;
		if (typeof o.key !== 'string' || o.key.trim() === '') continue;
		if (typeof o.op !== 'string' || !OPERATORS.includes(o.op as Operator)) continue;
		if (o.values !== undefined && !(Array.isArray(o.values) && o.values.every((v) => typeof v === 'string'))) continue;
		out.push({ key: o.key, op: o.op as Operator, ...(o.values === undefined ? {} : { values: [...o.values] }) });
	}
	return out;
}

/** A copy. A filter that has no conditions at all (built by older code) copies as an empty list rather than failing. */
export function cloneConditions(conditions: readonly PropertyCondition[] | undefined): PropertyCondition[] {
	return (conditions ?? []).map((c) => ({ key: c.key, op: c.op, ...(c.values === undefined ? {} : { values: [...c.values] }) }));
}

/** Whether two lists would filter the same: same rows in the same order. A missing `values` and an empty one are the same. */
export function sameConditions(first: readonly PropertyCondition[] | undefined, second: readonly PropertyCondition[] | undefined): boolean {
	const a = first ?? [];
	const b = second ?? [];
	return a.length === b.length && a.every((c, i) => {
		const d = b[i];
		const left = c.values ?? [];
		const right = d?.values ?? [];
		return d !== undefined && c.key === d.key && c.op === d.op && left.length === right.length && left.every((v, j) => v === right[j]);
	});
}

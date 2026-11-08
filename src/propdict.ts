import { parseDate } from './propdate';
import { readNumber, type ValueType } from './properties';
import { textsOf } from './propvalue';

/**
 * What the property row needs to offer choices. The shape is the one Rich Property's API will give (the property API
 * contract, section 2), so the row is written once and the source behind it can change. Until that API exists the source
 * is the vault itself, below.
 */
export interface PropertyField {
	key: string;
	valueType: ValueType;
	description?: string;
	types?: string[];
}

export interface PropertyValueOption {
	value: string;
	color?: string;
	solid?: boolean;
	description?: string;
}

export interface PropertyDictionary {
	fields(): PropertyField[];
	/** The values to offer for a property, or undefined when there is no fixed list. */
	valuesOf(key: string, type?: string): PropertyValueOption[] | undefined;
	onChange(listener: () => void): () => void;
}

/** More different values than this and the property is not a choice from a list (a date, a title). */
export const MAX_CHOICES = 50;

const lower = (s: string): string => s.trim().toLowerCase();

type Shape = 'list' | 'number' | 'boolean' | 'date' | 'datetime' | 'text';

function shapeOf(value: unknown): Shape | undefined {
	if (Array.isArray(value)) return textsOf(value).length > 0 ? 'list' : undefined;
	if (typeof value === 'boolean') return 'boolean';
	if (typeof value === 'number') return Number.isFinite(value) ? 'number' : undefined;
	if (typeof value !== 'string' || value.trim() === '') return undefined;
	if (parseDate(value)) return /[ T]\d{2}:\d{2}/.test(value) ? 'datetime' : 'date';
	return readNumber(value) !== undefined ? 'number' : 'text';
}

interface Seen {
	spellings: Map<string, number>;
	values: Map<string, { text: string; count: number }>;
	shapes: Set<Shape>;
	uses: number;
}

/**
 * A dictionary read off the vault's own notes. It knows which properties exist and which values they take, but it cannot
 * tell a legal value from a misspelling or an old one, and it has no colours or descriptions. It stands in until a real
 * dictionary (Rich Property's) is available; the property row does not care which one it has.
 */
export function dictionaryFromVault(frontmatters: Iterable<Record<string, unknown>>): PropertyDictionary {
	const seen = new Map<string, Seen>();
	for (const frontmatter of frontmatters) {
		for (const [name, value] of Object.entries(frontmatter)) {
			const shape = shapeOf(value);
			if (shape === undefined) continue;
			const key = lower(name);
			const entry: Seen = seen.get(key) ?? { spellings: new Map<string, number>(), values: new Map<string, { text: string; count: number }>(), shapes: new Set<Shape>(), uses: 0 };
			entry.uses++;
			entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
			entry.shapes.add(shape);
			for (const text of textsOf(value)) {
				const folded = lower(text);
				const known = entry.values.get(folded);
				if (known) known.count++;
				else entry.values.set(folded, { text, count: 1 });
			}
			seen.set(key, entry);
		}
	}

	const mostUsed = <T>(map: Map<string, T>, count: (v: T) => number): string[] =>
		[...map.entries()].sort((a, b) => count(b[1]) - count(a[1])).map(([k]) => k);

	const typeOf = (entry: Seen): ValueType => {
		const shapes = [...entry.shapes];
		// A number written as text and a number are one shape to the matcher; so are a date and a timed date to the reader.
		return shapes.length === 1 ? (shapes[0] as ValueType) : 'text';
	};

	const fields: PropertyField[] = [...seen.entries()]
		.sort((a, b) => b[1].uses - a[1].uses)
		.map(([, entry]) => ({ key: mostUsed(entry.spellings, (n) => n)[0] ?? '', valueType: typeOf(entry) }));

	return {
		fields: () => fields.map((f) => ({ ...f })),
		valuesOf(key) {
			const entry = seen.get(lower(key));
			if (!entry || entry.values.size === 0 || entry.values.size > MAX_CHOICES) return undefined;
			const type = typeOf(entry);
			// A date, a number or a yes/no is entered, not picked from what happens to be in the notes.
			if (type !== 'text' && type !== 'list') return undefined;
			return mostUsed(entry.values, (v) => v.count).map((folded) => ({ value: entry.values.get(folded)?.text ?? folded }));
		},
		onChange: () => () => undefined,
	};
}

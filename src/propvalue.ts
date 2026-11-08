/**
 * Frontmatter comes from YAML, so one property can be a string in one note and a list, a number or a boolean in another
 * (a vault of 800 notes had `year` as both a string and a number). These two functions are how every other part reads a
 * value: they never throw, whatever the shape.
 */

/** One scalar as the text a person would see, or undefined when it is not one. */
function scalarText(value: unknown): string | undefined {
	if (typeof value === 'string') return value === '' ? undefined : value;
	if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
	if (typeof value === 'boolean') return String(value);
	return undefined;
}

/**
 * The strings a value stands for, in order. A list gives one per readable element. An element that is itself a list is read
 * as its first element (a bare `[[link]]` is expected to parse that way). An object, null, an empty string and anything
 * else give nothing. Walks with a loop, not recursion, so a hostile or broken note cannot exhaust the stack.
 */
export function textsOf(value: unknown): string[] {
	if (!Array.isArray(value)) {
		const one = scalarText(value);
		return one === undefined ? [] : [one];
	}
	const out: string[] = [];
	for (const element of value) {
		let inner: unknown = element;
		while (Array.isArray(inner)) inner = inner[0];
		const text = scalarText(inner);
		if (text !== undefined) out.push(text);
	}
	return out;
}

/** Whether a property has a value a person would call filled in. `0` and `false` are values; an empty field is not. */
export function isSet(value: unknown): boolean {
	return textsOf(value).length > 0;
}

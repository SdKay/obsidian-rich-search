import type { MatchOptions, Result, Span } from './types';

/** Word characters for whole-word matching: letters and digits of any script, and `_`. */
const WORD_CHAR = /[\p{L}\p{N}_]/u;

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Compiles the options into a global regex, or says why not. An invalid pattern is a normal
 * outcome (the user is mid-typing), never an exception that would abort a running search.
 */
export function compile(opts: MatchOptions): Result<RegExp> {
	if (opts.query === '') return { ok: false, error: 'empty query' };
	const source = opts.regex ? opts.query : escapeRegExp(opts.query);
	try {
		return { ok: true, value: new RegExp(source, `g${opts.caseSensitive ? '' : 'i'}u`) };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : 'invalid pattern' };
	}
}

/**
 * Whole-word check by neighbouring characters, not `\b`. `\b` only knows ASCII word characters,
 * so it finds no boundary inside CJK text; here a match is a whole word when the characters just
 * outside it are not letters, digits or `_`. In unspaced Chinese or Japanese that makes any match
 * between punctuation or spaces count, which is the best a regex can do without a tokenizer.
 */
function isWholeWord(line: string, start: number, end: number): boolean {
	const before = start > 0 ? [...line.slice(0, start)].pop() : undefined;
	const after = end < line.length ? [...line.slice(end)][0] : undefined;
	return !(before && WORD_CHAR.test(before)) && !(after && WORD_CHAR.test(after));
}

/**
 * All matches of `opts` in one line, in order. An invalid pattern yields no spans; call
 * `compile` first when the error should reach the user.
 */
export function matchLine(line: string, opts: MatchOptions): Span[] {
	const compiled = compile(opts);
	if (!compiled.ok) return [];
	const re = compiled.value;
	const spans: Span[] = [];
	for (let m = re.exec(line); m; m = re.exec(line)) {
		// A zero-length match (`a*` on "bbb") does not advance lastIndex: step past it or loop forever.
		if (m[0] === '') { re.lastIndex++; continue; }
		const span = { start: m.index, end: m.index + m[0].length };
		if (!opts.wholeWord || isWholeWord(line, span.start, span.end)) spans.push(span);
	}
	return spans;
}

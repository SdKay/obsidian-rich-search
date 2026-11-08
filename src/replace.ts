import { compile, matchLine } from './match';
import type { MatchOptions, SearchHit } from './types';

/**
 * Whether a hit is an ordinary line of a Markdown note, the only kind whose `line` is a line of the file and whose
 * `text` is that line as it is written. A line a plugin drew from a block, a word taken out of a drawing, a cell or a
 * slide has a line number of its own that means nothing in the file, so it is never rewritten.
 */
export function canReplaceHit(hit: SearchHit): boolean {
	return hit.path.toLowerCase().endsWith('.md')
		&& hit.block === undefined
		&& hit.anchor === undefined
		&& hit.location === undefined;
}

/**
 * Expands `$$`, `$&` and `$1`..`$99` in a replacement the way `String.prototype.replace` does. A group that does not
 * exist stays as written, so `$9` on a one-group pattern is the two characters `$9`.
 */
function expand(replacement: string, match: RegExpExecArray): string {
	return replacement.replace(/\$(\$|&|\d{1,2})/g, (whole, token: string) => {
		if (token === '$') return '$';
		if (token === '&') return match[0];
		const group = match[Number(token)];
		return Number(token) >= 1 && Number(token) < match.length ? (group ?? '') : whole;
	});
}

/**
 * The line with every match of `opts` replaced. Only the spans `matchLine` accepts are replaced, so whole-word and
 * zero-length rules are the search's own. Without `regex` the replacement is literal; with it, `$&` and `$1` work.
 */
export function replaceInLine(line: string, opts: MatchOptions, replacement: string): string {
	const spans = matchLine(line, opts);
	if (spans.length === 0) return line;
	const compiled = compile(opts);
	if (!compiled.ok) return line;
	let out = '';
	let from = 0;
	for (const span of spans) {
		out += line.slice(from, span.start);
		if (opts.regex) {
			// Run the pattern on the match's own position to get its groups; sticky keeps it from finding a later one.
			const re = new RegExp(compiled.value.source, compiled.value.flags.replace('g', '') + 'y');
			re.lastIndex = span.start;
			const m = re.exec(line);
			out += m ? expand(replacement, m) : replacement;
		} else {
			out += replacement;
		}
		from = span.end;
	}
	return out + line.slice(from);
}

/**
 * Dates in frontmatter, read by a parser of our own. `Date.parse` is not used: it reads `2026-11-01 10:00:00` (a space
 * instead of the T) differently between engines, and a vault's `created` and `updated` are written that way. A time with
 * no zone is the machine's local time, because that is the time the person lived in when they wrote it.
 */
export interface ParsedDate {
	/** The calendar day in local time, `YYYY-MM-DD`. A `date` property is compared by this alone. */
	day: string;
	/** The moment, in milliseconds since the epoch. A `datetime` property is compared by this. */
	instant: number;
}

// date, then an optional time (a space or T before it), then an optional zone: Z, +08:00, +0800 or +08.
const FORM = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** The zone as minutes east of UTC, or undefined when it is not a real one. */
function offsetMinutes(zone: string): number | undefined {
	if (zone === 'Z') return 0;
	const sign = zone.startsWith('-') ? -1 : 1;
	const digits = zone.slice(1).replace(':', '');
	const hours = Number(digits.slice(0, 2));
	const minutes = digits.length > 2 ? Number(digits.slice(2)) : 0;
	if (hours > 14 || minutes > 59) return undefined;
	return sign * (hours * 60 + minutes);
}

/** Reads one of the accepted forms, or returns undefined. Never throws. */
export function parseDate(text: string): ParsedDate | undefined {
	if (typeof text !== 'string') return undefined;
	const m = FORM.exec(text.trim());
	if (!m) return undefined;
	const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const [hour, minute, second] = [Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
	if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return undefined;
	// Date.UTC carries 30 February over into March; reading the day back catches it.
	const check = new Date(Date.UTC(year, month - 1, day));
	if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return undefined;

	let instant: number;
	if (m[7] === undefined) {
		// No zone: the machine's local time. new Date(y, m, d, ...) reads its arguments as local.
		instant = new Date(year, month - 1, day, hour, minute, second).getTime();
	} else {
		const offset = offsetMinutes(m[7]);
		if (offset === undefined) return undefined;
		instant = Date.UTC(year, month - 1, day, hour, minute, second) - offset * 60000;
	}
	if (!Number.isFinite(instant)) return undefined;
	// The calendar day is always the local one: with a zone written, the instant is converted first.
	const local = new Date(instant);
	return { day: `${pad(local.getFullYear(), 4)}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`, instant };
}

/** Negative, zero or positive, by calendar day only. The time of day is ignored. */
export function compareDays(a: ParsedDate, b: ParsedDate): number {
	return a.day < b.day ? -1 : a.day > b.day ? 1 : 0;
}

/** Negative, zero or positive, by the moment. */
export function compareInstants(a: ParsedDate, b: ParsedDate): number {
	return a.instant - b.instant;
}

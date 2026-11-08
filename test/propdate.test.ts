import { afterEach, describe, expect, it } from 'vitest';
import { compareDays, compareInstants, parseDate } from '../src/propdate';

const original = process.env.TZ;
afterEach(() => { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; });
const inZone = (tz: string, fn: () => void): void => { process.env.TZ = tz; fn(); };

describe('parseDate: the forms that are read', () => {
	it('reads a date alone', () => {
		expect(parseDate('2026-11-03')?.day).toBe('2026-11-03');
	});

	it('reads a time with a SPACE, the form Date.parse treats differently between engines', () => {
		expect(parseDate('2026-11-01 10:00:00')?.day).toBe('2026-11-01');
		expect(parseDate('2026-11-01 10:00')?.day).toBe('2026-11-01');
	});

	it('reads the T form', () => {
		expect(parseDate('2026-11-01T10:00:00')?.day).toBe('2026-11-01');
		expect(parseDate('2026-11-01T10:00')?.day).toBe('2026-11-01');
	});

	it('ignores a fraction of a second', () => {
		expect(parseDate('2026-11-01 10:00:00.789')?.instant).toBe(parseDate('2026-11-01 10:00:00')?.instant);
	});

	it('tolerates spaces around it', () => {
		expect(parseDate('  2026-11-03  ')?.day).toBe('2026-11-03');
	});

	it('reads a number or a Date-like string only as the forms above, and rejects the rest', () => {
		for (const bad of ['', 'tomorrow', '3/11/2026', 'Nov 3, 2026', '2026-11', '2026', '2026-13-01', '2026-02-30', '2026-11-03 25:00', '2026-11-03 10:61', 'abc 2026-11-03', '2026-11-03 trailing']) {
			expect(parseDate(bad), bad).toBeUndefined();
		}
	});

	it('rejects a day that does not exist, including a leap day in a year that has none', () => {
		expect(parseDate('2026-02-29')).toBeUndefined();
		expect(parseDate('2028-02-29')?.day).toBe('2028-02-29');
		expect(parseDate('2026-04-31')).toBeUndefined();
	});

	it('does not read a non-string', () => {
		expect(parseDate(20261103 as unknown as string)).toBeUndefined();
		expect(parseDate(null as unknown as string)).toBeUndefined();
	});
});

describe('parseDate: no offset means the machine\'s local time', () => {
	it('puts the same written time at different instants in different zones', () => {
		let shanghai = 0;
		let utc = 0;
		inZone('Asia/Shanghai', () => { shanghai = parseDate('2026-11-03 14:00:00')?.instant ?? NaN; });
		inZone('UTC', () => { utc = parseDate('2026-11-03 14:00:00')?.instant ?? NaN; });
		expect(utc - shanghai).toBe(8 * 3600 * 1000);
	});

	it('keeps the written calendar day in any zone', () => {
		for (const tz of ['Asia/Shanghai', 'UTC', 'America/New_York', 'Pacific/Auckland']) {
			inZone(tz, () => { expect(parseDate('2026-11-03 00:30:00')?.day, tz).toBe('2026-11-03'); });
			inZone(tz, () => { expect(parseDate('2026-11-03 23:30:00')?.day, tz).toBe('2026-11-03'); });
		}
	});

	it('reads a date alone as midnight local time', () => {
		inZone('Asia/Shanghai', () => {
			expect(parseDate('2026-11-03')?.instant).toBe(parseDate('2026-11-03 00:00:00')?.instant);
		});
	});

	it('reads a time across a daylight saving change without inventing an hour', () => {
		inZone('America/New_York', () => {
			// 2026-03-08 02:30 does not exist in New York. It must still give a date on that day, not throw or drift to another day.
			expect(parseDate('2026-03-08 02:30:00')?.day).toBe('2026-03-08');
		});
	});
});

describe('parseDate: an offset is exact', () => {
	it('reads Z as UTC and an offset as that zone, in any machine zone', () => {
		for (const tz of ['Asia/Shanghai', 'UTC', 'America/New_York']) {
			inZone(tz, () => {
				expect(parseDate('2026-11-03T06:00:00Z')?.instant, tz).toBe(Date.UTC(2026, 10, 3, 6, 0, 0));
				expect(parseDate('2026-11-03T14:00:00+08:00')?.instant, tz).toBe(Date.UTC(2026, 10, 3, 6, 0, 0));
				expect(parseDate('2026-11-03 14:00:00 +0800')?.instant, tz).toBe(Date.UTC(2026, 10, 3, 6, 0, 0));
				expect(parseDate('2026-11-02T20:00:00-10:00')?.instant, tz).toBe(Date.UTC(2026, 10, 3, 6, 0, 0));
			});
		}
	});

	it('takes the calendar day in local time after converting the instant', () => {
		inZone('Asia/Shanghai', () => {
			// 2026-11-03 20:00 UTC is 2026-11-04 04:00 in Shanghai.
			expect(parseDate('2026-11-03T20:00:00Z')?.day).toBe('2026-11-04');
		});
		inZone('America/New_York', () => {
			expect(parseDate('2026-11-03T02:00:00Z')?.day).toBe('2026-11-02');
		});
	});

	it('rejects an offset that is not a time zone', () => {
		expect(parseDate('2026-11-03T10:00:00+25:00')).toBeUndefined();
		expect(parseDate('2026-11-03T10:00:00+08:99')).toBeUndefined();
	});
});

describe('compareDays and compareInstants', () => {
	const a = (s: string) => parseDate(s)!;

	it('compares calendar days and ignores the time', () => {
		expect(compareDays(a('2026-11-03 23:59:59'), a('2026-11-03'))).toBe(0);
		expect(compareDays(a('2026-11-03 08:00:00'), a('2026-11-04'))).toBeLessThan(0);
		expect(compareDays(a('2026-11-05'), a('2026-11-04 23:59:59'))).toBeGreaterThan(0);
	});

	it('compares instants and does not ignore the time', () => {
		expect(compareInstants(a('2026-11-03 14:00:00'), a('2026-11-03 14:00:00'))).toBe(0);
		expect(compareInstants(a('2026-11-03 14:00:00'), a('2026-11-03 14:00:01'))).toBeLessThan(0);
		expect(compareInstants(a('2026-11-03 15:00:00'), a('2026-11-03'))).toBeGreaterThan(0);
	});

	it('orders days correctly across a month and year boundary, not as text of the wrong width', () => {
		expect(compareDays(a('2026-12-31'), a('2027-01-01'))).toBeLessThan(0);
		expect(compareDays(a('2026-09-30'), a('2026-10-01'))).toBeLessThan(0);
	});
});

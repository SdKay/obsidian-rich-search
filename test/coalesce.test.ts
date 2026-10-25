import { describe, it, expect } from 'vitest';
import { coalesce } from '../src/coalesce';

/** A scheduler we can run by hand, standing in for requestAnimationFrame. */
function manual() {
	const queue: (() => void)[] = [];
	return { schedule: (cb: () => void) => { queue.push(cb); }, flush: () => { const run = queue.splice(0); run.forEach((cb) => cb()); }, size: () => queue.length };
}

describe('coalesce', () => {
	it('runs the task once however many times it was asked before the next turn', () => {
		const s = manual(); let runs = 0;
		const ask = coalesce(() => runs++, s.schedule);
		ask(); ask(); ask();
		expect(s.size()).toBe(1);
		s.flush();
		expect(runs).toBe(1);
	});

	it('does not run before the scheduler does', () => {
		const s = manual(); let runs = 0;
		coalesce(() => runs++, s.schedule)();
		expect(runs).toBe(0);
	});

	it('can be asked again once it has run', () => {
		const s = manual(); let runs = 0;
		const ask = coalesce(() => runs++, s.schedule);
		ask(); s.flush();
		ask(); s.flush();
		expect(runs).toBe(2);
	});

	it('runs again for a request made while it is running, instead of dropping it', () => {
		const s = manual(); let runs = 0;
		let ask: () => void = () => {};
		ask = coalesce(() => { runs++; if (runs === 1) ask(); }, s.schedule);
		ask(); s.flush();
		expect(s.size()).toBe(1);
		s.flush();
		expect(runs).toBe(2);
	});

	it('is asked again after the task throws', () => {
		const s = manual(); let runs = 0;
		const ask = coalesce(() => { runs++; if (runs === 1) throw new Error('boom'); }, s.schedule);
		ask();
		expect(() => s.flush()).toThrow('boom');
		ask(); s.flush();
		expect(runs).toBe(2);
	});
});

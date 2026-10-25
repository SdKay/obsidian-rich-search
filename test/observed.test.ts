import { describe, it, expect } from 'vitest';
import { Watches } from '../src/observed';

type Target = { id: string };

describe('Watches', () => {
	it('starts a watch on a target the first time it is asked for', () => {
		const started: string[] = [];
		const watches = new Watches<Target>((t) => { started.push(t.id); return () => {}; });
		watches.ensure({ id: 'a' });
		expect(started).toEqual(['a']);
	});

	it('does not start a second watch on a target that already has one', () => {
		let started = 0;
		const watches = new Watches<Target>(() => { started++; return () => {}; });
		const a = { id: 'a' };
		watches.ensure(a); watches.ensure(a); watches.ensure(a);
		expect(started).toBe(1);
	});

	it('watches different targets separately', () => {
		let started = 0;
		const watches = new Watches<Target>(() => { started++; return () => {}; });
		watches.ensure({ id: 'a' }); watches.ensure({ id: 'b' });
		expect(started).toBe(2);
	});

	it('stops the watches on targets that are no longer wanted, and keeps the others', () => {
		const stopped: string[] = [];
		const watches = new Watches<Target>((t) => () => { stopped.push(t.id); });
		const a = { id: 'a' }; const b = { id: 'b' };
		watches.ensure(a); watches.ensure(b);
		watches.keepOnly([b]);
		expect(stopped).toEqual(['a']);
	});

	it('starts a fresh watch on a target that was dropped and comes back', () => {
		let started = 0;
		const watches = new Watches<Target>(() => { started++; return () => {}; });
		const a = { id: 'a' };
		watches.ensure(a); watches.keepOnly([]); watches.ensure(a);
		expect(started).toBe(2);
	});

	it('stops everything on request, and only once', () => {
		let stopped = 0;
		const watches = new Watches<Target>(() => () => { stopped++; });
		watches.ensure({ id: 'a' }); watches.ensure({ id: 'b' });
		watches.stopAll(); watches.stopAll();
		expect(stopped).toBe(2);
	});

	it('keeps stopping the rest when one stop throws', () => {
		const stopped: string[] = [];
		const watches = new Watches<Target>((t) => () => { if (t.id === 'a') throw new Error('boom'); stopped.push(t.id); });
		watches.ensure({ id: 'a' }); watches.ensure({ id: 'b' });
		expect(() => watches.stopAll()).not.toThrow();
		expect(stopped).toEqual(['b']);
	});

	it('counts what it is watching', () => {
		const watches = new Watches<Target>(() => () => {});
		const a = { id: 'a' };
		watches.ensure(a); watches.ensure({ id: 'b' });
		expect(watches.size).toBe(2);
		watches.keepOnly([a]);
		expect(watches.size).toBe(1);
	});
});

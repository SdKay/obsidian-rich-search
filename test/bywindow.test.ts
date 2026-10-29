import { describe, it, expect } from 'vitest';
import { groupByWindow } from '../src/bywindow';

describe('groupByWindow', () => {
	it('puts each item with the others of its window and keeps their order', () => {
		const items = [{ id: 1, w: 'main' }, { id: 2, w: 'popout' }, { id: 3, w: 'main' }, { id: 4, w: 'popout' }];
		const groups = groupByWindow(items, (item) => item.w);
		expect(groups.get('main')?.map((i) => i.id)).toEqual([1, 3]);
		expect(groups.get('popout')?.map((i) => i.id)).toEqual([2, 4]);
	});

	it('has no group for a window nothing belongs to', () => {
		expect(groupByWindow([{ w: 'main' }], (item) => item.w).has('popout')).toBe(false);
	});

	it('is empty for no items, so a search with no marks registers nothing', () => {
		expect(groupByWindow([], () => 'main').size).toBe(0);
	});

	it('tells windows apart by identity, not by what they look like', () => {
		const a = {};
		const b = {};
		const groups = groupByWindow([1, 2, 3], (n) => (n === 2 ? b : a));
		expect(groups.size).toBe(2);
		expect(groups.get(a)).toEqual([1, 3]);
		expect(groups.get(b)).toEqual([2]);
	});
});

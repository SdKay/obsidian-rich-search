import { describe, it, expect } from 'vitest';
import { scrollSettled, shouldHideWhileScrolling } from '../src/scrollsettled';

describe('shouldHideWhileScrolling', () => {
	it('hides a page only when the line is far enough down that it will visibly jump', () => {
		expect(shouldHideWhileScrolling(279)).toBe(true);
		expect(shouldHideWhileScrolling(40)).toBe(true);
	});

	it('does not hide a page for a line near the top, which is on screen already', () => {
		expect(shouldHideWhileScrolling(0)).toBe(false);
		expect(shouldHideWhileScrolling(5)).toBe(false);
	});
});

describe('scrollSettled', () => {
	it('is false while the page is still at the top, since the scroll has not happened yet', () => {
		expect(scrollSettled({ scrollTop: 0, waited: 100, limit: 1000 })).toBe(false);
	});

	it('is true once the page has moved away from the top', () => {
		expect(scrollSettled({ scrollTop: 8883, waited: 460, limit: 1000 })).toBe(true);
		expect(scrollSettled({ scrollTop: 1, waited: 460, limit: 1000 })).toBe(true);
	});

	it('gives up waiting after the limit, so a scroll that never comes cannot hide the page for good', () => {
		expect(scrollSettled({ scrollTop: 0, waited: 1000, limit: 1000 })).toBe(true);
		expect(scrollSettled({ scrollTop: 0, waited: 999, limit: 1000 })).toBe(false);
	});
});

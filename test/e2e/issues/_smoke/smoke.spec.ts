import { test, expect } from '../../common/test-base';

// Proves the e2e wiring works end to end: the bundle builds, loads in a page, and the real
// source runs there. Delete this once a real e2e test exists.
test('the real bundle loads and runs in a page', async ({ page, loadReal }) => {
	await loadReal();
	const hit = await page.evaluate(() => window.RichSearchReal.matchLine('hello world', { query: 'world' }));
	expect(hit).toEqual([{ start: 6, end: 11 }]);
});

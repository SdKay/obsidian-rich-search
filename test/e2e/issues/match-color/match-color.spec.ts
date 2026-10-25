import { test, expect } from '../../common/test-base';

// A second window is stood in for by an iframe: it has its own document and its own body, as a popout window does.
test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	await page.setContent('<iframe id="pop"></iframe>');
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
});

const read = (page: import('@playwright/test').Page) => page.evaluate(() => {
	const pop = (document.getElementById('pop') as HTMLIFrameElement).contentDocument!;
	const get = (d: Document) => [getComputedStyle(d.body).getPropertyValue('--rs-match-bg').trim(), getComputedStyle(d.body).getPropertyValue('--rs-match-fg').trim()];
	return { main: get(document), popout: get(pop) };
});

test('sets the colour in every window given, so a popout reads it too', async ({ page }) => {
	await page.evaluate(() => {
		const pop = (document.getElementById('pop') as HTMLIFrameElement).contentDocument!;
		window.RichSearchReal.setMatchColor([document, pop], '#ccff00');
	});
	expect(await read(page)).toEqual({ main: ['#ccff00', '#000000'], popout: ['#ccff00', '#000000'] });
});

test('a window not given does not get it', async ({ page }) => {
	await page.evaluate(() => window.RichSearchReal.setMatchColor([document], '#ccff00'));
	expect((await read(page)).popout).toEqual(['', '']);
});

test('changing the colour changes it everywhere, and the text colour follows', async ({ page }) => {
	await page.evaluate(() => {
		const pop = (document.getElementById('pop') as HTMLIFrameElement).contentDocument!;
		window.RichSearchReal.setMatchColor([document, pop], '#ccff00');
		window.RichSearchReal.setMatchColor([document, pop], '#102030');
	});
	expect(await read(page)).toEqual({ main: ['#102030', '#ffffff'], popout: ['#102030', '#ffffff'] });
});

test('takes the colour off every window', async ({ page }) => {
	await page.evaluate(() => {
		const pop = (document.getElementById('pop') as HTMLIFrameElement).contentDocument!;
		window.RichSearchReal.setMatchColor([document, pop], '#ccff00');
		window.RichSearchReal.clearMatchColor([document, pop]);
	});
	expect(await read(page)).toEqual({ main: ['', ''], popout: ['', ''] });
});

test('the same window given twice is set once and does not fail', async ({ page }) => {
	await page.evaluate(() => window.RichSearchReal.setMatchColor([document, document], '#abcdef'));
	expect((await read(page)).main).toEqual(['#abcdef', '#000000']);
});

import { test, expect } from '../../common/test-base';

declare global {
	interface Window { __h: { list: string[]; applied: string[]; close: () => void; labels: () => string[] } }
}

test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	await page.setContent('<button id="anchor" style="margin:40px">history</button>');
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
	await page.evaluate(() => {
		// The helpers Obsidian puts on elements, which the popup uses.
		const P = HTMLElement.prototype as unknown as Record<string, unknown>;
		P.createDiv = function (this: HTMLElement, o: { cls?: string; text?: string } = {}) { const e = document.createElement('div'); if (o.cls) e.className = o.cls; if (o.text) e.textContent = o.text; this.appendChild(e); return e; };
		P.createSpan = function (this: HTMLElement, o: { cls?: string; text?: string; attr?: Record<string, string> } = {}) { const e = document.createElement('span'); if (o.cls) e.className = o.cls; if (o.text) e.textContent = o.text; for (const k in o.attr ?? {}) e.setAttribute(k, o.attr![k]!); this.appendChild(e); return e; };
		P.empty = function (this: HTMLElement) { this.replaceChildren(); };
		P.setCssProps = function (this: HTMLElement, p: Record<string, string>) { for (const k in p) this.style.setProperty(k, p[k]!); };

		const h = { list: ['first', 'second', 'third'], applied: [] as string[], close: () => {}, labels: () => Array.from(document.querySelectorAll('.rs-history-text')).map((e) => e.textContent!) };
		window.__h = h;
		h.close = window.RichSearchReal.openHistoryPopup(document.getElementById('anchor')!, {
			entries: () => h.list.map((label, position) => ({ position, label })).reverse(),
			apply: (position) => { h.applied.push(h.list[position]!); },
			forget: (position) => { h.list.splice(position, 1); },
			forgetAll: () => { h.list.length = 0; },
			labels: { empty: 'No searches yet', clear: 'Clear history', remove: 'Remove' },
		});
	});
});

test('lists the searches newest first', async ({ page }) => {
	expect(await page.evaluate(() => window.__h.labels())).toEqual(['third', 'second', 'first']);
});

test('the cross forgets only that search and leaves the list open', async ({ page }) => {
	await page.locator('.rs-history-row', { hasText: 'second' }).locator('.rs-history-x').click();
	expect(await page.evaluate(() => window.__h.labels())).toEqual(['third', 'first']);
	expect(await page.locator('.rs-history-popup').count()).toBe(1);
	expect(await page.evaluate(() => window.__h.applied)).toEqual([]);
});

test('several searches can be removed one after the other', async ({ page }) => {
	await page.locator('.rs-history-row', { hasText: 'third' }).locator('.rs-history-x').click();
	await page.locator('.rs-history-row', { hasText: 'first' }).locator('.rs-history-x').click();
	expect(await page.evaluate(() => window.__h.labels())).toEqual(['second']);
});

test('choosing a search applies it and closes the list', async ({ page }) => {
	await page.locator('.rs-history-text', { hasText: 'first' }).click();
	expect(await page.evaluate(() => window.__h.applied)).toEqual(['first']);
	expect(await page.locator('.rs-history-popup').count()).toBe(0);
});

test('clearing forgets everything and says there is nothing left', async ({ page }) => {
	await page.locator('.rs-history-clear').click();
	expect(await page.evaluate(() => window.__h.list)).toEqual([]);
	expect(await page.locator('.rs-history-empty').textContent()).toBe('No searches yet');
	expect(await page.locator('.rs-history-popup').count()).toBe(1);
});

test('forgetting the last search shows the empty message', async ({ page }) => {
	for (const label of ['third', 'second', 'first']) await page.locator('.rs-history-row', { hasText: label }).locator('.rs-history-x').click();
	expect(await page.locator('.rs-history-empty').count()).toBe(1);
	expect(await page.locator('.rs-history-clear').count()).toBe(0);
});

test('Escape closes the list', async ({ page }) => {
	await page.keyboard.press('Escape');
	expect(await page.locator('.rs-history-popup').count()).toBe(0);
});

test('a click outside closes the list, a click on the button that opened it does not', async ({ page }) => {
	await page.locator('#anchor').click();
	expect(await page.locator('.rs-history-popup').count()).toBe(1);
	await page.mouse.click(5, 5);
	expect(await page.locator('.rs-history-popup').count()).toBe(0);
});

test('close can be called twice', async ({ page }) => {
	await page.evaluate(() => { window.__h.close(); window.__h.close(); });
	expect(await page.locator('.rs-history-popup').count()).toBe(0);
});

test('a closed list takes no more key presses, so Escape reaches whatever else is listening', async ({ page }) => {
	const reached = await page.evaluate(async () => {
		window.__h.close();
		let seen = 0;
		// A listener of someone else, added later in the bubbling phase: a stale capture handler would stop the event first.
		document.addEventListener('keydown', () => { seen++; });
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		return seen;
	});
	expect(reached).toBe(1);
});

test('a closed list takes no more clicks outside', async ({ page }) => {
	const closes = await page.evaluate(() => {
		window.__h.close();
		const next = window.RichSearchReal.openHistoryPopup(document.getElementById('anchor')!, {
			entries: () => [{ position: 0, label: 'again' }], apply: () => {}, forget: () => {}, forgetAll: () => {},
			labels: { empty: 'e', clear: 'c', remove: 'r' },
		});
		return typeof next;
	});
	expect(closes).toBe('function');
	await page.mouse.click(5, 5);
	expect(await page.locator('.rs-history-popup').count()).toBe(0);
});

test('closing takes both document listeners away, and only once', async ({ page }) => {
	const removed = await page.evaluate(() => {
		const calls: string[] = [];
		const original = document.removeEventListener.bind(document);
		document.removeEventListener = ((type: string, ...rest: unknown[]) => { calls.push(type); return (original as (...a: unknown[]) => void)(type, ...rest); }) as typeof document.removeEventListener;
		window.__h.close();
		window.__h.close();
		document.removeEventListener = original;
		return calls;
	});
	expect(removed.sort()).toEqual(['keydown', 'mousedown']);
});

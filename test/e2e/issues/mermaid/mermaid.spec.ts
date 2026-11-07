import { test, expect } from '../../common/test-base';

// A diagram is an inline SVG with its text in <text>: Obsidian 1.15 draws mermaid that way (div.mermaid, one <tspan> per run),
// and the PlantUML plugin inserts its SVG output as is. In the editor it sits in a code-block widget, outside the editor's decorations.
const DIAGRAM = `<div class="cm-preview-code-block cm-embed-block cm-lang-mermaid"><div class="mermaid"><svg width="400" height="120" xmlns="http://www.w3.org/2000/svg">
<text x="10" y="20"><tspan>[OTP BOOTSEL = Flash]</tspan></text>
<text x="10" y="60"><tspan>alt </tspan><tspan font-weight="bold">OTP</tspan><tspan> split</tspan></text>
</svg></div></div>`;
const PLANTUML = `<div class="cm-preview-code-block cm-embed-block cm-lang-plantuml-svg"><svg width="300" height="80" xmlns="http://www.w3.org/2000/svg"><g>
<text x="10" y="20" textLength="60" lengthAdjust="spacing">Client</text>
<text x="10" y="50" textLength="90" lengthAdjust="spacing">OTP check</text></g></svg></div>`;
const ICON = `<button class="clickable-icon"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg></button>`;
const PAGE = `<div id="root"><div class="cm-line">a line with OTP in it</div>${DIAGRAM}${PLANTUML}${ICON}</div>`;

test.beforeEach(async ({ page, loadReal }) => {
	await loadReal();
	await page.setContent(PAGE);
	await page.addScriptTag({ path: 'test/e2e/common/real-bundle.generated.js' });
});

/** The text of every range the highlight API holds under `name`, with whether it lies inside the diagram. */
async function marked(page: import('@playwright/test').Page, source: 'editor' | 'reading', query = 'OTP') {
	return page.evaluate(([kind, q]) => {
		const root = document.getElementById('root')!;
		const src = kind === 'editor'
			? { kind: 'editor' as const, path: 'a.md', note: 'a line with OTP in it', root }
			: { kind: 'reading' as const, path: 'a.md', root, note: 'a line with OTP in it' };
		window.RichSearchReal.paintPage([src], { query: q as string }, null);
		const h = CSS.highlights.get('rs-match');
		return (h ? Array.from(h) as Range[] : []).map((r) => ({ text: r.toString(), inDiagram: r.startContainer.parentElement?.closest('.mermaid, .cm-lang-plantuml-svg') !== null }));
	}, [source, query] as const);
}

test('the editor marks the words in a diagram, including one split across runs', async ({ page }) => {
	const out = await marked(page, 'editor');
	expect(out.filter((m) => m.inDiagram).map((m) => m.text)).toEqual(['OTP', 'OTP', 'OTP']);
});

test('the editor marks the words in an inline SVG that is not mermaid, such as PlantUML output', async ({ page }) => {
	const out = await page.evaluate(() => {
		const root = document.getElementById('root')!;
		window.RichSearchReal.paintPage([{ kind: 'editor', path: 'a.md', note: '', root }], { query: 'Client' }, null);
		const h = CSS.highlights.get('rs-match');
		return (h ? Array.from(h) as Range[] : []).map((r) => ({ text: r.toString(), inPlantuml: r.startContainer.parentElement?.closest('.cm-lang-plantuml-svg') !== null }));
	});
	expect(out).toEqual([{ text: 'Client', inPlantuml: true }]);
});

test('an icon, an SVG with no text, marks nothing', async ({ page }) => {
	const out = await page.evaluate(() => {
		const root = document.getElementById('root')!;
		window.RichSearchReal.paintPage([{ kind: 'editor', path: 'a.md', note: '', root }], { query: 'M3' }, null);
		return CSS.highlights.has('rs-match');
	});
	expect(out).toBe(false);
});

test('the editor does not mark ordinary lines through this path, which the editor decorations already do', async ({ page }) => {
	const out = await marked(page, 'editor');
	expect(out.filter((m) => !m.inDiagram)).toEqual([]);
});

test('reading view marks the diagram as part of the page', async ({ page }) => {
	const out = await marked(page, 'reading');
	expect(out.filter((m) => m.inDiagram).map((m) => m.text)).toEqual(['OTP', 'OTP', 'OTP']);
});

test('a query that matches nothing in the diagram marks nothing there', async ({ page }) => {
	const out = await marked(page, 'editor', 'zzz');
	expect(out).toEqual([]);
});

test('marks in the diagram go when the query is emptied', async ({ page }) => {
	await marked(page, 'editor');
	const after = await page.evaluate(() => {
		window.RichSearchReal.paintPage([], null);
		return CSS.highlights.has('rs-match');
	});
	expect(after).toBe(false);
});

import { describe, it, expect } from 'vitest';
import { planReplaceAll } from '../src/replaceplan';
import type { SearchHit } from '../src/types';

const hit = (path: string, line: number, extra: Partial<SearchHit> = {}): SearchHit => ({ path, line, text: `t${line}`, spans: [{ start: 0, end: 1 }, { start: 2, end: 3 }], ...extra });

describe('planReplaceAll', () => {
	it('groups the hits by note and counts notes and lines', () => {
		const plan = planReplaceAll([hit('a.md', 1), hit('a.md', 4), hit('b.md', 0)]);
		expect(plan.files.map((f) => f.path)).toEqual(['a.md', 'b.md']);
		expect(plan.files[0]?.lines).toEqual([{ line: 1, text: 't1' }, { line: 4, text: 't4' }]);
		expect(plan.fileCount).toBe(2);
		expect(plan.lineCount).toBe(3);
	});

	it('counts every match on a line, because that is what the user will see change', () => {
		expect(planReplaceAll([hit('a.md', 1)]).matchCount).toBe(2);
	});

	it('leaves out what cannot be replaced, and says how many it left out', () => {
		const plan = planReplaceAll([hit('a.md', 1), hit('a.pdf', 3), hit('b.md', 2, { block: { language: 'rich-table', fromLine: 1 } }), hit('c.md', 0, { location: 'Text element' })]);
		expect(plan.files.map((f) => f.path)).toEqual(['a.md']);
		expect(plan.lineCount).toBe(1);
		expect(plan.notReplaceable).toBe(3);
	});

	it('is empty for no hits', () => {
		const plan = planReplaceAll([]);
		expect(plan).toMatchObject({ files: [], fileCount: 0, lineCount: 0, matchCount: 0, notReplaceable: 0 });
	});

	it('keeps the order of the results, files by first appearance and lines as found', () => {
		const plan = planReplaceAll([hit('b.md', 9), hit('a.md', 2), hit('b.md', 1)]);
		expect(plan.files.map((f) => f.path)).toEqual(['b.md', 'a.md']);
		expect(plan.files[0]?.lines.map((l) => l.line)).toEqual([9, 1]);
	});

	it('takes every hit it is given, not only a drawn part, so the count matches what will change', () => {
		const many = Array.from({ length: 3000 }, (_, i) => hit(`n${i % 10}.md`, i));
		expect(planReplaceAll(many).lineCount).toBe(3000);
	});
});

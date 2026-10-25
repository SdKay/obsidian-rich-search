import { describe, it, expect } from 'vitest';
import { renderedLine } from '../src/renderedline';

describe('renderedLine', () => {
	it('drops a heading marker', () => {
		expect(renderedLine('## 八、交付模式与逃生阀')).toBe('八、交付模式与逃生阀');
		expect(renderedLine('###### small')).toBe('small');
	});

	it('drops list markers: bullets, numbers, and task boxes', () => {
		expect(renderedLine('- item')).toBe('item');
		expect(renderedLine('  * nested item')).toBe('nested item');
		expect(renderedLine('12. numbered')).toBe('numbered');
		expect(renderedLine('- [ ] todo')).toBe('todo');
		expect(renderedLine('- [x] done')).toBe('done');
	});

	it('drops quote and callout markers, however deep', () => {
		expect(renderedLine('> quoted')).toBe('quoted');
		expect(renderedLine('> > nested')).toBe('nested');
		expect(renderedLine('> - item in a quote')).toBe('item in a quote');
	});

	it('keeps the text of a link and drops its address', () => {
		expect(renderedLine('see [the page](http://x.y/z) now')).toBe('see the page now');
		expect(renderedLine('[[Note|alias]] and [[Other]]')).toBe('alias and Other');
	});

	it('drops emphasis, strike-through, highlight and code marks around text', () => {
		expect(renderedLine('**bold** and *em* and ~~gone~~ and ==hi== and `code`')).toBe('bold and em and gone and hi and code');
		expect(renderedLine('__bold__ and _em_')).toBe('bold and em');
	});

	it('drops single-character emphasis, which the page shows as the character alone', () => {
		expect(renderedLine('an *a* and _b_ here')).toBe('an a and b here');
	});

	it('leaves words that contain underscores or stars alone', () => {
		expect(renderedLine('call snake_case_name and my_var now')).toBe('call snake_case_name and my_var now');
		expect(renderedLine('2 * 3 and 4 * 5')).toBe('2 * 3 and 4 * 5');
	});

	it('leaves an ordinary line as it is, apart from the ends', () => {
		expect(renderedLine('  plain text, 2 * 3 = 6  ')).toBe('plain text, 2 * 3 = 6');
	});

	it('does not eat text that only looks like a marker', () => {
		expect(renderedLine('#hashtag stays')).toBe('#hashtag stays');
		expect(renderedLine('3.5 is not a list')).toBe('3.5 is not a list');
		expect(renderedLine('a - b')).toBe('a - b');
	});
});

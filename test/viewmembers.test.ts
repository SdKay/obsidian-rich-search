import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Obsidian's View calls these on itself. `open` and `close` are internal and absent from the typings, so a
// method of the same name compiles fine and silently replaces them: the panel is then created but never built.
const OBSIDIAN_OWNED = ['open', 'close', 'load', 'unload', 'onload', 'onunload', 'addChild', 'removeChild', 'register', 'registerEvent', 'registerDomEvent', 'registerInterval', 'setState', 'getState'];

function methodsDeclaredIn(path: string): string[] {
	const names: string[] = [];
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const m = /^\t(?:(?:private|public|protected|async|override)\s+)*([A-Za-z_$][\w$]*)\s*\(/.exec(line);
		if (m?.[1]) names.push(m[1]);
	}
	return names;
}

describe('the search view', () => {
	it('declares no method that replaces one Obsidian calls on its own views', () => {
		const clashes = methodsDeclaredIn('src/search-view.ts').filter((name) => OBSIDIAN_OWNED.includes(name));
		expect(clashes).toEqual([]);
	});

	it('is able to see the methods it declares (the scan is not empty)', () => {
		expect(methodsDeclaredIn('src/search-view.ts')).toContain('onOpen');
	});
});

import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		// test/e2e is a separate Playwright suite (`npm run test:e2e`). Vitest's default include
		// glob matches *.spec.ts too, and Playwright's test() breaks under vitest's runner.
		exclude: [...configDefaults.exclude, 'test/e2e/**'],
	},
	resolve: {
		alias: {
			// Pure logic never needs the real Obsidian; tests that import a module touching it get this stub.
			obsidian: new URL('./test/__mocks__/obsidian.ts', import.meta.url).pathname,
		},
	},
});

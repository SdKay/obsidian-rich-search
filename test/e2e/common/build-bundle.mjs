// Bundles the real source under test (real-bundle-entry.ts) into a browser script for e2e
// pages. Never committed; globalSetup rebuilds it, same treatment as main.js.
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
	entryPoints: [path.join(__dirname, 'real-bundle-entry.ts')],
	outfile: path.join(__dirname, 'real-bundle.generated.js'),
	bundle: true,
	format: 'iife',
	globalName: 'RichSearchReal',
	platform: 'browser',
	target: 'chrome120',
	alias: { obsidian: path.join(__dirname, 'obsidian-shim.ts') },
});

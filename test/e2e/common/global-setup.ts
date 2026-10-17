// Rebuilds real-bundle.generated.js before every e2e run so tests never run against a stale bundle.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function globalSetup(): void {
	execFileSync(process.execPath, [path.join(__dirname, 'build-bundle.mjs')], { stdio: 'inherit' });
}

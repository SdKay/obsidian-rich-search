// Checks the files the community review reads but ESLint does not: manifest.json, styles.css, README.md.
// Errors exit 1 (the review would reject the release); warnings only print.
import { readFileSync } from 'node:fs';

const errors = [];
const warnings = [];
const error = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const REQUIRED = { id: 'string', name: 'string', version: 'string', minAppVersion: 'string', description: 'string', author: 'string', isDesktopOnly: 'boolean' };
const OPTIONAL = { authorUrl: 'string', fundingUrl: 'string|object' };
for (const [key, type] of Object.entries(REQUIRED)) {
	if (!(key in manifest)) error(`manifest.json: missing "${key}"`);
	else if (typeof manifest[key] !== type) error(`manifest.json: "${key}" must be a ${type}`);
}
for (const [key, value] of Object.entries(manifest)) {
	if (!(key in REQUIRED) && !(key in OPTIONAL)) error(`manifest.json: unknown field "${key}"`);
	if (key === 'fundingUrl' && (value === '' || (typeof value === 'object' && Object.keys(value).length === 0))) error('manifest.json: "fundingUrl" is empty');
}
for (const key of ['id', 'name', 'description']) {
	const value = String(manifest[key] ?? '').toLowerCase();
	for (const word of ['obsidian', 'plugin']) if (value.includes(word)) error(`manifest.json: "${key}" must not contain "${word}"`);
}
const description = String(manifest.description ?? '');
if (description.length < 10 || description.length > 250 || !/^[A-Z]/.test(description) || !/[.?!)]$/.test(description)) {
	error('manifest.json: description must be 10-250 characters, start with a capital letter and end with . ? ! or )');
}
// The lint rule's character whitelist is stricter than the review: the accepted sibling plugins use dashes.
if (!/^[A-Za-z0-9\s.,!?'"\-:;()/+]+$/.test(description)) warn('manifest.json: description has characters beyond plain punctuation');
if (/^obsi|dian$|plugin$/i.test(manifest.name) || /plugin$/i.test(manifest.id)) error('manifest.json: name or id has a reserved start or end');
if (/github\.com\/[^/]+\/[^/]+/i.test(manifest.authorUrl ?? '')) warn('manifest.json: authorUrl points to a repository; a profile or personal site is preferred');
if (manifest.version !== pkg.version) error(`manifest.json version ${manifest.version} differs from package.json ${pkg.version}`);

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
if (manifest.version !== '0.0.0' && versions[manifest.version] !== manifest.minAppVersion) {
	error(`versions.json must map ${manifest.version} to ${manifest.minAppVersion}`);
}

const css = readFileSync('styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
if (/!important/.test(css)) warn('styles.css: "!important" overrides user themes; raise specificity instead');
if (/clip-path/.test(css)) warn('styles.css: "clip-path" is only partially supported by Obsidian');
if (/:has\(/.test(css)) warn('styles.css: ":has" slows selector matching; toggle a class instead');

const readme = readFileSync('README.md', 'utf8');
if (!readme.includes(manifest.name)) error(`README.md: the plugin name "${manifest.name}" does not appear`);
if (/\[description\]|\bTODO\b|\bFIXME\b|lorem ipsum/i.test(readme)) error('README.md: unfilled placeholder text');
if (/<!--[\s\S]*?-->/.test(readme)) warn('README.md: HTML comments may be read as template placeholders');

for (const message of warnings) console.warn(`warning  ${message}`);
for (const message of errors) console.error(`error    ${message}`);
console.log(`check-release: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length > 0 ? 1 : 0);

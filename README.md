# Rich Search

A search plugin for [Obsidian](https://obsidian.md) that fills the gaps in the built-in search.

> **Status: scaffold.** The project structure, tests and release pipeline are in place; the search features are not built yet.

## Planned features

- **Whole-word** and **regular-expression** matching, with case sensitivity
- **Folder** allow/deny lists
- **File-type** allow/deny lists, so Excalidraw and other base64-heavy files stop polluting results
- **Highlight** the keyword (or its line) in the file you open from a result

Works on desktop and mobile. Everything runs locally; the plugin makes no network requests.

## Install (for testing)

1. Build: `npm install && npm run build`.
2. Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/rich-search/`.
3. In Obsidian, turn on **Settings → Community plugins → Rich Search**.

## Develop

```bash
npm install
npm run dev          # watch
npm test             # unit tests
npm run test:e2e     # browser tests (first run: npx playwright install chromium)
npm run verify:ci    # clean install, build, changelog check, tests
```

## Layout

```
src/
  main.ts        plugin lifecycle only
  settings.ts    settings and defaults (add keys, never rename)
  types.ts       the contract between layers
  match.ts       matching core (pure, tested)
test/
  *.test.ts      vitest
  e2e/           playwright, real source in a browser page
```

## License

[AGPL-3.0](LICENSE)

<div align="center">

<img src="./docs/banner.png" alt="Rich Search" />

<p>
  <b>🔤 Whole word &nbsp;·&nbsp; 🧮 Regex &nbsp;·&nbsp; 📁 Folder lists &nbsp;·&nbsp; 🗂️ File-type lists &nbsp;·&nbsp; 🧩 Cross-format search &nbsp;·&nbsp; 🖍️ Highlight on open</b>
</p>

<p>
  <a href="https://github.com/SdKay/obsidian-rich-search/releases/latest">
    <img src="https://img.shields.io/github/v/release/SdKay/obsidian-rich-search?style=flat-square&color=7c3aed" alt="Latest release" />
  </a>
  <a href="https://github.com/SdKay/obsidian-rich-search/releases">
    <img src="https://img.shields.io/github/downloads/SdKay/obsidian-rich-search/total?style=flat-square&color=brightgreen" alt="Total downloads" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/SdKay/obsidian-rich-search?style=flat-square" alt="License" />
  </a>
  <a href="https://obsidian.md/plugins?id=rich-search">
    <img src="https://img.shields.io/badge/Obsidian-Community_Plugin-7c3aed?style=flat-square&logo=obsidian&logoColor=white" alt="Obsidian community plugin" />
  </a>
  <a href="https://paypal.me/ssdking">
    <img src="https://img.shields.io/badge/Donate-PayPal-003087?style=flat-square&logo=paypal&logoColor=white" alt="Donate via PayPal" />
  </a>
</p>

<p>
  <a href="#why-rich-search">Why</a> ·
  <a href="#installation">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#cross-format-search">Cross-format</a> ·
  <a href="#settings">Settings</a> ·
  <a href="#development">Development</a> ·
  <a href="README_CN.md">中文</a>
</p>

<p>
  <img src="docs/wechat-qrcode.jpg" alt="WeChat public account" width="120" />
  <br/><sub>Follow on WeChat for more Obsidian plugins &amp; tools</sub>
</p>

</div>

> **Status: early development, not released yet.** The search view, matching, folder and file-type scope, history, highlighting in notes and Excalidraw drawings, and searching Excel workbooks work in the author's vault. Opening a result inside a workbook, and searching draw.io, Visio and PowerPoint files, depend on companion plugins that are still being built and are marked *planned* below.

Search for Obsidian that fills the gaps in the built-in search: match whole words or regular expressions, decide which folders and file types are searched, and see the keyword highlighted in the file you open.

---

## Why Rich Search?

Obsidian's built-in search is fast for a quick lookup, but it falls short once a vault grows:

| Need | Built-in search | Rich Search |
|---|:---:|:---:|
| Match whole words only | 🔴 | 🟢 |
| Regular expressions | 🟡 limited | 🟢 |
| Folder include / exclude lists | 🔴 | 🟢 |
| File-type include / exclude | 🔴 | 🟢 |
| Keep Excalidraw drawing data out of results, search only the words in the drawing | 🔴 | 🟢 |
| Search the text inside Excel workbooks | 🔴 | 🟢 (opening at the cell: planned) |
| Search the text inside PowerPoint and draw.io files | 🔴 | 🟡 planned |
| Highlight the keyword after opening a result | 🔴 | 🟢 |
| Step back through earlier searches with the arrow keys | 🔴 | 🟢 |

Legend: 🟢 supported　🟡 partial　🔴 not supported

---

## Installation

**Community plugin browser (recommended, once released):**

1. Open **Settings → Community plugins → Browse**
2. Search for **Rich Search** and install
3. Enable the plugin

**Manual:** copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/rich-search/`

Minimum Obsidian version: **1.8.7**. Works on desktop and mobile.

---

## Features

- **A search panel** in the sidebar (ribbon icon or the *Open search* command): drag it to either side. The query box and options stay fixed while only the results scroll.
- **Whole-word matching** that also works in Chinese, Japanese and Korean text
- **Regular expressions**, with a clear message instead of an error while you are still typing the pattern
- **Case sensitivity** toggle
- **Searching starts as you type**, and Enter searches at once. A new query cancels the one still running.
- **Scope**: include folders and exclude folders (an exclusion inside an included folder carves it out), and tick the file types to search. Skipped files are never read.
- **Search history**: press ↑ / ↓ in the query box to step back and forth through earlier searches. Each one restores the text, the three options and the scope.
- **Open a result** in the main area (Ctrl/Cmd+click for a new tab) and see the matches highlighted. Inside a Markdown table the matched cell is marked and scrolled into view.
- **Choose the highlight colour** in the settings. *(Not yet confirmed in a real vault.)*
- **Excalidraw drawings** are searched by the words in them, and clicking a result opens the drawing and zooms to the element (needs the Excalidraw plugin).
- **Excel workbooks** are searched through the Rich Table plugin (see [below](#cross-format-search)).
- **Many results**: the first 2,000 are shown with the true total above them, and a button shows more. *(Not yet confirmed in a real vault.)*

Everything runs locally. The plugin makes no network requests.

---

## Cross-format search

Notes are not the only place your text lives. Rich Search reads the text a person would actually see in other files and lists it next to your notes. It does not read raw bytes, and it does not carry its own parsers: for formats Obsidian cannot show, it asks the plugin that already renders them.

| Format | Needs | What is searched | State |
|---|---|---|:---:|
| Excalidraw (`.excalidraw.md`) | the Excalidraw plugin, to open it | The words in the drawing, not the compressed drawing data | 🟢 |
| Excel (`.xlsx`) | [Rich Table](https://github.com/SdKay/obsidian-rich-table) | Cell values, per sheet | 🟢 search · opening at the cell is planned |
| draw.io, Visio, PowerPoint | [Rich View](https://github.com/SdKay/obsidian-rich-view) | Shape, label and slide text | planned |

A type whose plugin is not installed, or installed but switched off, is shown greyed out in the scope panel with what to do. Switching a plugin on in Settings is meant to be picked up the next time you return to the panel, without a reload. *(Not yet confirmed in a real vault.)*

This is the other half of the file-type lists: instead of leaving a drawing out because its raw content looks like base64, the plugin searches only the words in it.

Fenced code blocks in a note can be skipped by language. By default only Excalidraw's `compressed-json` block is skipped; this can be changed in the data file for now.

---

## Settings

In the settings tab:

| Setting | What it does |
|---|---|
| Treat .excalidraw.md as Excalidraw drawings | On: a drawing is its own file type, searched by the words in it. Off: it is an ordinary note. |
| Match highlight colour | The background of matched words, in results and in opened notes. Neon yellow-green by default. |

In the search panel's **Scope** section:

| Control | What it does |
|---|---|
| Include folders | Search only inside these. Empty means every folder. |
| Exclude folders | Never search these. Subtracted from the included folders. |
| File types | Tick the types to search. |

### Languages

The interface follows Obsidian's language setting: English and 简体中文. Any other language shows English. To add a language, create `src/i18n/<code>.ts` and register it in `src/i18n/index.ts`; pull requests with corrections or new languages are welcome.

---

## Development

```bash
npm install
npm run dev          # watch
npm test             # unit tests
npm run test:e2e     # browser tests (first run: npx playwright install chromium)
npm run verify:ci    # clean install, build, changelog check, tests
```

---

## License

[AGPL-3.0](LICENSE): derivatives must be open-sourced under the same license.

For **commercial licensing**: sdkxyx@gmail.com

---

## Support the Project

Rich Search is free and open-source under the AGPL-3.0 license. If this plugin has improved your workflow, you can support its ongoing development with a voluntary donation. Every contribution helps fix bugs and add new features.

### 💳 PayPal
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-003087?style=flat-square&logo=paypal&logoColor=white)](https://paypal.me/ssdking)

### 🧧 WeChat Pay / Alipay

| WeChat Pay | Alipay |
|:---:|:---:|
| <img src="docs/wechat-donate.jpg" width="120" alt="WeChat Pay donation QR code" /> | <img src="docs/alipay-donate.jpg" width="120" alt="Alipay donation QR code" /> |

Thank you for your support! 🙏

---

## Feedback

Issues and feature requests: [GitHub Issues](https://github.com/SdKay/obsidian-rich-search/issues)

---

[![Star History Chart](https://api.star-history.com/svg?repos=SdKay/obsidian-rich-search&type=Date)](https://star-history.com/#SdKay/obsidian-rich-search&Date)

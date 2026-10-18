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

> **Status: early development.** The project foundation, tests and release pipeline are in place; the search features below are being built. Nothing here is released yet.

Search for Obsidian that fills the gaps in the built-in search: match whole words or regular expressions, decide which folders and file types are searched, and see the keyword highlighted in the file you open.

---

## Why Rich Search?

Obsidian's built-in search is fast for a quick lookup, but it falls short once a vault grows:

| Need | Built-in search | Rich Search |
|---|:---:|:---:|
| Match whole words only | 🔴 | 🟢 planned |
| Regular expressions | 🟡 limited | 🟢 planned |
| Folder allow / deny lists | 🔴 | 🟢 planned |
| File-type allow / deny lists | 🔴 | 🟢 planned |
| Keep Excalidraw / base64-like files out of results | 🔴 | 🟢 planned |
| Search the text inside Excel, PowerPoint, Excalidraw and draw.io files | 🔴 | 🟢 planned |
| Highlight the keyword (or its line) after opening a result | 🔴 | 🟢 planned |

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

- **Whole-word matching** that also works in Chinese, Japanese and Korean text
- **Regular expressions**, with a clear message instead of an error while you are still typing the pattern
- **Case sensitivity** toggle
- **Folder lists**: search only some folders, or never search others
- **File-type lists**: search only some extensions, or never search others, decided from the path so skipped files are never read
- **Cross-format search**: find text inside Excel, PowerPoint, Excalidraw and draw.io files (see [below](#cross-format-search))
- **Highlight** the keyword, or its line, in the file you open from a result

Everything runs locally. The plugin makes no network requests.

---

## Cross-format search

Notes are not the only place your text lives. Rich Search is planned to search the readable text inside other file types in the vault, next to your notes, in one result list:

| Format | What is searched | Stage |
|---|---|:---:|
| Excalidraw (`.excalidraw`, `.excalidraw.md`) | Text elements, not the compressed drawing data | 1 |
| draw.io (`.drawio`, `.drawio.svg`) | Shape and label text | 1 |
| Excel (`.xlsx`) | Cell values, per sheet | 2 |
| PowerPoint (`.pptx`) | Slide text and speaker notes | 2 |

This is the other half of the file-type lists: instead of leaving a drawing out because its raw content looks like base64, the plugin reads the text a person would actually see, and searches that. A format with no reader is skipped, never searched as raw bytes. Stage 1 formats are plain JSON or XML; stage 2 formats are zip packages and need a bundled reader, so they come later.

---

## Settings

| Setting | What it does |
|---|---|
| Only search these folders | One folder per line. Empty means every folder. |
| Never search these folders | One folder per line. Takes priority over the list above. |
| Only search these file types | One extension per line. Empty means every type. |
| Never search these file types | One extension per line. Takes priority over the list above. |

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

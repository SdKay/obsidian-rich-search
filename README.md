<div align="center">

<img src="./docs/banner.png" alt="Rich Search" />

<p>
  <b>🔤 Whole word &nbsp;·&nbsp; 🧮 Regex &nbsp;·&nbsp; 📁 Search by folder &nbsp;·&nbsp; 🗂️ Search by file type &nbsp;·&nbsp; 🧩 Cross-format search &nbsp;·&nbsp; 🖍️ Highlight on open</b>
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
  <a href="#features">Features</a> ·
  <a href="#demo">Demo</a> ·
  <a href="#cross-format-search">Cross-format</a> ·
  <a href="#installation">Install</a> ·
  <a href="#settings">Settings</a> ·
  <a href="#development">Development</a> ·
  <a href="README_CN.md">中文</a>
</p>

<p>
  <img src="docs/wechat-qrcode.jpg" alt="WeChat public account" width="120" />
  <br/><sub>Follow on WeChat for more Obsidian plugins &amp; tools</sub>
</p>

<table>
  <thead>
    <tr><th colspan="3">Other plugins I build</th></tr>
    <tr><th>Plugin</th><th>Description</th><th>Install page</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://github.com/SdKay/obsidian-rich-table"><b>Rich Table</b></a></td>
      <td>Spreadsheet-like tables in notes, and a viewer for Excel files; their content is searchable from Rich Search</td>
      <td><a href="obsidian://show-plugin?id=rich-table">Open in Obsidian</a></td>
    </tr>
    <tr>
      <td><a href="https://github.com/SdKay/obsidian-rich-view"><b>Rich View</b></a></td>
      <td>Show draw.io, Visio and PowerPoint right in your notes; their text is searchable from Rich Search</td>
      <td><a href="obsidian://show-plugin?id=rich-view">Open in Obsidian</a></td>
    </tr>
  </tbody>
</table>

</div>

A powerful cross-file search tool for Obsidian. It matches whole words and regular expressions, limits the search to the folders and file types you choose, and searches the text inside PDF, Excalidraw, Excel, PowerPoint, draw.io and Visio files as well as Markdown files. Results are listed grouped by file; click one, or step through them with the arrow keys, to jump to the match, which is marked in the original.

---

## Features

- **A search panel** in the sidebar (ribbon icon or the *Open search* command): drag it to either side. The query box and options stay fixed while only the results scroll.
- **Whole-word matching** that also works in Chinese, Japanese and Korean text
- **Regular expressions**, with a clear message instead of an error while you are still typing the pattern
- **Case sensitivity** toggle
- **Searching starts as you type**, and Enter searches at once. A new query cancels the one still running.
- **Scope**: include folders and exclude folders (an exclusion inside an included folder carves it out), and tick the file types to search. Skipped files are never read.
- **Open a result** in the main area (Ctrl/Cmd+click for a new tab). A note opens with the matching line in the middle of the window, in reading view and in the editor alike.
- **Move through the results with the keyboard**: ↑ / ↓ select the previous or next result and open it without taking the focus away from the list. The selected result is shown with a background, as in VS Code.
- **Matches stay highlighted** in every open note, as in VS Code, for as long as the search panel is open and the query is not empty. Clicking, typing in the note and pressing Escape do not clear them. The match you opened is drawn brighter, with an outline, and the others dimmer. This works in the editor, in reading view and in Markdown tables.
- **Choose the highlight colour** in the settings. Every view that shows a match uses it.
- **Search history**: press ↑ / ↓ in the query box to step back and forth through earlier searches; each one restores the text, the three options and the scope. A button in the box lists them, newest first: click one to restore it, click the × after it to forget just that one, or choose *Clear history*.
- **Search in a folder**: right-click a folder in the file explorer and choose *Search in folder*. The include list becomes that folder, the exclude list is cleared, and the query already in the box is searched again.
- **Excalidraw drawings** are searched by the words in them, and clicking a result opens the drawing and zooms to the element (needs the Excalidraw plugin).
- **PDF files** are searched by the text on each page. Clicking a result opens the page in Obsidian's viewer, and the matches on the pages you scroll through are marked. A scanned PDF with no text layer cannot be searched and is counted among the files that could not be read. The first search of a large PDF takes a while; its text is kept in memory afterwards.
- **Excel, PowerPoint, draw.io and Visio files** are searched through the Rich Table and Rich View plugins, and clicking a result opens the file at the sheet and cell, the slide, or the shape (see [below](#cross-format-search)).
- **Many results**: the first 2,000 are shown with the true total above them, and a button shows more. Results appear as they are found, notes first.

---

## Demo

<!-- To add a demo: save the GIF under the name shown in each comment below, in docs/, then delete the "coming soon" line and the comment markers around the image line. -->

### Whole word, regex and scope

Type a word, switch on whole word or regular expression, and limit the search to some folders and file types. Results appear as they are found.

> 🎬 *Demo GIF coming soon*
<!-- ![Whole word, regex and scope demo](docs/demo-01-scope.gif) -->

### Opening a result

Every match stays highlighted in the open note while the panel is open, the one you opened is brighter with an outline, the line is centred, and ↑ / ↓ move through the results.

> 🎬 *Demo GIF coming soon*
<!-- ![Opening a result demo](docs/demo-02-open.gif) -->

### PDF and Excalidraw

Search the text of PDF pages and the words in an Excalidraw drawing. A PDF opens at its page with the matches marked; a drawing zooms to the element.

> 🎬 *Demo GIF coming soon*
<!-- ![PDF and Excalidraw demo](docs/demo-03-pdf-excalidraw.gif) -->

### Excel, PowerPoint, draw.io and Visio

With Rich Table and Rich View installed, their content is searched along with your notes. A result opens at its sheet and cell, its slide, or its shape.

> 🎬 *Demo GIF coming soon*
<!-- ![Cross-format search demo](docs/demo-04-cross-format.gif) -->

### History and searching in a folder

Open the history list to pick, forget or clear earlier searches. Right-click a folder in the file explorer to search only inside it.

> 🎬 *Demo GIF coming soon*
<!-- ![History and folder search demo](docs/demo-05-history-folder.gif) -->

---

## Cross-format search

Notes are not the only place your text lives. Rich Search reads the text a person would actually see in other files and lists it next to your notes. It does not read raw bytes, and it does not carry its own parsers: for formats Obsidian cannot show, it asks the plugin that already renders them.

| Format | Needs | What is searched | State |
|---|---|---|:---:|
| PDF (`.pdf`) | Obsidian's built-in PDF viewer | The text of each page | 🟢 |
| Excalidraw (`.excalidraw`) | [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) | The words in the drawing, not the compressed drawing data | 🟢 |
| Rich Table tables | [Rich Table](https://github.com/SdKay/obsidian-rich-table) | What the table shows, not its source | 🟢 |
| Excel (`.xlsx`) | [Rich Table](https://github.com/SdKay/obsidian-rich-table) | Cell values, per sheet. A result opens at its sheet and cell. | 🟢 |
| PowerPoint (`.pptx`) | [Rich View](https://github.com/SdKay/obsidian-rich-view) | Slide text. A result opens at its slide. | 🟢 |
| draw.io, Visio (`.vsdx`) | [Rich View](https://github.com/SdKay/obsidian-rich-view) | Shape and label text. A result opens at its page and shape. | 🟢 |

---

## Installation

**Community plugin browser (recommended):**

1. Open **Settings → Community plugins → Browse**
2. Search for **Rich Search** and install
3. Enable the plugin

**Manual:** copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/rich-search/`

Minimum Obsidian version: **1.8.7**. Works on desktop and mobile.

---

## Settings

In the settings tab:

| Setting | What it does |
|---|---|
| Treat .excalidraw.md as Excalidraw drawings | On: a drawing is its own file type, searched by the words in it. Off: it is an ordinary note. |
| Always exclude folders | One folder per line. They are left out of every search, in addition to the folders excluded in the search panel, and searching in a folder does not bring them back. |
| Open results in | Where a result opens when the search panel is in its own window. *Main window*: the note opens there. *The window of the panel*: it opens to the left of the panel, and later results reuse that tab. Ctrl/Cmd+click always opens a new tab. |
| Match highlight colour | The background of matched words, in the results, in opened notes, in PDFs, in tables and in the Rich Table and Rich View views. Neon yellow-green by default. The match you opened uses this colour; the others use a lighter tint of it. |

In the search panel's **Scope** section:

| Control | What it does |
|---|---|
| Include folders | Search only inside these. Empty means every folder. |
| Exclude folders | Never search these. Subtracted from the included folders. |
| File types | Tick the types to search. |

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

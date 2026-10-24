<div align="center">

<img src="./docs/banner.png" alt="Rich Search" />

<p>
  <b>🔤 全词匹配 &nbsp;·&nbsp; 🧮 正则表达式 &nbsp;·&nbsp; 📁 目录黑白名单 &nbsp;·&nbsp; 🗂️ 文件类型黑白名单 &nbsp;·&nbsp; 🧩 跨类型搜索 &nbsp;·&nbsp; 🖍️ 打开后高亮</b>
</p>

<p>
  <a href="https://github.com/SdKay/obsidian-rich-search/releases/latest">
    <img src="https://img.shields.io/github/v/release/SdKay/obsidian-rich-search?style=flat-square&color=7c3aed" alt="最新版本" />
  </a>
  <a href="https://github.com/SdKay/obsidian-rich-search/releases">
    <img src="https://img.shields.io/github/downloads/SdKay/obsidian-rich-search/total?style=flat-square&color=brightgreen" alt="总下载量" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/SdKay/obsidian-rich-search?style=flat-square" alt="许可证" />
  </a>
  <a href="https://obsidian.md/plugins?id=rich-search">
    <img src="https://img.shields.io/badge/Obsidian-社区插件-7c3aed?style=flat-square&logo=obsidian&logoColor=white" alt="Obsidian 社区插件" />
  </a>
  <a href="https://paypal.me/ssdking">
    <img src="https://img.shields.io/badge/赞助-PayPal-003087?style=flat-square&logo=paypal&logoColor=white" alt="通过 PayPal 赞助" />
  </a>
</p>

<p>
  <a href="#为什么选择-rich-search">为什么</a> ·
  <a href="#安装">安装</a> ·
  <a href="#功能">功能</a> ·
  <a href="#跨类型搜索">跨类型搜索</a> ·
  <a href="#设置">设置</a> ·
  <a href="#开发">开发</a> ·
  <a href="README.md">English</a>
</p>

<p>
  <img src="docs/wechat-qrcode.jpg" alt="微信公众号二维码" width="120" />
  <br/><sub>扫码关注公众号，获取更多 Obsidian 插件与效率工具资讯</sub>
</p>

</div>

> **状态：开发早期，尚未发布。** 搜索面板、匹配、目录与文件类型范围、搜索历史、笔记与 Excalidraw 绘图中的高亮，以及搜索 Excel 工作簿，已在作者的笔记库里可用。在工作簿里定位到单元格，以及搜索 draw.io、Visio、PowerPoint 文件，依赖仍在开发中的配套插件，下文标为*计划中*。

为 Obsidian 补上自带搜索的短板：支持全词与正则匹配，自己决定搜索哪些目录、哪些文件类型，并在打开的文件里高亮关键字。

---

## 为什么选择 Rich Search？

Obsidian 自带搜索用来快速查一下很方便，但笔记库变大之后就不够用了：

| 需求 | 自带搜索 | Rich Search |
|---|:---:|:---:|
| 只匹配完整单词 | 🔴 | 🟢 |
| 正则表达式 | 🟡 有限 | 🟢 |
| 包含 / 排除目录 | 🔴 | 🟢 |
| 按文件类型勾选 | 🔴 | 🟢 |
| 让 Excalidraw 绘图数据不再混入结果，只搜绘图里的文字 | 🔴 | 🟢 |
| 搜索 Excel 工作簿里的文字 | 🔴 | 🟢（定位到单元格：计划中） |
| 搜索 PowerPoint、draw.io 文件里的文字 | 🔴 | 🟡 计划中 |
| 打开结果后高亮关键字 | 🔴 | 🟢 |
| 用方向键回溯之前的搜索 | 🔴 | 🟢 |

图例：🟢 支持　🟡 部分支持　🔴 不支持

---

## 安装

**推荐 — 社区插件浏览器（发布后）：**

1. 打开 **设置 → 第三方插件 → 浏览**
2. 搜索 **Rich Search** 并安装
3. 启用插件

**手动安装：** 将 `main.js`、`manifest.json`、`styles.css` 复制到 `<vault>/.obsidian/plugins/rich-search/`

最低 Obsidian 版本：**1.8.7**。支持桌面端和移动端。

---

## 功能

- **侧边栏搜索面板**（左侧工具栏图标，或命令“打开搜索”）：可拖到任意一侧。查询框和选项固定在顶部，只有结果区滚动。
- **全词匹配**，对中文、日文、韩文同样有效
- **正则表达式**；输入到一半时只提示原因，不会报错中断
- **区分大小写**开关
- **边输入边搜索**，按回车立即搜索；新的查询会取消仍在进行的上一次搜索
- **搜索范围**：包含目录与排除目录（排除目录若在包含目录之内，则从中扣除），并勾选要搜索的文件类型。被跳过的文件根本不会被读取。
- **搜索历史**：在查询框按 ↑ / ↓ 在之前的搜索间来回切换，每次都会恢复关键字、三个选项和搜索范围。
- **打开结果**到主编辑区（Ctrl/Cmd+点击在新标签页打开），命中的词会被高亮。Markdown 表格里则标出命中的单元格并滚动到可见位置。
- 可在设置里**自定义高亮颜色**。*（尚未在真实笔记库中确认）*
- **Excalidraw 绘图**按其中的文字搜索，点击结果会打开绘图并缩放到对应元素（需要 Excalidraw 插件）。
- **Excel 工作簿**通过 Rich Table 插件搜索（见[下文](#跨类型搜索)）。
- **结果很多时**：只显示前 2000 条，上方显示真实总数，并提供按钮继续显示更多。*（尚未在真实笔记库中确认）*

全部在本地运行，插件不会发起任何网络请求。

---

## 跨类型搜索

文字不只存在于笔记里。Rich Search 会读出其他文件里人真正看得到的文字，并和笔记一起列出。它不读原始字节，也不自带解析器：对 Obsidian 本身显示不了的格式，它向已经负责渲染该格式的插件要文字。

| 格式 | 依赖 | 搜索的内容 | 状态 |
|---|---|---|:---:|
| Excalidraw（`.excalidraw.md`） | 需要 Excalidraw 插件才能打开 | 绘图里的文字，而不是压缩后的绘图数据 | 🟢 |
| Excel（`.xlsx`） | [Rich Table](https://github.com/SdKay/obsidian-rich-table) | 各工作表的单元格内容 | 🟢 搜索 · 定位到单元格：计划中 |
| draw.io、Visio、PowerPoint | [Rich View](https://github.com/SdKay/obsidian-rich-view) | 图形、标签与幻灯片文字 | 计划中 |

某种类型对应的插件没安装、或装了但没启用时，范围面板里会把它置灰并写明该怎么做。在设置里启用插件后，回到搜索面板时应能自动识别，无需重载。*（尚未在真实笔记库中确认）*

这是文件类型名单的另一半：不是因为绘图文件的原始内容像 base64 就把它整个排除，而是只搜其中的文字。

笔记里的围栏代码块可以按语言跳过。默认只跳过 Excalidraw 的 `compressed-json` 块，目前可在数据文件里修改。

---

## 设置

设置页：

| 设置项 | 作用 |
|---|---|
| 将 .excalidraw.md 视为 Excalidraw 绘图 | 开启：绘图是独立的文件类型，按其中的文字搜索。关闭：当作普通笔记。 |
| 匹配高亮颜色 | 命中词在结果列表和打开的笔记中的底色，默认荧光黄绿。 |

搜索面板的**范围**区：

| 控件 | 作用 |
|---|---|
| 包含目录 | 只在这些目录内搜索，留空表示所有目录。 |
| 排除目录 | 始终不搜索，会从包含目录中扣除。 |
| 文件类型 | 勾选要搜索的类型。 |

### 界面语言

界面语言跟随 Obsidian 的语言设置，目前支持：English、简体中文，其他语言显示英文。新增语言只需创建 `src/i18n/<code>.ts` 并在 `src/i18n/index.ts` 里注册一行；欢迎通过 PR 修正翻译或新增语言。

---

## 开发

```bash
npm install
npm run dev          # 监听构建
npm test             # 单元测试
npm run test:e2e     # 浏览器测试（首次运行：npx playwright install chromium）
npm run verify:ci    # 干净安装、构建、changelog 校验、测试
```

---

## 许可证

[AGPL-3.0](LICENSE)——衍生作品须以相同协议开源。

**商业授权**请联系：sdkxyx@gmail.com

---

## 赞助支持

Rich Search 基于 AGPL-3.0 协议免费开源。如果这个插件让你的工作流更顺手，欢迎自愿赞助，帮助我持续修复问题、增加功能。

### 🌍 PayPal
[![通过 PayPal 赞助](https://img.shields.io/badge/赞助-PayPal-003087?style=flat-square&logo=paypal&logoColor=white)](https://paypal.me/ssdking)

### 🧧 微信 / 支付宝

| 微信 | 支付宝 |
|:---:|:---:|
| <img src="docs/wechat-donate.jpg" width="120" alt="微信赞助收款码" /> | <img src="docs/alipay-donate.jpg" width="120" alt="支付宝赞助收款码" /> |

感谢你的支持！🙏

---

## 支持与反馈

问题与功能建议：[GitHub Issues](https://github.com/SdKay/obsidian-rich-search/issues)

---

[![Star History Chart](https://api.star-history.com/svg?repos=SdKay/obsidian-rich-search&type=Date)](https://star-history.com/#SdKay/obsidian-rich-search&Date)

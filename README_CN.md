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

> **状态：开发早期。** 项目地基、测试和发布流程已就绪，下面的搜索功能正在开发中，目前尚未发布。

为 Obsidian 补上自带搜索的短板：支持全词与正则匹配，自己决定搜索哪些目录、哪些文件类型，并在打开的文件里高亮关键字。

---

## 为什么选择 Rich Search？

Obsidian 自带搜索用来快速查一下很方便，但笔记库变大之后就不够用了：

| 需求 | 自带搜索 | Rich Search |
|---|:---:|:---:|
| 只匹配完整单词 | 🔴 | 🟢 计划中 |
| 正则表达式 | 🟡 有限 | 🟢 计划中 |
| 目录白名单 / 黑名单 | 🔴 | 🟢 计划中 |
| 文件类型白名单 / 黑名单 | 🔴 | 🟢 计划中 |
| 让 Excalidraw、类似 base64 的文件不再混入结果 | 🔴 | 🟢 计划中 |
| 搜索 Excel、PowerPoint、Excalidraw、draw.io 文件里的文字 | 🔴 | 🟢 计划中 |
| 打开结果后高亮关键字（或所在行） | 🔴 | 🟢 计划中 |

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

- **全词匹配**，对中文、日文、韩文同样有效
- **正则表达式**；输入到一半时只提示原因，不会报错中断
- **区分大小写**开关
- **目录名单**：只搜索某些目录，或始终跳过某些目录
- **文件类型名单**：只搜索某些扩展名，或始终跳过某些扩展名；按路径判断，被跳过的文件根本不会被读取
- **跨类型搜索**：搜索 Excel、PowerPoint、Excalidraw、draw.io 文件里的文字（见[下文](#跨类型搜索)）
- 从结果打开文件后，**高亮**关键字或其所在行

全部在本地运行，插件不会发起任何网络请求。

---

## 跨类型搜索

文字不只存在于笔记里。Rich Search 计划在同一个结果列表里，把笔记库中其他类型文件里的可读文字也一并搜索出来：

| 格式 | 搜索的内容 | 阶段 |
|---|---|:---:|
| Excalidraw（`.excalidraw`、`.excalidraw.md`） | 文本元素，而不是压缩后的绘图数据 | 1 |
| draw.io（`.drawio`、`.drawio.svg`） | 图形与标签上的文字 | 1 |
| Excel（`.xlsx`） | 各工作表的单元格内容 | 2 |
| PowerPoint（`.pptx`） | 幻灯片文字与演讲备注 | 2 |

这是文件类型名单的另一半：不是因为绘图文件的原始内容像 base64 就把它整个排除，而是读出人真正看得到的文字，只搜这部分。没有对应读取器的格式会被直接跳过，绝不会按原始字节去搜。阶段 1 的格式本质是 JSON 或 XML；阶段 2 的格式是 zip 包，需要内置读取器，所以排在后面。

---

## 设置

| 设置项 | 作用 |
|---|---|
| 只搜索这些目录 | 每行一个目录，留空表示搜索所有目录。 |
| 不搜索这些目录 | 每行一个目录，优先于上面的列表。 |
| 只搜索这些文件类型 | 每行一个扩展名，留空表示搜索所有类型。 |
| 不搜索这些文件类型 | 每行一个扩展名，优先于上面的列表。 |

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

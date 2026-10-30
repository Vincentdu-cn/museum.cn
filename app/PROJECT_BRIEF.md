# 藏珍集 · 项目精简报告

> 目标读者：大模型 / 新接手开发者。读完即可建立完整心智模型。

## 一句话定位

一个**纯前端静态 SPA**（无框架、无构建步骤），展示「国家禁止出境展览文物」与「全国一二级博物馆」档案。中文文博主题，编辑/档案视觉风格。

## 技术栈

- **前端**：原生 HTML + 原生 JS + 原生 CSS，零依赖、零打包。
- **唯一的第三方库**：OpenSeadragon 4.1.0（CDN 引入），用于文物图片的深缩放（DZI 瓦片）查看。
- **字体**：Google Fonts（Playfair Display 衬线 + Inter 无衬线）。
- **部署**：纯静态文件，任意 HTTP 服务器即可（`python3 -m http.server` 或直接 open）。
- **大文件管理**：`img/` 与 `dzi/` 通过 **Git LFS** 管理（见 `.gitattributes`）。

## 目录结构

```
culture/
├── index.html      # SPA 外壳：报头导航 + <template> 占位 + 脚本引入
├── app.js          # 全部交互逻辑（557 行，hash 路由 SPA）
├── styles.css      # 全部样式（500 行，CSS 变量 + 分章节）
├── data.json       # 数据源（~1.3MB，单文件全量数据）
├── img/            # 文物/博物馆图片（LFS）
├── dzi/            # 深缩放瓦片（OpenSeadragon，LFS）
├── camofox.py      # [旁路工具] Camoufox 反检测浏览器 REST 客户端，非前端运行时依赖
└── .gitattributes  # img/ dzi/ 走 LFS
```

## 架构与运行机制（app.js 核心）

1. **单页 hash 路由**：`#/`（首页）、`#/wenwu`、`#/wenwu/:id`、`#/museums`、`#/museums/:id`。`hashchange` 触发 `route()`，根据 hash 渲染到 `#view`。
2. **数据加载**：`loadData()` 一次性 `fetch('data.json?v=' + __DATA_VER)` 并缓存到 `state.data`，建立 `museumById` 索引。`__DATA_VER` 用于强制刷新缓存。
3. **渲染策略（关键设计）**：列表页的**工具栏（input/select）只渲染一次**，结果区只在 `#results` 内局部替换——避免中文输入法（IME）因元素被销毁而打断。所有渲染走字符串模板拼接 + `innerHTML`。
4. **筛选**：`applyWenwuFilters()` / `applyMuseumFilters()` 纯函数，支持批次/朝代/博物馆/省份/质量/主题/有无图 + 关键字搜索。
5. **交互组件**：lightbox 灯箱看图、DZI 深缩放浮层（`openDziOverlay`）、首屏统计 chips 跳转筛选。
6. **状态**：全局 `state` 对象（数据、搜索词、各筛选项），无状态管理库。

## 数据模型（data.json）

顶层 4 个键：

- `meta`：标题、数据来源说明。
- `stats`：预聚合统计（朝代/省份/质量/主题/批次分布），供首页大数字与 chips 直接消费，前端不再聚合。
- `wenwu`：**195 条**禁止出境文物。字段：`id, batch(1-3批), name, era, site, museum_id, museums_rel(成套文物多馆), image, intro, baike_*` 等。
- `museums`：**1003 条**一二级博物馆。字段：`id, name, quality(一级/二级), province, city, topic, founded, is_free, address, image_file/url, intro` 等。

数据来源（见 footer）：国家文物局博物馆名录 + 维基百科「禁止出境展览文物」+ 百度百科，为整理产物。

## 样式体系（styles.css）

- 10 个章节，CSS 变量驱动：报头导航 / 首页 Hero / 首页板块 / 编辑摘要骨架 / 空状态 / 详情页 / 页脚 / 响应式 / 灯箱。
- 设计语言：**Editorial 档案风**——衬线标题、克制的强调色（赭红系 accent）、骨架屏 skeleton、卡片网格。
- 可访问性：`skip-link`、`aria-label`、`loading="lazy"`、键盘 ESC 关闭浮层。

## 旁路工具：camofox.py

独立的 CLI 客户端，调用 `http://192.168.199.178:9377` 的 **Camoufox 反检测浏览器** REST API（开/关标签、导航、截图、点击、快照、结构化提取等）。**不参与前端运行时**，属于数据采集/调试辅助脚本。若改部署环境需同步改 `BASE` 常量。

## 开发须知（改代码前必读）

- 改 `data.json` 数据时**务必同步更新 `stats`**——首页统计直接读它，前端不重算。
- 改数据后递增 `index.html` 与 `app.js` 中的 `__DATA_VER` / 文件版本号（`?v=`），否则浏览器缓存旧数据。
- 列表页搜索框交互依赖「工具栏不被重渲染」，**不要**在筛选后把整个列表页 `innerHTML` 整体替换。
- `wenwuImg()` **原样返回**数据里的 `image` 字段，不做任何 URL 改写——历史曾因硬套维基 thumb 模板导致满屏破图（见注释）。
- `img/`、`dzi/` 是 LFS 文件，克隆后需 `git lfs pull` 才有真实图片。

## 一行启动

```bash
cd culture && python3 -m http.server 8000   # 访问 http://localhost:8000
```

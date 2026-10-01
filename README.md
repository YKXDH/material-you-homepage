<div align="center">

# 个人主页 · Material You

**零依赖 · 零构建 · 纯静态** 的个人主页 / 导航页
Material You（Material Design 3）风格 · 背景图轮播 · 动态取色 · 毛玻璃 · 亮暗双模式 · 移动优先

[![License: MIT](https://img.shields.io/badge/License-MIT-3E5F92.svg)](LICENSE)
[![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#-项目结构)
[![Build: none](https://img.shields.io/badge/build-none%20required-brightgreen.svg)](#-部署)
[![Design: Material You](https://img.shields.io/badge/design-Material%20You-6750A4.svg)](#)

**在线预览：<https://home.tskxqxkxhexi.top>**

<sub>English: A dependency-free, zero-build static personal homepage / link hub in Material You (Material Design 3) style, featuring a background slideshow and dynamic (Monet-like) color extraction from the current background image.</sub>

</div>

---

## 📌 这是什么

一个可以直接丢到任意静态托管上跑的个人主页：**左边是你的个人信息，右边是你的社交媒体 / 常用网站卡片**，点一下就走。

整套东西只有 HTML + CSS + JS 加一个数据文件，**没有任何依赖、没有构建步骤**：不需要 npm，不需要打包器，不需要 CI 配置。改完 `data.js` 推到 GitHub，Cloudflare Pages（或 GitHub Pages / Netlify / Vercel / 自己的服务器）就会自动部署。

视觉上它遵循 **Material You（Material Design 3）**：完整的 M3 设计令牌、圆角与层级、状态层反馈；并且会 **从当前背景图里实时提取主色**，推导出整套配色 —— 背景图每换一张，全站配色跟着变。

**目录**

- [✨ 特性](#-特性)
- [🚀 快速开始](#-快速开始)
- [🗂 项目结构](#-项目结构)
- [🎨 配置详解](#-配置详解)
- [🛠 可视化编辑器](#-可视化编辑器)
- [🧠 动态取色是怎么工作的](#-动态取色是怎么工作的)
- [🧩 图标说明](#-图标说明)
- [☁️ 部署](#-部署)
- [❓ 常见问题](#-常见问题)
- [🌐 浏览器支持](#-浏览器支持)
- [🤝 贡献与二次开发](#-贡献与二次开发)
- [📝 更新日志](#-更新日志)
- [📄 开源协议](#-开源协议)

---

## ✨ 特性

| | |
|---|---|
| 🎨 **Material You 视觉** | 完整的 M3 设计令牌（primary / container / surface 层级 / outline / shape / elevation），圆角、状态层、涟漪反馈；应用栏与卡片统一换肤 |
| 🌈 **动态取色（类 Monet）** | 从**当前背景图**提取主色并实时推导整套配色；取色在 CIELAB 空间完成，明暗层级与对比度符合 M3 预期 |
| 🖼 **背景轮播** | 多张背景图按间隔淡入淡出切换，自带**下一张预载**、**坏图自动剔除**、**后台自动暂停** |
| 🆕 **新增背景图自动识别** | 往 `backgrounds/` 里丢一张新图（按命名约定命名）即可，**不用回来改配置**，下次打开自动进轮播 |
| 🧊 **毛玻璃表面** | 卡片 / 应用栏用 `backdrop-filter` 做半透明玻璃；背景之上再叠一层主题色遮罩，保证正文可读性 |
| 🌗 **亮暗双模式** | 默认跟随系统，可手动切换，选择记在本地 |
| 📱 **响应式** | 手机单列、桌面双栏（左栏个人信息吸顶跟随），断点 1024 / 1440px |
| 🔗 **两种卡片** | 「点击跳转」（可新标签页 / 当前页打开）与「点击复制」（QQ 号、邀请码这类没有网址的） |
| 🧩 **图标零维护** | 默认走 Simple Icons CDN，写个名字就行；未收录的平台可内置 SVG，或换成 `iconUrl` 指向本地图片 |
| 🛠 **可视化编辑器** | 自带同风格的 Web 编辑器：表单化改配置、右侧实时预览（真·原版渲染）、导入导出 `data.js`、导出前配置检查 |
| ♿ **可访问性** | `:focus-visible` 键盘焦点、`prefers-reduced-motion`、`prefers-contrast`、语义化标签与 `aria-*` |
| 🚫 **零依赖 / 零构建** | 没有 `node_modules`，没有构建产物，克隆下来就能跑 |

---

## 🚀 快速开始

```bash
git clone https://github.com/YKXDH/material-you-homepage.git my-homepage
cd my-homepage

# 任意静态服务器都行，例如：
python3 -m http.server 8080
# 然后打开 http://localhost:8080
```

接着编辑 **`data.js`**（唯一需要你改的文件），刷新页面就能看到效果。

> **不要直接双击 `index.html`**：`file://` 协议下浏览器会限制读取图片像素，动态取色会失败并自动回退到默认色（背景图仍会正常轮播、毛玻璃也照常，只是配色不跟着变）。用上面的本地服务器即可。

---

## 🗂 项目结构

```
.
├── index.html        # 页面结构：顶部应用栏 + 背景图层 + 主内容骨架
├── style.css         # Material 3 设计令牌 + 全部组件样式 + 背景/毛玻璃
├── script.js         # 动态取色引擎 + 渲染 + 交互 + 背景轮播 + 自动识别
├── data.js           # ★ 唯一需要你手动编辑的文件（个人信息 / 链接 / 背景 / 主题）
├── editor.html       # 🛠 可视化编辑器（可选工具：表单化改 data.js，不参与站点渲染）
├── editor.css        # 编辑器样式：复用同一套 M3 令牌与通用组件类
├── editor.js         # 编辑器逻辑：表单渲染 / 实时预览 / 导入导出 / 配置检查
├── backgrounds/      # 背景图（本仓库 9 张 webp，长边 1800px，合计约 1.4MB）
├── avatar.webp       # 头像（512×512，约 100KB；换成 jpg/png 或图片直链也行）
├── favicon.png       # 站点图标（由头像裁剪而来）
├── 404.html          # 访问不存在的路径时显示（复用同一套令牌，随亮暗模式）
├── _headers          # Cloudflare Pages 响应头配置（缓存策略 + 安全头）
├── README.md         # 本文档（部署时留着也行，不影响运行）
├── LICENSE           # MIT
└── .gitignore
```

**你只需要改 `data.js`。** 其余文件除非要改样式或功能，否则不用动。不想手写配置文件的话，直接用下面的 [可视化编辑器](#-可视化编辑器)。

`script.js` 内部按职责分段，想加功能时按这张表找位置：

| 段落 | 主要内容 |
|---|---|
| 色彩引擎 | `hexToLch` / `lchToHex` / `buildScheme` / `analyzeImage`，纯计算、与 DOM 无关 |
| 渲染 | `render*` 系列：个人信息、分组、卡片、页脚 |
| 交互 | `wire*` 系列：主题切换、复制卡片、分享、应用栏高度测量 |
| 背景 | `initBackground` / `showBackground` / `computeFit` / `scanBackgrounds` / `rescanBackgrounds` 等 |
| 启动 | 读 `data.js` → 渲染 → 初始化背景 → 绑定交互 |

`style.css` 顶部是 M3 令牌（`--md-*` 变量），下面才是组件样式 —— **换皮肤基本只改令牌**。

### 页面布局（响应式断点）

| 视口宽度 | 布局 |
|---|---|
| < 1024px | 单列纵向：个人信息居中在上，链接卡片单列平铺 |
| ≥ 1024px | **双栏**：左侧 336px 个人信息栏吸顶跟随，右侧链接卡片 2~3 列 |
| ≥ 1440px | 容器放宽至 86rem，侧栏 368px，卡片列宽进一步加大 |

桌面端的具体处理：

- 侧栏用 `position: sticky` 吸附在顶部应用栏下方，滚动时个人信息始终可见；
  应用栏高度由 `script.js` 实测后写入 CSS 变量 `--appbar-h`，因此在带
  `env(safe-area-inset-top)` 的机型（刘海屏等）上吸顶位置也准确
- 两栏顶部**精确对齐**：头像顶边与右侧第一个分组标题顶边处于同一水平线
- 侧栏的头像放大到 136px、圆角 32px；「邮件联系我 / 复制主页链接」变为通栏按钮
- 所有 `:hover` 效果都包在 `@media (hover: hover)` 里，触屏设备不会出现
  点按后阴影/位移「粘住」的问题

---

## 🎨 配置详解

下面这些**全部**在 `data.js` 里。

### 1. 个人信息

```js
profile: {
  name: '你的名字',
  handle: '@your_id',
  avatar: 'avatar.webp',       // 换成 avatar.jpg 或图片直链都行
  tagline: '一句话签名',
  // 简介：换行用 \n；想强调某段文字，用 **两个星号** 包起来即可渲染成高亮色块
  bio: '多行介绍，用 \\n 换行',
  location: '中国 · 某地',
  chips: ['前端开发', '摄影'],
  email: 'you@example.com',
  footer: '',                  // 页脚第一行；留空则自动生成 "© 年份 名字"
  copyright: ''                // 页脚第二行（版权声明等）；留空就整个不显示，没有默认文案
}
```

### 2. 链接与分组

每个链接卡片：

```js
{ label: 'GitHub', desc: '代码与开源项目', url: 'https://github.com/you', icon: 'github' }
```

| 字段 | 说明 |
|---|---|
| `label` | 按钮主文字（必填） |
| `desc` | 按钮副文字，一句话说明（可选） |
| `url` | 跳转地址（必填，记得带 `https://`） |
| `copy` | **代替 `url`**：卡片变成「点击复制」，点一下把这段字符串复制到剪贴板（适合 QQ 号、邀请码这类没有网页地址的东西） |
| `icon` | [Simple Icons](https://simpleicons.org) 的图标名，如 `github`、`bilibili`、`zhihu` |
| `iconUrl` | 直接用一张图片当图标（优先级高于 `icon`） |
| `color` | 图标颜色，不填 = 跟随主题主色；`'brand'` = 用品牌原色；也可写 `'#FF0000'` |
| `sameTab` | `true` 表示当前标签页打开（默认新标签页。`mailto:` 这类建议加上） |
| `featured` | `true` 表示显示为醒目的大卡片（宽屏下占两列） |

例子：

```js
// 普通跳转（新标签页打开）
{ label: 'GitHub', desc: '代码与开源项目', url: 'https://github.com/you', icon: 'github' }

// 打开邮件客户端（当前页打开，避免多出一个空白标签页）
{ label: '电子邮箱', desc: 'you@gmail.com', url: 'mailto:you@gmail.com', icon: 'gmail', sameTab: true }

// 点击复制（没有可跳转的地址时用 copy 代替 url）
{ label: 'QQ', desc: '123456789 · 点击复制', copy: '123456789', icon: 'qq' }
```

分组用 `groups` 数组，每组可带 `title` 和 `subtitle`：

```js
groups: [
  { title: '社交媒体', subtitle: '最常出没的地方', links: [ /* ... */ ] },
  { title: '常用网站', links: [ /* ... */ ] }
]
```

### 3. 主题 / 取色来源

```js
theme: {
  // 取色来源：
  //   'background' = 跟随当前背景图（推荐：背景每换一张，整套配色跟着变）
  //   'avatar'     = 跟随头像（旧版行为）
  //   'none'       = 不取色，固定用下面的 fallbackSeed
  extractFrom: 'background',
  hueShift: 0,                    // 取色结果整体偏转多少度（0~360）
  fallbackSeed: '#6750A4',        // 取色失败时的兜底主色
  mode: 'auto'                    // 'auto' | 'light' | 'dark'
}
```

想**固定**某个主色：把 `fallbackSeed` 改成你的色值，并把 `extractFrom` 设为 `'none'`；
想改回**跟随头像**，把 `extractFrom` 改成 `'avatar'` 即可。

### 4. 背景图轮播 & 毛玻璃

```js
background: {
  images: [                 // 显式列出的图（一定在轮播里，顺序照你写的来）
    'backgrounds/bg-01.webp',
    'backgrounds/bg-02.webp'
    // ...
  ],
  autoScan: {               // 自动识别新图：往 backgrounds/ 里丢新图后不用回来改上面的 images
    enabled: true,
    pattern: 'backgrounds/bg-{n2}.webp',  // {n}=1,2,3…；{n2}=01,02…；{n3}=001,002…
    from: 1,                // 从几号开始探
    to: 60,                 // 探到几号为止（上限；通常早就因连续未命中而停了）
    missLimit: 2,           // 连续几个序号探不到就收工
    exclude: []             // 想跳过哪几张：写序号或完整地址，例如 [4, 'backgrounds/bg-07.webp']
  },
  interval: 3,              // 每张停留几秒（最小 1 秒）
  blur: 16,                 // 毛玻璃模糊强度（px）；0 = 不模糊
  veil: 0.68,               // 主题色遮罩浓度（0~1）：越大背景越淡、正文越清晰
  followColor: true,        // 配色是否跟随当前背景图（"网页自动取背景色"）
  fit: 'cover',             // 背景缩放方式：'cover' 等比放大刚好填满整页（默认）| 'contain' 完整显示不裁切 | 'auto' 自动挑
  cropLimit: 0.35,          // 仅 fit:'auto' 生效：用 cover 时最多容忍裁掉画面多少（0~1），超过就改用完整显示
  fillBlur: 36,             // 仅 fit:'contain' 生效：四周留白填充层的模糊强度（px）
  loop: true,               // false = 依次播到最后一张就停住；true = 播完再从第一张循环
  paused: false             // true = 只显示第一张、不轮播
}
```

> 上表是字段说明用的示例值，**本仓库当前实际用的是** `interval: 5`、`blur: 2`、`veil: 0.50`、`fit: 'cover'`、`loop: true`（以 `data.js` 为准）。

#### 背景缩放

**默认 `fit: 'cover'`：等比放大到刚好填满整个页面**，比例不变形，多出来的部分裁掉，四周不会有任何留白。
这是 CSS 标准的 `background-size: cover` 行为：

```
cover 缩放比 scale = max(视口宽 / 图宽, 视口高 / 图高)
```

> 注意：因为背景图都是横向宽图（1.5:1 ~ 2.35:1），在手机竖屏上「填满」意味着画面横向会被裁掉大半
> （390×844 时只剩约 30% 宽度）—— 这是「填满」的必然代价，不是 bug。
> 若你更希望**整张图都看得见**（宁可上下留白），把 `fit` 改成 `'contain'`：
> 整张图等比缩放到看得全，四周留白由一层**同一张图的重度模糊放大版**（`#bgFill`，模糊强度取 `fillBlur`）填上，不会出现黑边。

如果想要「视情况自动挑」，把 `fit` 设成 `'auto'`：脚本按下面的式子算一遍，
只有裁得太狠（`visible < 1 - cropLimit`，默认即露出不足 65%）才退回 `contain`：

```
铺满后能露出多少 visible = (视口宽 × 视口高) ÷ (图宽 × 图高 × scale²)
```

`'auto'` 的判定是**逐图**做的：同一屏下 `bg-08`（2.35:1）可能用 `cover`，而 `bg-02`（1.51:1）可能用 `contain`。

另外，模糊之后图片边缘会「化开」露出底色，所以图层要稍微放大一点点盖住那一圈；
这个放大值也是算出来的：`1 + 2 × blur ÷ min(视口宽, 视口高)`，**窗口越大放得越少**
（旧版固定放大 8%，在手机上等于白裁一大块）。填充层同理，用 `fillBlur` 算自己的放大值。

视口尺寸变化时（转屏、拖窗口、手机地址栏收起/展开）会自动重算并切换，无需刷新页面。
调试时可用 `?debug=1` 打开控制台，执行 `__homepage.refitBackground()` 手动重算，
或 `__homepage.computeFit('backgrounds/bg-01.webp')` 看某张图当前的判定结果。

#### 新增背景图会自动识别

往 `backgrounds/` 里丢一张新图，**不用回来改 `data.js`**，下次打开就自动出现在轮播里
（文件名要符合 `autoScan.pattern` 约定的序号，例如 `bg-10.webp`）。

为什么是「按约定探测」而不是「扫描目录」？因为这是纯静态站：Cloudflare Pages、GitHub Pages 这类托管
**没有目录列表接口**，浏览器也无法问服务器「这个文件夹里都有什么文件」。所以做法是：

```
把 pattern 里的 {n2} 依次换成 01、02、03… 去试着加载
  能加载出来 → 这张图存在 → 记下来，并入轮播列表
  连续 missLimit 个序号都加载不出来 → 收工（不会把 1~60 全试一遍）
```

几个要点：

- **开销很小**：9 张图时只会发约 11 个请求（其中 9 个还命中 HTTP 缓存，因为 `_headers` 给背景图配了一天缓存），
  不会拖慢打开速度；探测排在首屏之后执行，第一张背景不等待它。
- **顺序**：探到的图接在 `images` 里显式列出的那几张之后，且按序号升序。
- **日志**：只有真的发现新图时才在控制台打一行
  `[homepage] 自动识别到 N 张新增背景图，已加入轮播：…`（没有新增就保持安静）。
- **想跳过某几张**：往 `autoScan.exclude` 里写序号或完整地址，例如 `[4, 'backgrounds/bg-07.webp']`
  （被排除的序号既不算命中也不算未命中，不会导致探测提前中断）。
- **不想用**：把 `autoScan.enabled` 设为 `false`；此时只认 `images` 里显式列出的图。
- **完全不写清单**：把 `images` 留成 `[]` 也行 —— 整套轮播完全由探测结果构成。
  此时如果一张图都没探到，页面会自动退回原本的柔和渐变底色（不会出错）。
- **改了图片但不想刷新页面**：控制台执行 `__homepage.rescanBackgrounds()` 强制重探一次。
- **注意**：序号必须是连续的。如果你把图命名成 `bg-01`、`bg-05`、`bg-09`（中间跳号超过 `missLimit` 个），
  探测会在 `bg-03` 附近停下，后面那些就探不到了 —— 这种情况把它们写进 `images`，或把 `missLimit` 调大。

#### 效果是怎么做出来的

| 层 | 元素 | 作用 |
|---|---|---|
| 背景图层 | `#bgA` / `#bgB` | 两张图层交替淡入淡出（900ms）；`background-size` 由 `fit` 决定（`cover` 铺满 / `contain` 看全）；模糊由 `filter: blur()` 实现，并按算出的 `--bg-zoom` 放大一点点盖住模糊边缘 |
| 填充层 | `#bgFill` | 只在「完整显示」模式下亮起：同一张图用 `cover` + 重度模糊（`fillBlur`）铺满留白区，颜色与主角是同一张图，所以不会突兀 |
| 遮罩层 | `#bgVeil` | 用当前主题的 `surface` 色按 `veil` 浓度盖一层，顶部再补一点主色氛围；亮/暗模式自动跟着变 |
| 玻璃表面 | 卡片 / 应用栏 | 半透明底色（`rgba(var(--md-xxx-rgb), α)`）+ `backdrop-filter: blur()`，做出「玻璃上浮着卡片」的观感 |

其它行为：

- **换图即换色**：每张背景图加载完成后立刻在 64×64 画布上取一次色，取到的种子写入整套 M3 令牌；同一张图循环回来时用缓存，不重复计算。
- **提前预载**：当前图显示后立即预载下一张，切换时不会空一拍。
- **播到最后一张就停**：`loop: false` 时，轮播到 `images` 的最后一张后定时器自动停止，画面停在最后一张上不动（不会突然跳回第一张）。想让它一直循环，把 `loop` 改成 `true`。
- **坏图自动剔除**：某张图加载失败（文件被删、路径写错、404）时，脚本会把它从轮播队列里即时移除、立刻跳到下一张继续，而不是卡在坏图上等一个间隔；若剔除后剩余不足 2 张，轮播自动停止。控制台会打印一行 `[homepage] 背景图加载失败，已从轮播中移除：…` 方便定位。因此**删掉图片文件后即使忘了改 `data.js` 也不会卡死**。
- **后台自动暂停**：页面切到后台时停掉定时器，回到前台再继续（省电、省流量）。
- **没配图也不报错**：`images` 为空时整套背景/毛玻璃样式自动失效，页面回到原来的柔和渐变底色。
- **图片建议**：长边 1600~2000px 的 webp，单张 300KB 以内。背景本身是模糊的，分辨率不用太高，体积小更流畅。本仓库 9 张图长边 1800px、quality 74，合计约 1.4MB。

> 觉得背景太淡：把 `veil` 调小（例如 `0.5`）；觉得太糊：把 `blur` 调小（例如 `8`）；
> 只想让某张图停留久一点：把它在 `images` 里重复一次即可。

---

## 🛠 可视化编辑器

不想手写 `data.js` 的话，用仓库自带的编辑器：**用浏览器打开 `editor.html`**（例如 <http://localhost:8080/editor.html>），左边填表单、右边实时预览，改完点「导出 data.js」下载，覆盖仓库里的同名文件即可。

它属于**同一个仓库、同一套 `style.css`**：编辑器自己的输入框、开关、滑杆、标签页全部由 M3 令牌（`--md-*`）驱动，所以站点换肤时编辑器跟着变色，视觉风格与主页保持一致。

### 界面构成

| 区域 | 说明 |
|---|---|
| 顶部应用栏 | 导入 `data.js`、导出 `data.js`、切换亮暗模式；有未导出的改动时显示状态标记 |
| 左侧表单 | 5 个标签页：基本信息 / 主题取色 / 背景轮播 / 链接分组 / 导出 |
| 右侧预览 | 真实渲染的实时预览（见下），可切「手机 / 平板 / 桌面」三种宽度，可关掉自动刷新后手动刷新 |
| 底部 | 「放弃改动」与「导出 data.js」；窄屏时底部出现「编辑 / 预览」切换 |

### 实时预览为什么能做到「所见即线上」

预览不是另画一个缩略图，而是：

1. 抓取 `index.html` 的源码；
2. 把其中的 `<script src="data.js"></script>` 换成当前表单数据的**内联数据**，并补一个 `<base>` 指向站点目录；
3. 塞进右侧 iframe 渲染。

因此 iframe 里跑的仍然是原版 `style.css` 与 `script.js` —— 背景轮播、动态取色、毛玻璃、亮暗模式全部真实生效，不存在「预览一套、线上另一套」的问题。

### 它能改什么

| 标签页 | 内容 |
|---|---|
| 基本信息 | 名称、副标题、头像、签名、简介（支持换行与 `**高亮**`）、位置、邮箱、页脚、版权、小标签 |
| 主题取色 | 取色来源（背景图 / 头像 / 不取色）、色相偏转 0–360°、种子色（取色器与手填双向同步）、初始亮暗模式 |
| 背景轮播 | 背景图清单（增删、上下移）、自动识别全部参数（`enabled` / `pattern` / `from` / `to` / `missLimit` / `exclude`）、间隔、模糊、遮罩浓度、跟随取色、缩放方式与 `cropLimit` / `fillBlur`、循环、暂停 |
| 链接分组 | 分组与链接的增删排序；每个链接的文字、副文字、跳转地址、点击复制，以及折叠起来的图标名 / 图标图片 / 图标颜色、`sameTab`、`featured` |
| 导出 | 实时生成带注释的 `data.js`（格式与手写版一致）、复制、导出文件，以及一份配置检查 |

### 几个贴心的地方

- **配置检查**：导出前顺手体检 —— 名字为空、链接既没有 `url` 也没有 `copy`、`url` 少了 `https://`、地址重复、`autoScan.pattern` 里没有 `{n}` 占位符、分组里一条链接都没有……都会逐条列出，方便定位到具体条目。
- **草稿暂存**：没导出就关掉页面也不会丢，下次打开自动恢复并提示；点「放弃改动」可一键还原成 `data.js` 里的内容。
- **导入回改**：已有的 `data.js` 可点顶部「导入」直接读进来接着改（在沙箱里解析，不会执行文件里的其它代码）。
- **快捷键**：`Ctrl/Cmd + S` 直接导出。

### 需要注意

- 编辑器需要**同源 HTTP 环境**（与 `index.html`、`data.js` 放在一起，通过 `http://` 访问）。直接用 `file://` 双击打开时无法生成实时预览，此时会自动降级并给出提示 —— 起一个 `python3 -m http.server` 即可。
- 导出是**覆盖式**替换：把下载到的 `data.js` 覆盖仓库里的同名文件，提交推送即可。
- 编辑器页面带 `<meta name="robots" content="noindex">`，也没有从主页任何位置链入，不属于站点的一部分；不想让它随站发布，部署时排除 `editor.*` 三个文件即可。

---

## 🧠 动态取色是怎么工作的

```
背景图（或头像，取决于 theme.extractFrom）
   │  绘制到 64×64 离屏画布，逐像素转成 CIELAB
   ▼
筛选：丢弃过亮/过暗(L*<14 或 >92)与近灰(C*<12)的像素
   │  以色度的平方为权重做 24 分箱色相直方图
   ▼
取出权重最高的色相簇 → 得到种子色的「色相 + 色度」
   │
   ▼
生成色调板：固定色相与色度，按下标 L*（= Material 的 tone）取值
   │  超出 sRGB 色域时二分降低色度，落到色域边界
   ▼
推导整套 Material 3 令牌（primary / container / surface 层级 / outline …）
   │
   ▼
写入 :root 的 CSS 变量，全站配色即时生效
```

几个要点：

- **tone 与 Material 3 的定义一致**（tone = CIELAB 的 L*），因此明暗层级、可读性都符合 M3 的预期；实测主要文字/背景对比度均 ≥ 4.5:1。
- **色域自动压缩**：M3 里「浅色容器色」往往落在 sRGB 色域边界上，代码用二分法把色度压到刚好可显示，因此不会出现被浏览器粗暴裁剪导致的色相偏移。
- **取不到色会自动兜底**：若图片与页面不同源且未开放 CORS（例如直接用 `file://` 打开），浏览器会禁止读取像素，此时静默回退到 `fallbackSeed`，页面外观不受影响（背景图仍会正常轮播，只是配色不变）。
- **纯灰/纯黑的图**：这种颜色没有有意义的色相，会回退到 M3 基准紫的色相，避免出现随机的怪颜色。
- 若想微调，用 `theme.hueShift` 把整套配色旋转若干度即可（例如 `30`）。

**本仓库实测**：`extractFrom: 'background'` 时，配色随背景图变化，例如依次取到
`#5A598E`（紫）→ `#6C5487`（紫红）→ `#3E5F92`（蓝）→ `#326099`（蓝）→ `#485D91`（蓝紫）；
切到暗色后，同一张图会得到更亮的主色（如 `#C3C0FF`），容器色则自动变深。整套令牌的
亮/暗对应关系如下（以紫系为例）：

| 令牌 | 亮色 | 暗色 |
|---|---|---|
| primary | `#5B569E` | `#C8BFFF` |
| primary-container | `#E5DEFF` | `#413E83` |
| tertiary | `#874D60` | `#F7B4C9` |
| surface | `#FAF8FF` | `#141318` |

> 背景图颜色通常很丰富，代码会把主色色度的上限压到 `44`（`script.js` 的 `buildScheme` 里
> `clamp(chroma * 0.90, 32, 44)`），整套配色呈现得比较克制、不会刺眼。如果你更想要浓烈一点，
> 把上限调回 `58` 即可，其余令牌会自动跟随（次色、第三色都是按主色派生的）。
>
> 取色来源为 `'avatar'` 时，本仓库头像的实测结果是：色相 298.3°、色度 83.7（蓝紫系头发）。

---

## 🧩 图标说明

图标默认走 [Simple Icons](https://simpleicons.org) 的官方 CDN（`cdn.simpleicons.org`），好处是不用内嵌几百 KB 的 SVG，且图标名现查现用。
图标颜色默认跟随主题主色，所以主题一变图标也跟着变；若图标名写错或网络不可用，会自动降级为内置的通用「地球」图标，不会出现破图。

**个别平台 Simple Icons 没有收录**：目前是抖音（`cdn.simpleicons.org/douyin` 返回 404）。
这类平台的图形直接内置在 `script.js` 的 `BUILTIN_ICONS` 里，用 `icon: 'douyin'` 即可：
颜色同样跟随主题（用 `currentColor` 填充），而且**完全不依赖网络**。想再加一个，往那个对象里加一条
`slug: 'SVG 路径数据'` 就行，路径数据可以从 [Simple Icons](https://simpleicons.org) 或官方品牌资源里拿。

> 顺带记一笔：腾讯 QQ 的图标名是 **`qq`**（`tencentqq` 已从 Simple Icons 下架，会返回 404）。

**完全离线**的做法：把图标文件下载到本地，然后用 `iconUrl` 字段指过去，例如：

```js
{ label: 'GitHub', url: 'https://github.com/you', iconUrl: 'icons/github.svg' }
```

---

## ☁️ 部署

### Cloudflare Pages（本仓库正在用的方式）

**方式 A：连接 Git 仓库（推荐）**

1. 把这个目录推送到 GitHub / GitLab 仓库。
2. 打开 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 选择你的仓库，构建配置填：

   | 配置项 | 值 |
   |---|---|
   | Framework preset | `None` |
   | Build command | **（留空）** |
   | Build output directory | `/` |

4. 点 **Save and Deploy**。首次部署约 10 秒完成，之后每次 `git push` 都会自动重新部署。

> 因为没有任何构建步骤，`Build command` 留空即可；输出目录填 `/`（表示仓库根目录）。

**方式 B：不用 Git，直接上传**

```bash
npm install -g wrangler
wrangler pages deploy . --project-name=my-homepage
```

或者打开 Pages → **Create** → **Upload assets**，把整个文件夹拖进去。

> 仓库里的 `_headers` 文件只对 Cloudflare Pages 生效（它负责缓存策略与几个安全响应头）。
> 部署到别的平台时这个文件会被忽略，属正常现象；想在其他平台复现缓存策略，需要各自平台的配置文件。

### 其它平台

| 平台 | 做法 |
|---|---|
| **GitHub Pages** | 推仓库 → Settings → Pages → Source 选分支 + 根目录；或 Actions 部署 |
| **Netlify / Vercel** | 连接仓库或直接拖文件夹，构建命令留空，发布目录填 `.`（仓库根） |
| **任意静态服务器 / 对象存储** | `rsync` 或控制台上传整个目录即可，无需任何服务端运行时 |

### 自定义域名

Cloudflare Pages → 你的项目 → **Custom domains** → **Set up a custom domain**。
若域名已托管在 Cloudflare，会自动创建 DNS 记录并签好 SSL，约 1 分钟生效。

本项目对域名完全不敏感：背景图走相对路径、图标走 CDN、404 页用绝对路径 `/`，换域名后 `_headers` 与 404 规则会自动跟着生效。

---

## ❓ 常见问题

**Q：部署后打开是默认紫色，配色不跟着背景变？**
A：说明像素读取被浏览器拦了。若是 `file://` 直接打开的，换成 `http://`（本地服务器或部署后）即可；若背景图放在外链图床上，需要该服务器返回 `Access-Control-Allow-Origin`。最稳的做法是把图片放进本仓库的 `backgrounds/` 目录（同源）。

**Q：背景图看不出效果 / 太糊 / 太抢眼？**
A：调 `data.js` 里的 `veil`（遮罩浓度，越大背景越淡）和 `blur`（模糊强度）。例如 `veil: 0.5, blur: 8` 会更清晰，`veil: 0.8, blur: 24` 会更朦胧。

**Q：所有背景图一起加载会不会很慢？**
A：不会一次全拉。页面只加载当前这张并预载下一张，其余按设定的 `interval` 顺序渐进加载；本仓库每张平均约 150KB。想更省流量就把 `interval` 调大，或减少 `images` 数量。

**Q：加了新背景图，但轮播里没出现？**
A：先看文件名是否符合 `autoScan.pattern` 的序号约定（本仓库是 `backgrounds/bg-NN.webp`，两位补零），且序号不能跳号太多（连续 `missLimit` 个序号缺席就会停止探测）。也可以在 `?debug=1` 下执行 `__homepage.rescanBackgrounds()` 手动重探，或在控制台看有没有 `[homepage] 自动识别到 N 张新增背景图…` 这行日志。

**Q：点击「复制」型卡片没有复制成功？**
A：复制走的是浏览器的 Clipboard API。在不安全的环境（`file://`、非 HTTPS）或隐私模式下可能被拒绝，此时脚本会自动降级尝试旧接口，若仍然失败，提示条会直接把内容显示出来让你手动复制。

**Q：想换成圆形头像？**
A：在 `style.css` 里把 `.hero__avatar { border-radius: var(--md-shape-xl) }` 改成 `border-radius: 50%`。

**Q：卡片里的说明文字太长被截断了？**
A：卡片按单行省略号处理，建议 `desc` 控制在 12 个汉字以内。

**Q：能加个搜索框 / 统计吗？**
A：代码结构里脚本分成「色彩引擎 / 渲染 / 交互 / 背景轮播 / 启动」几段，加功能基本是改 `render*` 和 `wire*` 函数，不需要动取色部分。

**Q：怎么排查取色问题？**
A：在网址后加 `?debug=1`，即可在浏览器控制台访问内部函数：

```js
__homepage.hexToLch('#E91E63')        // 看某个颜色的 L*/C*/色相
__homepage.buildScheme(__homepage.hexToLch('#E91E63'), false, 0)  // 看生成的整套配色
__homepage.state                        // 看当前模式与正在使用的种子色
__homepage.bg                           // 看背景轮播内部状态（list / idx / timer / scanAdded）
__homepage.showBackground(3)            // 立刻切到第 4 张（0 起算），顺带验证取色与停播逻辑
__homepage.stopBgTimer()                // 手动停掉轮播定时器
__homepage.scanBackgrounds()            // 手动跑一次「新背景图自动识别」
__homepage.rescanBackgrounds()          // 清掉缓存后强制重探（传完新图不想刷新页面时用）
__homepage.scanPatternUrl('backgrounds/bg-{n2}.webp', 7)  // 看某个序号会解析成什么地址
```

控制台若出现「画布已被跨域图片污染」类报错，说明图片是跨域的且未开放 CORS，此时会自动回退到 `fallbackSeed`。

**Q：背景轮播可以暂停吗？**
A：把 `background.paused` 设为 `true` 就只显示第一张。想改成「播完一轮再从头循环」，把 `background.loop` 设为 `true`（默认 `false` 是播完最后一张就停住）。另外页面切到后台时轮播会自动暂停，回到前台继续，这不需要配置。

**Q：怎么让背景轮播直接停在第一张 / 只想要一张静态背景？**
A：`paused: true` 是最省事的做法；也可以只保留 `images` 里的一项。

**Q：仓库里的 `data.js` 里的名字、邮箱、QQ 都是真实的吗？**
A：不是。仓库自带的是**脱敏后的占位示例**（名字、邮箱、QQ、各平台链接都是假的），只用来演示每个字段怎么配。你用的时候直接把 `data.js` 整体换成自己的内容即可。

---

## 🌐 浏览器支持

面向现代浏览器（Chrome / Edge 111+、Safari 16.4+、Firefox 113+）。用到的较新特性：CSS 变量、`:focus-visible`、`matchMedia`、`backdrop-filter`（毛玻璃）、`navigator.share`（不支持时自动降级为复制链接）、`env(safe-area-inset-*)`。已处理 `prefers-reduced-motion`（背景切换与过渡动画会立即完成）与 `prefers-contrast`。

---

## 🤝 贡献与二次开发

欢迎提 Issue 和 PR。几条约定，为的是保住这个项目最大的优点（拿来就能用）：

1. **不引入构建步骤与运行时依赖** —— 不新增 npm 包、不加打包器、不要求 CI。所有功能都用原生 HTML/CSS/JS 实现。
2. **不硬编码颜色** —— 配色一律走 M3 令牌（`--md-*`）或 `data.js`，这样动态取色才不会被破坏。
3. **个人数据只留在 `data.js`** —— 新增功能的可配置项也请写进 `data.js` 并附注释，保持「只改一个文件」的体验。
4. **改完请自测三种场景**：手机窄屏、桌面宽屏、亮/暗模式，并确认 `?debug=1` 下控制台无报错。

想二次开发时的常规路径：

- **换皮肤**：改 `style.css` 顶部的 M3 令牌，或 `data.js` 的 `theme.fallbackSeed` + `extractFrom: 'none'`。
- **加一种卡片**：在 `script.js` 的渲染段照 `createCard` 的样子加一个渲染函数，然后按 `iconUrl` 的方式在 `data.js` 里配。
- **加一整套区块（如统计、搜索）**：在 `index.html` 加骨架，`style.css` 加令牌化样式，`script.js` 加 `render*` + `wire*`。

---

## 📝 更新日志

| 提交 | 内容 |
|---|---|
| 初版 | Material You 主页骨架：个人信息、分组卡片、动态取色、背景轮播、毛玻璃、404 页 |
| `v2` | 背景缩放改为「按页面尺寸自动匹配」；修复 `_headers` 多条规则命中同一路径时响应头被逗号拼接的问题（图片缓存失效） |
| `v3` | 背景图补齐一天缓存；补充背景缩放 `cover` / `contain` / `auto` 三种模式的判定说明 |
| `v4` | 背景缩放默认改为 `cover`（等比放大刚好填满整页） |
| `v5` | **新增背景图自动识别**：按命名约定探测新图并自动并入轮播 |
| 开源发布 | README 重写为开源项目文档、新增 MIT `LICENSE`、`data.js` 换成脱敏示例数据 |
| `v6` | **新增可视化编辑器**（`editor.html` / `editor.css` / `editor.js`）：表单化编辑配置、实时预览、导入导出与配置检查 |

---

## 📄 开源协议

[MIT](LICENSE) © 2026 YKXDH

你可以自由使用、修改、分发（包括商用），只需保留版权声明。项目里的个人数据（`data.js` 中的姓名、邮箱、QQ 等）与头像、背景图属于作者本人，请替换成你自己的内容后再发布。

/* ============================================================================
 * script.js —— 动态取色引擎 + 页面渲染 + 交互
 * ----------------------------------------------------------------------------
 * 1) 色彩引擎：从头像取主色 → 生成 CIELAB/LCh 色调板 → 推导整套 Material 3
 *    配色令牌，并写入 CSS 变量。
 * 2) 渲染：依据 data.js 生成个人信息区与链接卡片。
 * 3) 交互：深浅色切换、水波纹、分享/复制、提示条。
 * 所有逻辑封装在 IIFE 内，不污染全局作用域。
 * ==========================================================================*/
(function () {
  'use strict';

  /* ══════════════════════════ 0. 通用工具 ══════════════════════════ */

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, String.fromCharCode(38) + 'quot;')
      .replace(/'/g, String.fromCharCode(38) + '#39;');
  }

  /* 富文本：先转义再解析极小语法，避免 XSS。
   * 目前支持 **文字** → 高亮标记（用于简介里强调「代表系列」这类内容） */
  function rich(s) {
    return esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<mark class="hl">$1</mark>');
  }

  /* ══════════════════════════ 1. 色彩引擎 ══════════════════════════
   * 思路：
   *   sRGB ──线性化──▶ linear RGB ──▶ XYZ(D65) ──▶ CIELAB ──▶ LCh
   *   调用色调板时固定「色相 + 色度」，把 L* (= Material 的 tone) 当作自变量；
   *   若目标色超出 sRGB 色域，则用二分法降低色度直到刚好落在色域边界内。
   *   这样得到的 tone 与 Material Design 3 的 tone 定义完全一致（L* 值）。
   * ══════════════════════════════════════════════════════════════════ */

  var LAB_EPS = 216 / 24389;   // 0.008856
  var LAB_KAPPA = 24389 / 27;   // 903.3
  var LAB_REF = [0.95047, 1, 1.08883]; // D65 白点

  function srgbToLinear(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(v) {
    var s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(clamp(s, 0, 1) * 255);
  }

  function labF(t) { return t > LAB_EPS ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116; }
  function labFInv(t) {
    return t > 6 / 29 ? t * t * t : 3 * (6 / 29) * (6 / 29) * (t - 4 / 29);
  }

  /* 线性 RGB → CIELAB，返回 [L*, a*, b*] */
  function linearRgbToLab(r, g, b) {
    var x = (0.4123908 * r + 0.35758434 * g + 0.18048079 * b) / LAB_REF[0];
    var y = (0.21263901 * r + 0.71516868 * g + 0.07219232 * b) / LAB_REF[1];
    var z = (0.01933082 * r + 0.11919478 * g + 0.95053215 * b) / LAB_REF[2];
    var fx = labF(x), fy = labF(y), fz = labF(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  /* CIELAB → 线性 RGB（可能超出色域，调用方需自行检查） */
  function labToLinearRgb(L, a, b) {
    var fy = (L + 16) / 116;
    var fx = fy + a / 500;
    var fz = fy - b / 200;
    var x = labFInv(fx) * LAB_REF[0];
    var y = labFInv(fy) * LAB_REF[1];
    var z = labFInv(fz) * LAB_REF[2];
    return [
      3.24096994 * x - 1.53738318 * y - 0.49861076 * z,
      -0.96924364 * x + 1.87596750 * y + 0.04155506 * z,
      0.05563008 * x - 0.20397696 * y + 1.05697151 * z
    ];
  }

  function labToLch(lab) {
    var L = lab[0], a = lab[1], b = lab[2];
    var C = Math.sqrt(a * a + b * b);
    var h = Math.atan2(b, a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { L: L, C: C, h: h };
  }

  function lchToLab(L, C, h) {
    var rad = h * Math.PI / 180;
    return [L, C * Math.cos(rad), C * Math.sin(rad)];
  }

  function rgbToHex(rgb) {
    return '#' + rgb.map(function (v) {
      var s = clamp(Math.round(v), 0, 255).toString(16).toUpperCase();
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

  function hexToRgb(hex) {
    if (!hex) return null;
    var s = String(hex).replace('#', '').trim();
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    var n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* 十六进制 → LCh */
  function hexToLch(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return null;
    return labToLch(linearRgbToLab(
      srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])
    ));
  }

  function inGamut(rgb) {
    var e = 0.0006;
    return rgb[0] >= -e && rgb[0] <= 1 + e &&
           rgb[1] >= -e && rgb[1] <= 1 + e &&
           rgb[2] >= -e && rgb[2] <= 1 + e;
  }

  /* LCh → 十六进制，自动做色域压缩（降低色度直到可表示） */
  function lchToHex(L, C, h) {
    L = clamp(L, 0, 100);
    if (L <= 0.01) return '#000000';
    if (L >= 99.99) return '#FFFFFF';
    C = Math.max(0, C);

    var lin = labToLinearRgb.apply(null, lchToLab(L, C, h));
    if (!inGamut(lin)) {
      var lo = 0, hi = C, mid;
      for (var i = 0; i < 26; i++) {
        mid = (lo + hi) / 2;
        if (inGamut(labToLinearRgb.apply(null, lchToLab(L, mid, h)))) lo = mid; else hi = mid;
      }
      lin = labToLinearRgb.apply(null, lchToLab(L, lo, h));
    }
    return rgbToHex(lin.map(linearToSrgb));
  }

  /* 创建一条色调板：固定色相与色度，按 tone 取值（带缓存） */
  function tonalPalette(hue, chroma) {
    var cache = Object.create(null);
    return function (tone) {
      var k = String(tone);
      if (!(k in cache)) cache[k] = lchToHex(tone, chroma, hue);
      return cache[k];
    };
  }

  /* 由种子色生成整套 Material 3 令牌 */
  function buildScheme(seed, dark, hueShift) {
    seed = seed || hexToLch('#6750A4');
    var hue = ((seed.h + (hueShift || 0)) % 360 + 360) % 360;
    var chroma = seed.C;

    // 近乎无彩色的种子色（纯黑/纯白/灰）其色相是随机的，此时回退到 M3 基准紫的色相
    if (chroma < 8) {
      hue = ((257 + (hueShift || 0)) % 360 + 360) % 360;
    }

    // 各调色板的色度：以种子色饱和度为基础，收敛到 Material You 的中等饱和区间
    //   上限 44 是刻意压低的：头像原图饱和度很高（色度 84），若不收敛整套配色会过于浓烈；
    //   44 更接近 Material 官方「克制」的观感。想更鲜艳就调高，想更灰淡就调低。
    var cP = clamp(chroma * 0.90, 32, 44);            // 主色
    var cS = clamp(cP * 0.42, 14, 26);                // 次色
    var cT = clamp(cP * 0.62, 18, 34);                // 第三色（色相 +60°）
    var cN = 4;                                        // 中性色
    var cNV = 8;                                       // 中性变体
    var cE = 62;                                       // 错误色（固定色相，保证语义不随主题漂移）

    var P = tonalPalette(hue, cP);
    var S = tonalPalette(hue, cS);
    var T = tonalPalette((hue + 60) % 360, cT);
    var N = tonalPalette(hue, cN);
    var NV = tonalPalette(hue, cNV);
    var E = tonalPalette(28, cE);

    if (!dark) {
      return {
        '--md-primary': P(40), '--md-on-primary': P(100),
        '--md-primary-container': P(90), '--md-on-primary-container': P(10),
        '--md-secondary': S(40), '--md-on-secondary': S(100),
        '--md-secondary-container': S(90), '--md-on-secondary-container': S(10),
        '--md-tertiary': T(40), '--md-on-tertiary': T(100),
        '--md-tertiary-container': T(90), '--md-on-tertiary-container': T(10),
        '--md-error': E(40), '--md-on-error': E(100),
        '--md-error-container': E(90), '--md-on-error-container': E(10),
        '--md-surface': N(98), '--md-on-surface': N(10),
        '--md-surface-variant': NV(90), '--md-on-surface-variant': NV(30),
        '--md-surface-dim': N(87), '--md-surface-bright': N(98),
        '--md-surface-container-lowest': N(100),
        '--md-surface-container-low': N(96),
        '--md-surface-container': N(94),
        '--md-surface-container-high': N(92),
        '--md-surface-container-highest': N(90),
        '--md-outline': NV(50), '--md-outline-variant': NV(80),
        '--md-inverse-surface': N(20), '--md-inverse-on-surface': N(95),
        '--md-inverse-primary': P(80),
        '--md-shadow': '#000000', '--md-scrim': '#000000'
      };
    }

    return {
      '--md-primary': P(80), '--md-on-primary': P(20),
      '--md-primary-container': P(30), '--md-on-primary-container': P(90),
      '--md-secondary': S(80), '--md-on-secondary': S(20),
      '--md-secondary-container': S(30), '--md-on-secondary-container': S(90),
      '--md-tertiary': T(80), '--md-on-tertiary': T(20),
      '--md-tertiary-container': T(30), '--md-on-tertiary-container': T(90),
      '--md-error': E(80), '--md-on-error': E(20),
      '--md-error-container': E(30), '--md-on-error-container': E(90),
      '--md-surface': N(6), '--md-on-surface': N(90),
      '--md-surface-variant': NV(30), '--md-on-surface-variant': NV(80),
      '--md-surface-dim': N(6), '--md-surface-bright': N(24),
      '--md-surface-container-lowest': N(4),
      '--md-surface-container-low': N(10),
      '--md-surface-container': N(12),
      '--md-surface-container-high': N(17),
      '--md-surface-container-highest': N(22),
      '--md-outline': NV(60), '--md-outline-variant': NV(30),
      '--md-inverse-surface': N(90), '--md-inverse-on-surface': N(20),
      '--md-inverse-primary': P(40),
      '--md-shadow': '#000000', '--md-scrim': '#000000'
    };
  }

  /* ══════════════════════════ 2. 头像取色 ══════════════════════════ */

  /* 仅当图片与页面跨域时才需要 CORS；同源图片不加，避免无谓的加载失败 */
  function isCrossOrigin(url) {
    try {
      return new URL(url, location.href).origin !== location.origin;
    } catch (e) { return false; }
  }

  function loadImage(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var img = new Image();
      if (isCrossOrigin(url)) img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  /* 在缩小后的画布上做加权色相直方图，挑出最有代表性的颜色 */
  function analyzeImage(img) {
    var SIZE = 64;
    var canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    try { ctx.drawImage(img, 0, 0, SIZE, SIZE); } catch (e) { return null; }

    var pixels;
    try { pixels = ctx.getImageData(0, 0, SIZE, SIZE).data; }
    catch (e) { return null; }  // 画布被跨域图片污染

    var BINS = 24;
    var binW = new Array(BINS).fill(0);
    var binX = new Array(BINS).fill(0);
    var binY = new Array(BINS).fill(0);
    var total = 0;

    for (var i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      var lin = [
        srgbToLinear(pixels[i]),
        srgbToLinear(pixels[i + 1]),
        srgbToLinear(pixels[i + 2])
      ];
      var lab = linearRgbToLab(lin[0], lin[1], lin[2]);
      var L = lab[0];
      if (L < 14 || L > 92) continue;            // 过暗 / 过亮忽略
      var C = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
      if (C < 12) continue;                       // 近似灰忽略

      var rad = Math.atan2(lab[2], lab[1]);
      var bin = Math.floor(((rad * 180 / Math.PI + 360) % 360) / (360 / BINS)) % BINS;
      var w = C * C;                              // 饱和度越高权重越大
      binW[bin] += w;
      binX[bin] += Math.cos(rad) * C * w;
      binY[bin] += Math.sin(rad) * C * w;
      total += w;
    }

    if (total <= 0) return null;

    var best = -1;
    for (var b = 0; b < BINS; b++) {
      if (binW[b] > 0 && (best < 0 || binW[b] > binW[best])) best = b;
    }
    if (best < 0) return null;

    // 合并相邻分箱，避免相近色被拆散
    var W = 0, X = 0, Y = 0;
    for (var d = -1; d <= 1; d++) {
      var k = (best + d + BINS) % BINS;
      W += binW[k]; X += binX[k]; Y += binY[k];
    }
    if (W <= 0 || W < total * 0.02) return null;

    var hue = Math.atan2(Y, X) * 180 / Math.PI;
    if (hue < 0) hue += 360;

    return { L: 50, C: Math.sqrt(X * X + Y * Y) / W, h: hue };
  }

  /* ══════════════════════════ 3. 主题应用 ══════════════════════════ */

  /* 需要额外导出 RGB 三元组的令牌：CSS 里用 rgba(var(--md-xxx-rgb), a)
   * 来画半透明底色、M3 状态层，以及背景毛玻璃的通透感 */
  var RGB_TOKENS = [
    'primary', 'on-primary', 'primary-container', 'on-primary-container',
    'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
    'tertiary', 'tertiary-container',
    'error', 'error-container',
    'surface', 'on-surface', 'on-surface-variant', 'surface-variant',
    'surface-container-lowest', 'surface-container-low', 'surface-container',
    'surface-container-high', 'surface-container-highest',
    'outline', 'outline-variant',
    'inverse-surface', 'inverse-on-surface',
    'scrim', 'shadow'
  ];

  var state = {
    mode: 'auto',        // 'auto' | 'light' | 'dark'
    seed: null,          // { L, C, h }
    primaryHex: '#6750A4',
    onPrimaryHex: '#FFFFFF',   // 与主色成对的对比色（featured 大卡片的图标要用它）
    data: null
  };

  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');

  function currentMode() {
    if (state.mode === 'auto') return mqDark.matches ? 'dark' : 'light';
    return state.mode;
  }

  function saveMode(mode) {
    try { localStorage.setItem('homepage-theme', mode); } catch (e) { /* ignore */ }
  }

  function applyTheme(seed, animate) {
    var dark = currentMode() === 'dark';
    var scheme = buildScheme(seed, dark, (state.data && state.data.theme && state.data.theme.hueShift) || 0);
    var root = document.documentElement;

    root.setAttribute('data-theme', dark ? 'dark' : 'light');

    Object.keys(scheme).forEach(function (k) { root.style.setProperty(k, scheme[k]); });

    // 供 CSS 的 rgba() 使用（状态层 / 毛玻璃半透明底色）
    RGB_TOKENS.forEach(function (name) {
      var rgb = hexToRgb(scheme['--md-' + name]);
      if (rgb) root.style.setProperty('--md-' + name + '-rgb', rgb.join(', '));
    });

    state.primaryHex = scheme['--md-primary'];
    state.onPrimaryHex = scheme['--md-on-primary'];

    var meta = $('#metaThemeColor');
    if (meta) meta.setAttribute('content', scheme['--md-surface']);

    refreshIconColors();

    if (animate) document.body.classList.add('theme-anim');
  }

  /* ══════════════════════════ 4. 渲染 ══════════════════════════ */

  function iconUrl(slug, colorHex) {
    var c = String(colorHex || '').replace('#', '');
    return 'https://cdn.simpleicons.org/' + encodeURIComponent(slug) + '/' + c;
  }

  /* 内置品牌图标：Simple Icons 没有收录的平台（例如抖音）走这里。
   * 用 currentColor 填充，所以颜色跟随主题，并且完全不依赖网络。 */
  var BUILTIN_ICONS = {
    // 抖音（音符标志，与 simple-icons 的 tiktok 同源图形）
    douyin: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z'
  };

  function builtinIcon(slug) {
    var d = BUILTIN_ICONS[slug];
    if (!d) return null;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    return svg;
  }

  function genericIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M3 12h18M12 3c2.6 3.2 2.6 14.8 0 18M12 3c-2.6 3.2-2.6 14.8 0 18"/>';
    return svg;
  }

  function makeIcon(link) {
    var box = document.createElement('span');
    box.className = 'link-card__icon';

    // 内置图标优先（例如 Simple Icons 未收录的抖音），颜色跟随主题且不依赖网络
    if (!link.iconUrl && link.icon && BUILTIN_ICONS[link.icon]) {
      box.appendChild(builtinIcon(link.icon));
      return box;
    }

    var src = link.iconUrl || null;
    var mode = 'primary';
    if (!src && link.icon) {
      if (link.color === 'brand') { src = iconUrl(link.icon, ''); mode = 'brand'; }
      else if (link.color) { src = iconUrl(link.icon, link.color); mode = 'custom'; }
      else { src = iconUrl(link.icon, state.primaryHex); }
    }

    if (!src) { box.appendChild(genericIcon()); return box; }

    var img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.dataset.iconSlug = link.icon || '';
    img.dataset.iconMode = mode;
    img.addEventListener('error', function () {
      box.innerHTML = '';
      box.appendChild(genericIcon());
    });
    img.src = src;
    box.appendChild(img);
    return box;
  }

  function arrowIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'link-card__arrow');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path fill="currentColor" d="M7.7 6.5a1.1 1.1 0 0 0 0 2.2h5.3l-7 7a1.1 1.1 0 0 0 1.6 1.6l7-7v5.3a1.1 1.1 0 0 0 2.2 0V7.6c0-.6-.5-1.1-1.1-1.1H7.7Z"/>';
    return svg;
  }

  /* 「点击复制」型卡片的尾巴图标（例如 QQ 号，没有可跳转的网页地址） */
  function copyIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'link-card__arrow link-card__arrow--copy');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path fill="currentColor" d="M9 2.5A2.5 2.5 0 0 0 6.5 5v.5H6A2.5 2.5 0 0 0 3.5 8v10A2.5 2.5 0 0 0 6 20.5h9A2.5 2.5 0 0 0 17.5 18v-.5h.5A2.5 2.5 0 0 0 20.5 15V5A2.5 2.5 0 0 0 18 2.5H9Zm-.5 3A.5.5 0 0 1 9 5h9a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5h-.5V8A2.5 2.5 0 0 0 15 5.5H8.5v.5-.5Z"/>';
    return svg;
  }

  function refreshIconColors() {
    var imgs = document.querySelectorAll('img[data-icon-slug]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (!img.dataset.iconSlug || img.dataset.iconMode !== 'primary') continue;
      // featured 大卡片的图标底色就是主色，此时图标得用 on-primary 才看得见
      var onFeatured = img.closest('.link-card--featured');
      var url = iconUrl(img.dataset.iconSlug, onFeatured ? state.onPrimaryHex : state.primaryHex);
      if (img.getAttribute('src') === url) continue;
      // 背景每换一张配色就变一次，如果直接改 src，个别浏览器会先清空再显示，
      // 图标就闪一下。这里先把新颜色预载好，加载完成再替换，视觉上无缝。
      swapIconSrc(img, url);
    }
  }

  function swapIconSrc(img, url) {
    var probe = new Image();
    probe.onload = function () { img.src = url; };   // 命中缓存，不会二次请求
    probe.onerror = function () { /* 保留旧图，等下次再说 */ };
    probe.src = url;
  }

  /* 点击水波纹（M3 state layer） */
  function attachRipple(el) {
    el.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      var rect = el.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 2;
      var span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (ev.clientX - rect.left - size / 2) + 'px';
      span.style.top = (ev.clientY - rect.top - size / 2) + 'px';
      el.appendChild(span);
      var done = function () { if (span.parentNode) span.parentNode.removeChild(span); };
      span.addEventListener('animationend', done);
      setTimeout(done, 900);
    }, { passive: true });
  }

  function createCard(link) {
    // 有 copy 字段 = 没有可跳转的网页地址，改成「点击复制」（例如 QQ 号）
    var isCopy = !!link.copy;
    var a = document.createElement(isCopy ? 'button' : 'a');
    a.className = 'link-card' + (link.featured ? ' link-card--featured' : '') +
      (isCopy ? ' link-card--copy' : '');

    if (isCopy) {
      a.type = 'button';
    } else {
      a.href = link.url || '#';
      if (!link.sameTab) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    }

    a.setAttribute('aria-label', isCopy
      ? (link.label || '') + '，点击复制'
      : (link.label || '') + (link.desc ? ' — ' + link.desc : ''));

    a.appendChild(makeIcon(link));

    var text = document.createElement('span');
    text.className = 'link-card__text';
    var label = document.createElement('span');
    label.className = 'link-card__label';
    label.textContent = link.label || link.url || '链接';
    text.appendChild(label);
    if (link.desc) {
      var desc = document.createElement('span');
      desc.className = 'link-card__desc';
      desc.textContent = link.desc;
      text.appendChild(desc);
    }
    a.appendChild(text);
    a.appendChild(isCopy ? copyIcon() : arrowIcon());

    attachRipple(a);

    if (isCopy) {
      // 复制型卡片：点一下把内容复制走（QQ 号、邀请码这类）
      a.addEventListener('click', function () {
        copyText(link.copy, '已复制' + (link.label ? '「' + link.label + '」' : '') + '：' + link.copy);
      });
    } else {
      // 右键 / 长按：复制该条链接
      a.addEventListener('contextmenu', function (ev) {
        if (!link.url || link.url === '#') return;
        ev.preventDefault();
        copyText(link.url, '已复制「' + (link.label || '链接') + '」的地址');
      });
    }

    return a;
  }

  function buildReveal(el, delay) {
    el.classList.add('reveal');
    el.style.animationDelay = (delay || 0) + 'ms';
  }

  function renderBar() {
    var p = state.data.profile || {};
    var title = $('#barTitle');
    var avatar = $('#barAvatar');
    if (title) title.textContent = p.name || '个人主页';
    if (avatar && p.avatar) avatar.style.backgroundImage = 'url("' + p.avatar.replace(/"/g, '') + '")';
  }

  function renderHero() {
    var p = state.data.profile || {};
    var hero = $('#hero');
    if (!hero) return;

    var wrap = document.createElement('div');
    wrap.className = 'hero__avatar-wrap';

    if (p.avatar) {
      var img = document.createElement('img');
      img.className = 'hero__avatar';
      img.alt = (p.name || '') + ' 的头像';
      img.src = p.avatar;
      img.addEventListener('error', function () {
        var fb = document.createElement('div');
        fb.className = 'hero__avatar hero__avatar--fallback';
        fb.textContent = (p.name || '?').trim().charAt(0) || '?';
        if (img.parentNode) img.parentNode.replaceChild(fb, img);
      });
      wrap.appendChild(img);
    } else {
      var fb0 = document.createElement('div');
      fb0.className = 'hero__avatar hero__avatar--fallback';
      fb0.textContent = (p.name || '?').trim().charAt(0) || '?';
      wrap.appendChild(fb0);
    }
    hero.appendChild(wrap);

    var rest = document.createElement('div');
    rest.style.display = 'contents';

    var html = '';
    if (p.name) html += '<h1 class="hero__name">' + esc(p.name) + '</h1>';
    if (p.handle) html += '<p class="hero__handle">' + esc(p.handle) + '</p>';
    if (p.tagline) html += '<p class="hero__tagline">' + esc(p.tagline) + '</p>';
    if (p.bio) html += '<p class="hero__bio">' + rich(p.bio) + '</p>';

    var chips = [];
    if (p.location) {
      chips.push('<span class="chip">' +
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.1 6.1 12.2 6.4 12.5a.8.8 0 0 0 1.2 0C12.9 21.2 19 14.1 19 9a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/></svg>' +
        esc(p.location) + '</span>');
    }
    (p.chips || []).forEach(function (c) {
      if (c) chips.push('<span class="chip chip--tonal">' + esc(c) + '</span>');
    });
    if (chips.length) html += '<div class="hero__meta">' + chips.join('') + '</div>';

    var actions = '';
    if (p.email) {
      actions += '<a class="btn btn--filled" href="mailto:' + esc(p.email) + '">' +
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm8 8.2 7.4-5.2H4.6L12 13.2Z"/></svg>' +
        '邮件联系我</a>';
    }
    actions += '<button class="btn btn--tonal" id="btnCopyHome" type="button">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 2.5A2.5 2.5 0 0 0 6.5 5v.5H6A2.5 2.5 0 0 0 3.5 8v10A2.5 2.5 0 0 0 6 20.5h9A2.5 2.5 0 0 0 17.5 18v-.5h.5A2.5 2.5 0 0 0 20.5 15V5A2.5 2.5 0 0 0 18 2.5H9Zm-.5 3A.5.5 0 0 1 9 5h9a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5h-.5V8A2.5 2.5 0 0 0 15 5.5H8.5v.5-.5Z"/></svg>' +
      '复制主页链接</button>';
    html += '<div class="hero__actions">' + actions + '</div>';

    rest.innerHTML = html;
    while (rest.firstChild) hero.appendChild(rest.firstChild);

    buildReveal(hero, 0);

    var btn = $('#btnCopyHome');
    if (btn) {
      attachRipple(btn);
      btn.addEventListener('click', function () { copyText(location.href, '主页链接已复制'); });
    }
  }

  function renderGroups() {
    var groupsEl = $('#groups');
    if (!groupsEl) return;
    groupsEl.innerHTML = '';

    var delay = 60;
    (state.data.groups || []).forEach(function (group) {
      if (!group || !group.links || !group.links.length) return;

      var section = document.createElement('section');
      section.className = 'group';

      var head = document.createElement('div');
      head.className = 'group__head';
      var h2 = document.createElement('h2');
      h2.className = 'group__title';
      h2.textContent = group.title || '链接';
      head.appendChild(h2);
      if (group.subtitle) {
        var sub = document.createElement('p');
        sub.className = 'group__subtitle';
        sub.textContent = group.subtitle;
        head.appendChild(sub);
      }
      section.appendChild(head);

      var grid = document.createElement('div');
      grid.className = 'grid';
      group.links.forEach(function (link) { grid.appendChild(createCard(link)); });
      section.appendChild(grid);

      groupsEl.appendChild(section);
      buildReveal(section, delay);
      delay += 60;
    });
  }

  function renderFooter() {
    var p = state.data.profile || {};
    var el = $('#footer');
    if (!el) return;
    var year = new Date().getFullYear();
    var line1 = p.footer ? esc(p.footer) : '© ' + year + ' ' + esc(p.name || '');
    // 版权行：写了才显示，留空就只剩上面那行（不写默认文案）
    var line2 = p.copyright ? esc(p.copyright) : '';

    el.innerHTML = '<div>' + line1 + '</div>' + (line2 ? '<div>' + line2 + '</div>' : '');
  }

  /* ══════════════════════════ 5. 交互 ══════════════════════════ */

  var snackTimer = null;

  function showSnackbar(msg) {
    var el = $('#snackbar');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('snackbar--open');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(function () { el.classList.remove('snackbar--open'); }, 2600);
  }

  function copyText(text, okMsg) {
    var done = function () { showSnackbar(okMsg || '已复制'); };
    var fail = function () { showSnackbar('复制失败，请手动复制：' + text); };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text) ? done() : fail(); });
      return;
    }
    legacyCopy(text) ? done() : fail();
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function wireThemeToggle() {
    var btn = $('#btnTheme');
    if (!btn) return;
    attachRipple(btn);
    btn.addEventListener('click', function () {
      state.mode = currentMode() === 'dark' ? 'light' : 'dark';
      saveMode(state.mode);
      applyTheme(state.seed, true);
    });
  }

  function wireShare() {
    var wrap = $('#fabWrap');
    var btn = $('#btnShare');
    if (!btn || !wrap) return;
    wrap.hidden = false;
    attachRipple(btn);
    btn.addEventListener('click', function () {
      var title = (state.data.profile && state.data.profile.name) || document.title;
      if (navigator.share) {
        navigator.share({ title: title, url: location.href }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          copyText(location.href, '主页链接已复制');
        });
      } else {
        copyText(location.href, '主页链接已复制');
      }
    });
  }

  /* 把顶部应用栏的实测高度写入 CSS 变量，供桌面端吸顶侧栏定位使用 */
  function watchAppBar() {
    var bar = $('#appBar');
    if (!bar) return;
    var sync = function () {
      document.documentElement.style.setProperty('--appbar-h', bar.offsetHeight + 'px');
    };
    sync();
    if (window.ResizeObserver) new ResizeObserver(sync).observe(bar);
    else window.addEventListener('resize', sync);
  }

  /* ══════════════════════════ 6. 背景轮播 ══════════════════════════
   * 两张图层交替淡入淡出；每次换图时顺手从新图里取一次色，
   * 让整套 Material 配色跟着背景走。
   * 节奏、模糊、遮罩、是否跟随取色都在 data.js 的 background 段里配置。
   * ─────────────────────────────────────────────────────────────────── */

  var bg = {
    list: [],           // 图片地址列表
    layers: [],         // [A, B] 两个图层，交替显示
    active: 0,          // 当前显示的是哪个图层
    idx: -1,            // 当前图片下标
    timer: null,        // 轮播定时器
    seeds: {},          // url -> seed 的取色缓存（循环回来时不必重算）
    currentSeed: null,  // 当前配色种子
    sizes: {},          // url -> { w, h } 图片原始尺寸（算最佳缩放要用）
    fill: null,         // 留白填充层 #bgFill（"完整显示"模式下才亮出来）
    mode: null,         // 当前采用的缩放方式：'cover' | 'contain'
    fillBlur: 36,       // 填充层的模糊强度（px）
    fit: null,          // 最近一次算出的缩放结果（调试时可看）
    scanning: false,    // 是否正在按命名约定探测新图
    scanPromise: null,  // 探测过程的 Promise（重复调用时复用，不会重复探）
    scanFound: [],      // 本次扫描确认存在的图（含已在清单里的）
    scanAdded: []       // 其中真正新增、被自动加进轮播的那几张
  };

  function bgConfig() {
    return (state.data && state.data.background) || {};
  }

  /* 从一张已加载完成的图上取色（带缓存） */
  function seedFromUrl(url, img) {
    if (!url) return null;
    if (bg.seeds[url]) return bg.seeds[url];
    var picked = null;
    try { picked = analyzeImage(img); } catch (e) { picked = null; }
    if (picked) bg.seeds[url] = picked;
    return picked;
  }
  /* 提前把下一张拉到本地，切换时就不至于空一拍 */
  function preloadBg(url) {
    if (!url) return;
    var img = new Image();
    img.decoding = 'async';
    img.src = url;
  }

  /* ── 背景图自动识别 ──────────────────────────────────────────────
   * 纯静态站（Cloudflare Pages / GitHub Pages …）没有目录索引，
   * 浏览器也没法问服务器「这个文件夹里都有什么文件」，所以「自动识别」
   * 只能按**命名约定**探测：把 pattern 里的 {n} 换成序号去试着加载，
   * 能 load 出来就说明这张图存在。
   *
   * 探测是「顺序 + 提前收工」的：从 from 开始一个一个往后试，
   * 连续 missLimit 个序号都探不到就停 —— 所以 9 张图时只会发约 11 个请求
   * （其中 9 个还命中 HTTP 缓存），不会把 1~60 全试一遍。
   * 探到的图会立刻并入轮播列表（bg.list），新加的图下次打开就自动出现在轮播里。
   * ─────────────────────────────────────────────────────────────── */

  /* 把 pattern 里的 {n} / {n2} / {n3} 换成序号；{n2} 表示补零到 2 位 */
  function scanPatternUrl(pattern, n) {
    if (!pattern) return null;
    return String(pattern).replace(/\{n(\d)?\}/g, function (m, width) {
      var s = String(n);
      if (width) { while (s.length < Number(width)) s = '0' + s; }
      return s;
    });
  }

  /* 试着加载一张图：加载成功 = 这张图存在。顺手把原始尺寸记下来，
     这样它第一次上场时就能直接按页面尺寸算好最佳缩放，不用先黑一拍。 */
  function probeImage(url, timeoutMs) {
    return new Promise(function (resolve) {
      var img = new Image();
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(false);
      }, Math.max(1000, Number(timeoutMs) || 8000));

      var finish = function (ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (ok && img.naturalWidth && img.naturalHeight) {
          bg.sizes[url] = { w: img.naturalWidth, h: img.naturalHeight };
        }
        resolve(ok);
      };

      img.decoding = 'async';
      img.onload = function () { finish(true); };
      img.onerror = function () { finish(false); };
      img.src = url;
    });
  }

  /* 按命名约定探测一遍；返回 Promise，resolve 出「本次新发现的图」 */
  function scanBackgrounds() {
    var cfg = bgConfig();
    var sc = cfg.autoScan;
    var none = Promise.resolve([]);

    if (!sc || sc.enabled === false) return none;

    var pattern = sc.pattern;
    // pattern 里没有 {n} 就没法「按序号探」，直接跳过（避免误当成一张固定图反复探）
    if (!pattern || !/\{n(\d)?\}/.test(pattern)) return none;

    // 已经在探了就复用同一个过程，不重复发请求
    if (bg.scanning && bg.scanPromise) return bg.scanPromise;

    var from = Math.max(0, Number(sc.from) || 1);
    var to = Math.max(from, Number(sc.to) || from + 30);
    var missLimit = Math.max(1, Number(sc.missLimit) || 2);
    var exclude = sc.exclude || [];
    var isExcluded = function (n, url) {
      for (var i = 0; i < exclude.length; i++) {
        if (exclude[i] === n || exclude[i] === url) return true;
      }
      return false;
    };

    bg.scanning = true;
    var found = [];      // 本次扫描「确认存在」的全部图
    var added = [];      // 其中「原本不在轮播列表里」的（真正的新增）
    var misses = 0;
    var n = from;

    var step = function () {
      if (n > to || misses >= missLimit) return Promise.resolve();
      var url = scanPatternUrl(pattern, n);
      var seq = n;
      n += 1;
      if (isExcluded(seq, url)) return step();      // 明确排除的序号：既不算命中也不算未命中

      return probeImage(url).then(function (ok) {
        if (ok) {
          misses = 0;
          found.push(url);
          if (bg.list.indexOf(url) < 0) {           // 新图直接并入轮播列表
            bg.list.push(url);
            added.push(url);
          }
        } else {
          misses += 1;
        }
        return step();
      });
    };

    bg.scanPromise = step().then(function () {
      bg.scanning = false;
      bg.scanFound = found.slice();
      bg.scanAdded = added.slice();

      // 只在真有新增时出声，平时保持控制台干净
      if (added.length) {
        console.log('[homepage] 自动识别到 ' + added.length + ' 张新增背景图，已加入轮播：' + added.join('、'));

        // 新图可能把「不够轮播」变成「够轮播」，也可能需要补预载
        document.documentElement.classList.add('has-bg');

        var curLayer = bg.layers[bg.active];
        var alreadyPlaying = !!(curLayer && curLayer.style.backgroundImage);
        if (alreadyPlaying) {
          // 已经在播了：重设定时器（让新图也轮得到），并补一次预载
          startBgTimer();
          if (bg.list.length > 1) preloadBg(bg.list[(bg.idx + 1) % bg.list.length]);
        }
        // 还没开播（images 留空的纯自动模式）：交给 initBackground 的后续处理去开播，
        // 免得图还没显示就先跑起了定时器
      }
      return added;
    });

    return bg.scanPromise;
  }

  /* 手动再来一遍探测（例如刚传完图，不想刷新页面）：__homepage.rescanBackgrounds() */
  function rescanBackgrounds() {
    bg.scanning = false;
    bg.scanPromise = null;
    return scanBackgrounds();
  }


  /* ── 背景缩放：按「页面尺寸 ÷ 图片尺寸」自动挑最合适的缩放方式 ──
   *   cover   铺满视口，超出的部分裁掉
   *   contain 整张图等比缩放到看得全，四周留白由 #bgFill 填上
   *   auto    先算用 cover 会裁掉多少画面，裁得太多（超过 cropLimit）就改用 contain
   * 无论哪种，额外放大都只放「刚好盖住模糊吸掉的那一圈」，不再用固定值：
   * 所以窗口越大放得越少，不会被白裁一大块。
   * ─────────────────────────────────────────────────────────────────── */
  function computeFit(url) {
    var cfg = bgConfig();
    var vw = Math.max(1, document.documentElement.clientWidth);
    var vh = Math.max(1, document.documentElement.clientHeight);
    var size = bg.sizes[url];
    var want = (cfg.fit === 'cover' || cfg.fit === 'contain') ? cfg.fit : 'auto';
    var out = { mode: 'cover', zoom: 1, visible: 1, vw: vw, vh: vh, want: want };

    // 图片尺寸还没测出来（首次加载中）：先按 CSS 默认值走，别乱动
    if (!size || !size.w || !size.h) {
      out.mode = want === 'contain' ? 'contain' : 'cover';
      return out;
    }

    // cover 需要的缩放比（取宽、高两个方向的较大者）
    var scale = Math.max(vw / size.w, vh / size.h);
    out.coverScale = scale;

    // 铺满时整张图能露出多少：1 = 全看得到，越小说明裁掉越多
    out.visible = (vw * vh) / (size.w * size.h * scale * scale);

    var cropLimit = (typeof cfg.cropLimit === 'number') ? cfg.cropLimit : 0.35;
    out.cropLimit = cropLimit;
    out.mode = (want === 'auto')
      ? (out.visible >= 1 - cropLimit ? 'cover' : 'contain')
      : want;

    var blurPx = Math.max(0, Number(cfg.blur) || 0);
    out.zoom = out.mode === 'cover' ? 1 + (2 * blurPx) / Math.min(vw, vh) : 1;
    return out;
  }

  /* 把算好的缩放方式应用到某个图层元素上 */
  function applyFit(el, url) {
    if (!el) return null;
    var r = computeFit(url);
    el.style.setProperty('--bg-zoom', r.zoom.toFixed(4));
    if (bg.mode !== r.mode) {
      bg.mode = r.mode;
      document.documentElement.classList.toggle('has-bg-contain', r.mode === 'contain');
    }
    bg.fit = r;
    return r;
  }

  /* 填充层：跟上当前图片，并按它自己的模糊半径算放大值（盖住它的模糊边缘） */
  function updateFill(url) {
    var el = bg.fill;
    if (!el) return;
    if (url) el.style.backgroundImage = 'url("' + url.replace(/"/g, '') + '")';
    var min = Math.max(1, Math.min(document.documentElement.clientWidth,
                                   document.documentElement.clientHeight));
    el.style.setProperty('--bg-fill-zoom', (1 + (2 * bg.fillBlur) / min).toFixed(4));
  }

  /* 视口尺寸变了（转屏 / 拖动窗口 / 手机地址栏收起）→ 按新尺寸重算一次 */
  function refitBackground() {
    var list = bg.list;
    if (!list.length) return;
    var url = list[((bg.idx % list.length) + list.length) % list.length];
    var cur = bg.layers[bg.active] || bg.layers[0];
    applyFit(cur, url);
    updateFill(url);
  }

  function showBackground(index) {
    var cfg = bgConfig();
    var list = bg.list;
    if (!list.length) return;

    var url = list[((index % list.length) + list.length) % list.length];
    var cur = bg.layers[bg.active];
    var next = bg.layers[1 - bg.active];
    if (!next) return;

    var img = new Image();
    img.decoding = 'async';

    img.onload = function () {
      // 先把这张图的原始尺寸记下来：缩放方式要按它和页面尺寸一起算
      if (img.naturalWidth && img.naturalHeight) {
        bg.sizes[url] = { w: img.naturalWidth, h: img.naturalHeight };
      }

      next.style.backgroundImage = 'url("' + url.replace(/"/g, '') + '")';
      applyFit(next, url);                   // 按「页面尺寸 ÷ 图片尺寸」自动挑最佳缩放
      updateFill(url);                       // 留白填充层跟上同一张图
      void next.offsetWidth;                 // 强制一次样式计算，保证淡入一定生效
      next.classList.add('bg--on');
      if (cur) cur.classList.remove('bg--on');
      bg.active = 1 - bg.active;
      bg.idx = index;
      bg.retry = 0;                          // 加载成功，重置连跳预算

      // ── 关键：配色跟着当前背景图走 ──
      if (cfg.followColor !== false) {
        var seed = seedFromUrl(url, img);
        if (seed) {
          bg.currentSeed = seed;
          state.seed = seed;
          applyTheme(seed, true);
        }
      }

      if (list.length > 1) preloadBg(list[(index + 1) % list.length]);

      // 依次播完就停（loop: false）：刚显示的就是最后一张，收工
      if (!stillRotating()) stopBgTimer();
    };

    img.onerror = function () {
      console.warn('[homepage] 背景图加载失败，已从轮播中移除：' + url);

      // 把这张从轮播表里剔掉。否则每轮到它都失败一次，画面上就会
      // 看起来「卡在上一张不动」（例如 data.js 里还列着已经删掉的图片）。
      var at = bg.list.indexOf(url);
      if (at >= 0) bg.list.splice(at, 1);
      // 指针要跟着前面的删除一起前移，才不会跳过下一张
      if (at >= 0 && at <= bg.idx) bg.idx -= 1;

      if (bg.list.length < 2) { stopBgTimer(); return; }

      // 坏图刚好是最后一张时不回头，直接停在已显示的那张
      if (!stillRotating()) { stopBgTimer(); return; }

      // 立刻试下一张，而不是白等一个 interval，中间不留空档。
      // 用一个预算上限兜底，避免整份清单都是坏图时无限连跳。
      bg.retry = (bg.retry || 0) + 1;
      if (bg.retry > 30) { bg.retry = 0; return; }
      showBackground(bg.idx + 1);
    };

    img.src = url;
  }

  function stopBgTimer() {
    if (bg.timer) { clearInterval(bg.timer); bg.timer = null; }
  }

  /* 还要不要继续往后播？
   *   - paused: true          → 不播
   *   - 有效图片少于 2 张      → 没什么可轮播的
   *   - loop: false 且已到最后一张 → 停在最后一张（依次播完即止） */
  function stillRotating() {
    var cfg = bgConfig();
    if (cfg.paused) return false;
    if (bg.list.length < 2) return false;
    if (cfg.loop === false && bg.idx >= bg.list.length - 1) return false;
    return true;
  }

  function startBgTimer() {
    stopBgTimer();
    if (!stillRotating()) return;
    if (document.hidden) return;               // 页面在后台就别浪费电
    var ms = Math.max(1000, (Number(bgConfig().interval) || 3) * 1000);
    bg.timer = setInterval(function () { showBackground(bg.idx + 1); }, ms);
  }

  function initBackground() {
    var cfg = bgConfig();
    var root = document.documentElement;
    var sc = cfg.autoScan || {};
    var willScan = sc.enabled !== false && !!sc.pattern;

    // 一张图都没显式配也不急着退出：可能开着自动识别，图是从 backgrounds/ 里探出来的
    if ((!cfg.images || !cfg.images.length) && !willScan) return;

    bg.list = (cfg.images || []).slice();
    bg.layers = [$('#bgA'), $('#bgB')].filter(Boolean);
    bg.fill = $('#bgFill');
    if (!bg.layers.length) return;

    // 留白填充层（只有 "完整显示" 模式才亮出来）的模糊强度
    if (typeof cfg.fillBlur === 'number' && cfg.fillBlur >= 0) bg.fillBlur = cfg.fillBlur;
    root.style.setProperty('--bg-fill-blur', bg.fillBlur + 'px');
    updateFill(null);

    // 模糊与遮罩浓度（都来自 data.js）
    if (typeof cfg.blur === 'number' && cfg.blur > 0) {
      root.style.setProperty('--bg-blur', cfg.blur + 'px');
      root.classList.add('has-bg-blur');
    }
    if (typeof cfg.veil === 'number') {
      root.style.setProperty('--bg-veil', String(cfg.veil));
    }
    if (bg.list.length) root.classList.add('has-bg');

    // 先按 data.js 里显式列出的清单播起来，保证首屏立刻有背景、不等探测
    if (bg.list.length) {
      showBackground(0);
      startBgTimer();
    }

    // 再去按命名约定探测「新增的背景图」，探到的会并入 bg.list。
    // 放在首屏之后是为了不拖慢打开速度：探测要发若干请求，不该挡在第一张图前面。
    scanBackgrounds().then(function () {
      if (!bg.list.length) return;
      var cur = bg.layers[bg.active];
      var painted = cur && cur.style.backgroundImage;
      if (!painted) {
        // 纯自动识别模式（images 留空）：第一次探到图，现在开始播
        showBackground(0);
        startBgTimer();
      }
    });

    // 切到后台暂停、回到前台继续
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopBgTimer();
      else startBgTimer();
    });

    // 视口尺寸变了（转屏 / 拖动窗口 / 手机地址栏收起）→ 按新尺寸重挑一次最佳缩放
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refitBackground, 150);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(refitBackground, 250);      // 等系统把新尺寸算完再量
    });
  }

  /* ══════════════════════════ 7. 启动 ══════════════════════════ */

  function resolveSeed(data) {
    var t = data.theme || {};
    var fallback = hexToLch(t.fallbackSeed || '#6750A4');
    var avatar = (data.profile && data.profile.avatar) || '';

    var from = t.extractFrom;
    if (from !== 'background' && from !== 'avatar' && from !== 'none') {
      // 兼容旧写法：extractFromAvatar: false 等价于 'none'
      from = (t.extractFromAvatar === false) ? 'none' : 'avatar';
    }

    // 'background' 的取色交给 initBackground()：背景每换一张就取一次色。
    // 这里先返回兜底色，避免首屏空等。
    if (from !== 'avatar' || !avatar) return Promise.resolve(fallback);

    return loadImage(avatar).then(function (img) {
      if (!img) return fallback;
      var picked = null;
      try { picked = analyzeImage(img); } catch (e) { picked = null; }
      return picked || fallback;
    });
  }

  function init() {
    var data = window.SITE_DATA;
    if (!data) {
      var hero = $('#hero');
      if (hero) {
        hero.innerHTML = '<div class="notice">未找到配置：请确认 <code>data.js</code> 与本页面位于同一目录，' +
                         '且文件中定义了 <code>window.SITE_DATA</code>。</div>';
      }
      return;
    }

    state.data = data;
    state.mode = (function () {
      var saved = null;
      try { saved = localStorage.getItem('homepage-theme'); } catch (e) { }
      if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
      var m = (data.theme && data.theme.mode) || 'auto';
      return (m === 'light' || m === 'dark') ? m : 'auto';
    })();

    if (data.profile && data.profile.name) {
      document.title = data.profile.name + ' · 个人主页';
    }

    // 先用兜底色渲染，保证首屏立刻正确
    state.seed = hexToLch((data.theme && data.theme.fallbackSeed) || '#6750A4');
    applyTheme(state.seed, false);

    renderBar();
    renderHero();
    renderGroups();
    renderFooter();
    wireThemeToggle();
    wireShare();
    watchAppBar();
    initBackground();

    // 安全网：无论动画如何，2 秒后强制显示全部内容
    setTimeout(function () {
      var els = document.querySelectorAll('.reveal');
      for (var i = 0; i < els.length; i++) els[i].style.opacity = '1';
    }, 2000);

    // 跟随系统深浅色变化
    var onSystemChange = function () {
      if (state.mode === 'auto') applyTheme(state.seed, true);
    };
    if (mqDark.addEventListener) mqDark.addEventListener('change', onSystemChange);
    else if (mqDark.addListener) mqDark.addListener(onSystemChange);

    // 异步动态取色：成功后再平滑切换整套配色
    resolveSeed(data).then(function (seed) {
      state.seed = seed;
      applyTheme(seed, true);
    });

    document.documentElement.classList.add('is-ready');

    // 调试钩子：在网址后加 ?debug=1 可在控制台访问内部函数，便于排查取色问题
    // 例如：__homepage.hexToLch('#E91E63')
    if (/[?&]debug=1/.test(location.search)) {
      window.__homepage = {
        state: state,
        bg: bg,                 // 背景轮播状态：bg.list 是当前实际在用的图片清单
        showBackground: showBackground,
        startBgTimer: startBgTimer,
        stopBgTimer: stopBgTimer,
        computeFit: computeFit,       // 传入图片地址，看当前尺寸下会选 cover 还是 contain
        refitBackground: refitBackground,  // 视口变了手动重算一次
        scanBackgrounds: scanBackgrounds,      // 按命名约定探一遍新图（已探过则复用结果）
        rescanBackgrounds: rescanBackgrounds,  // 强制重探（传完新图不想刷新时用）
        scanPatternUrl: scanPatternUrl,        // 看某个序号会被解析成什么地址
        analyzeImage: analyzeImage,
        buildScheme: buildScheme,
        applyTheme: applyTheme,
        hexToLch: hexToLch,
        lchToHex: lchToHex,
        hexToRgb: hexToRgb
      };
      console.log('[homepage] debug 模式已开启，可用 __homepage 访问内部函数');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
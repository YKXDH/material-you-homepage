/* ============================================================================
 * editor.js —— 可视化配置编辑器
 * ----------------------------------------------------------------------------
 * 给「个人主页」做的可视化配置界面：不必手写 data.js，在左侧表单里改，
 * 右侧 iframe 立刻能看到真实效果（会完整加载 style.css 与 script.js，
 * 所以背景轮播、动态取色、毛玻璃、亮暗模式都与正式页面一致）。
 *
 * 实现要点：
 *   1. 以 window.SITE_DATA（本页引用的 data.js）作为编辑起点；
 *   2. 预览时抓取 index.html，把 <script src="data.js"> 换成当前数据再塞进
 *      iframe.srcdoc，因此渲染路径与线上完全一致；
 *   3. 导出的 data.js 自带注释、格式与手写版本一致，可直接覆盖原文件；
 *   4. 未导出的改动会暂存到 localStorage，刷新页面不丢。
 * 零依赖、零构建：只用原生 DOM API。
 * ==========================================================================*/
(function () {
  'use strict';

  /* ══════════════════════════════ 0. 基础工具 ══════════════════════════════ */

  var DRAFT_KEY = 'homepage-editor-draft';
  var SNACK_MS = 2600;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /** 迷你 DOM 构造器：h('div', { class: 'x', text: 'y' }, [child, 'text']) */
  function h(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'dataset') { Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; }); }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    if (kids) {
      [].concat(kids).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number'
          ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  }

  var ICON = {
    up: 'M7.4 9.4 12 4.8l4.6 4.6-1.4 1.4L13 8.6V19h-2V8.6L8.8 10.8Z',
    down: 'M16.6 14.6 12 19.2l-4.6-4.6 1.4-1.4 2.2 2.2V5h2v10.4l2.2-2.2Z',
    trash: 'M9 3h6l1 2h4v2H4V5h4Zm-3 6h12l-.8 11.1A1.9 1.9 0 0 1 15.3 22H8.7a1.9 1.9 0 0 1-1.9-1.9Z',
    plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6Z'
  };
  function iconSvg(name) {
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="' +
      ICON[name] + '"/></svg>';
  }

  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function clampNum(v, min, max, def) {
    var n = Number(v);
    if (!isFinite(n)) n = def;
    return Math.min(max, Math.max(min, n));
  }
  function oneOf(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }
  function isHex(v) { return /^#[0-9a-fA-F]{6}$/.test(str(v).trim()); }
  function hexOr(v, def) { return isHex(v) ? str(v).trim() : def; }

  /* ══════════════════════════════ 1. 状态 ══════════════════════════════ */

  var original = null;      // 页面加载时的配置（「放弃改动」用它还原）
  var data = null;          // 正在编辑的工作副本
  var template = null;      // index.html 源文本（预览模板）
  var templateFailed = false;
  var activeTab = 'basic';
  var previewTimer = null;
  var pendingPreview = false;
  var snackTimer = null;
  var sections = {};        // { tab: sectionEl }
  var codeEls = null;       // { ta, issues }

  /* ══════════════════════════════ 2. 数据规整 ══════════════════════════════ */

  function normLink(l) {
    var o = {};
    Object.keys(l || {}).forEach(function (k) { o[k] = l[k]; });   // 保留未知字段，避免丢数据
    o.label = str(o.label);
    o.desc = str(o.desc);
    o.url = str(o.url);
    o.copy = str(o.copy);
    o.icon = str(o.icon);
    o.iconUrl = str(o.iconUrl);
    o.color = str(o.color);
    o.sameTab = o.sameTab === true;
    o.featured = o.featured === true;
    return o;
  }

  function normalize(raw) {
    var d = (raw && typeof raw === 'object') ? clone(raw) : {};

    var p = d.profile = (d.profile && typeof d.profile === 'object') ? d.profile : {};
    p.name = str(p.name);
    p.handle = str(p.handle);
    p.avatar = str(p.avatar) || 'avatar.webp';
    p.tagline = str(p.tagline);
    p.bio = str(p.bio);
    p.location = str(p.location);
    p.chips = Array.isArray(p.chips) ? p.chips.map(str) : [];
    p.email = str(p.email);
    p.footer = str(p.footer);
    p.copyright = str(p.copyright);

    var t = d.theme = (d.theme && typeof d.theme === 'object') ? d.theme : {};
    t.extractFrom = oneOf(t.extractFrom, ['background', 'avatar', 'none'], 'background');
    t.hueShift = clampNum(t.hueShift, 0, 360, 0);
    t.fallbackSeed = hexOr(t.fallbackSeed, '#6750A4');
    t.mode = oneOf(t.mode, ['auto', 'light', 'dark'], 'auto');

    var b = d.background = (d.background && typeof d.background === 'object') ? d.background : {};
    b.images = Array.isArray(b.images) ? b.images.map(str).filter(function (s) { return s.trim() !== ''; }) : [];
    var sc = b.autoScan = (b.autoScan && typeof b.autoScan === 'object') ? b.autoScan : {};
    sc.enabled = sc.enabled !== false;
    sc.pattern = str(sc.pattern) || 'backgrounds/bg-{n2}.webp';
    sc.from = Math.round(clampNum(sc.from, 0, 999, 1));
    sc.to = Math.round(clampNum(sc.to, 1, 999, 60));
    sc.missLimit = Math.round(clampNum(sc.missLimit, 1, 99, 2));
    sc.exclude = Array.isArray(sc.exclude) ? sc.exclude.filter(function (x) {
      return x !== null && x !== undefined && str(x).trim() !== '';
    }) : [];
    b.interval = clampNum(b.interval, 1, 300, 5);
    b.blur = clampNum(b.blur, 0, 60, 2);
    b.veil = clampNum(b.veil, 0, 1, 0.5);
    b.followColor = b.followColor !== false;
    b.fit = oneOf(b.fit, ['cover', 'contain', 'auto'], 'cover');
    b.cropLimit = clampNum(b.cropLimit, 0, 1, 0.35);
    b.fillBlur = clampNum(b.fillBlur, 0, 120, 36);
    b.loop = b.loop !== false;
    b.paused = b.paused === true;

    d.groups = Array.isArray(d.groups) ? d.groups.filter(function (g) {
      return g && typeof g === 'object';
    }).map(function (g) {
      return {
        title: str(g.title),
        subtitle: str(g.subtitle),
        links: Array.isArray(g.links) ? g.links.filter(function (l) {
          return l && typeof l === 'object';
        }).map(normLink) : []
      };
    }) : [];

    return d;
  }

  /* ══════════════════════════════ 3. 导出：生成 data.js ══════════════════════════════ */

  function jsStr(v) {
    return "'" + str(v)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029') + "'";
  }

  function jsItem(v) {
    if (typeof v === 'number' && isFinite(v)) return String(v);
    return jsStr(v);
  }

  function padTo(s, n) {
    if (s.length >= n) return s + ' ';
    var out = s;
    while (out.length < n) out += ' ';
    return out + ' ';
  }

  function line(indent, key, value, comment) {
    var s = indent + key + ': ' + value + ',';
    return comment ? padTo(s, 40) + ' // ' + comment : s;
  }

  function arrLine(items, indent, maxLen) {
    var parts = items.map(jsItem);
    var one = '[' + parts.join(', ') + ']';
    if ((indent + one).length <= maxLen) return one;
    return '[\n' + items.map(function (v, i) {
      return indent + '  ' + parts[i] + (i < items.length - 1 ? ',' : '');
    }).join('\n') + '\n' + indent + ']';
  }

  function linkLine(indent, l) {
    var parts = ['label: ' + jsStr(l.label)];
    if (l.desc) parts.push('desc: ' + jsStr(l.desc));
    if (l.url) parts.push('url: ' + jsStr(l.url));
    if (l.copy) parts.push('copy: ' + jsStr(l.copy));
    if (l.icon) parts.push('icon: ' + jsStr(l.icon));
    if (l.iconUrl) parts.push('iconUrl: ' + jsStr(l.iconUrl));
    if (l.color) parts.push('color: ' + jsStr(l.color));
    if (l.sameTab) parts.push('sameTab: true');
    if (l.featured) parts.push('featured: true');

    var one = indent + '{ ' + parts.join(', ') + ' }';
    if (one.length <= 112) return one;
    var out = [indent + '{'];
    parts.forEach(function (pt, i) { out.push(indent + '  ' + pt + (i < parts.length - 1 ? ',' : '')); });
    out.push(indent + '}');
    return out.join('\n');
  }

  function serialize() {
    var p = data.profile, t = data.theme, b = data.background, sc = b.autoScan;
    var L = [];

    L.push('/* ============================================================================');
    L.push(' * data.js —— 全站唯一需要你手动编辑的文件');
    L.push(' * ----------------------------------------------------------------------------');
    L.push(' * 此文件由可视化编辑器生成；改完保存、刷新页面即可生效，不需要任何构建步骤。');
    L.push(' * 所有文本都支持中文 / emoji；所有 url 记得写完整（含 https://）。');
    L.push(' * ==========================================================================*/');
    L.push('');
    L.push('window.SITE_DATA = {');
    L.push('');

    /* 1) 个人信息 */
    L.push('  /* ─────────────────────────────────────────────────────────────────────');
    L.push('   * 1) 个人信息区');
    L.push('   * ─────────────────────────────────────────────────────────────────── */');
    L.push('  profile: {');
    L.push(line('    ', 'name', jsStr(p.name), '主标题（大字）'));
    L.push(line('    ', 'handle', jsStr(p.handle), '副标题（小字，可留空）'));
    L.push(line('    ', 'avatar', jsStr(p.avatar), '头像路径或图片直链'));
    L.push(line('    ', 'tagline', jsStr(p.tagline), '一句话签名（可留空）'));
    L.push(line('    ', 'bio', jsStr(p.bio), '简介：换行用 \\n，**双星号**包住会高亮'));
    L.push(line('    ', 'location', jsStr(p.location), '位置（可留空）'));
    L.push(line('    ', 'chips', arrLine(p.chips, '    ', 90), '名字下面的小标签'));
    L.push(line('    ', 'email', jsStr(p.email), '留空则不显示邮箱按钮'));
    L.push(line('    ', 'footer', jsStr(p.footer), '留空则自动生成页脚'));
    L.push(line('    ', 'copyright', jsStr(p.copyright), '留空则不显示版权行'));
    L.push('  },');
    L.push('');

    /* 2) 主题 */
    L.push('  /* ─────────────────────────────────────────────────────────────────────');
    L.push('   * 2) 主题 / 动态取色');
    L.push('   * ─────────────────────────────────────────────────────────────────── */');
    L.push('  theme: {');
    L.push(line('    ', 'extractFrom', jsStr(t.extractFrom), "'background' | 'avatar' | 'none'"));
    L.push(line('    ', 'hueShift', String(t.hueShift), '色相偏转（度）'));
    L.push(line('    ', 'fallbackSeed', jsStr(t.fallbackSeed), '取色失败时的种子色'));
    L.push(line('    ', 'mode', jsStr(t.mode), "'auto' | 'light' | 'dark'"));
    L.push('  },');
    L.push('');

    /* 3) 背景 */
    L.push('  /* ─────────────────────────────────────────────────────────────────────');
    L.push('   * 3) 背景图轮播');
    L.push('   *    图片放进 backgrounds/ 目录；下面没列的也会被自动识别（见 autoScan）。');
    L.push('   * ─────────────────────────────────────────────────────────────────── */');
    L.push('  background: {');
    L.push(line('    ', 'images', arrLine(b.images, '    ', 88), '手动列出的背景图（按顺序轮播）'));
    L.push('    autoScan: {');
    L.push(line('      ', 'enabled', String(sc.enabled), '是否自动识别新增的背景图'));
    L.push(line('      ', 'pattern', jsStr(sc.pattern), '{n}=1,2,3 / {n2}=01,02 / {n3}=001'));
    L.push(line('      ', 'from', String(sc.from), '从几号开始探'));
    L.push(line('      ', 'to', String(sc.to), '探到几号为止（上限）'));
    L.push(line('      ', 'missLimit', String(sc.missLimit), '连续几个未命中就收工'));
    L.push(line('      ', 'exclude', arrLine(sc.exclude, '      ', 88), '跳过的序号或完整地址'));
    L.push('    },');
    L.push(line('    ', 'interval', String(b.interval), '几秒换一张（最小 1）'));
    L.push(line('    ', 'blur', String(b.blur), '毛玻璃模糊强度（px）'));
    L.push(line('    ', 'veil', String(b.veil), '主题色遮罩浓度（0~1）'));
    L.push(line('    ', 'followColor', String(b.followColor), '配色是否跟随当前背景图'));
    L.push(line('    ', 'fit', jsStr(b.fit), "'cover' | 'contain' | 'auto'"));
    L.push(line('    ', 'cropLimit', String(b.cropLimit), "仅 'auto' 下生效"));
    L.push(line('    ', 'fillBlur', String(b.fillBlur), "仅 'contain' 下生效"));
    L.push(line('    ', 'loop', String(b.loop), 'false = 播完最后一张就停'));
    L.push(line('    ', 'paused', String(b.paused), 'true = 只显示第一张'));
    L.push('  },');
    L.push('');

    /* 4) 链接分组 */
    L.push('  /* ─────────────────────────────────────────────────────────────────────');
    L.push('   * 4) 链接分组');
    L.push('   *    单个链接：label 必填；url 或 copy 至少有一个。');
    L.push('   *    可选：desc / icon / iconUrl / color / sameTab / featured');
    L.push('   * ─────────────────────────────────────────────────────────────────── */');
    L.push('  groups: [');
    data.groups.forEach(function (g, gi) {
      L.push('    {');
      L.push(line('      ', 'title', jsStr(g.title)));
      if (g.subtitle) L.push(line('      ', 'subtitle', jsStr(g.subtitle)));
      L.push('      links: [');
      g.links.forEach(function (l, li) {
        L.push(linkLine('        ', l) + (li < g.links.length - 1 ? ',' : ''));
      });
      L.push('      ]');
      L.push('    }' + (gi < data.groups.length - 1 ? ',' : ''));
    });
    L.push('  ]');
    L.push('};');
    L.push('');

    return L.join('\n');
  }

  /* ══════════════════════════════ 4. 检查配置 ══════════════════════════════ */

  function issuesOf() {
    var out = [];
    function warn(msg) { out.push({ level: 'warn', text: msg }); }

    var p = data.profile, b = data.background, sc = b.autoScan;

    if (!p.name.trim()) warn('「名称」为空：主页顶部标题会退化成默认文字「个人主页」。');
    if (!p.avatar.trim()) warn('「头像」为空：应用栏与个人信息区都不会显示头像。');
    if (p.email && p.email.indexOf('@') < 0) warn('邮箱格式看起来不对：' + p.email);
    if (p.bio.length > 400) warn('简介偏长（' + p.bio.length + ' 字），个人信息区会被撑得比较高。');

    if (!isHex(data.theme.fallbackSeed)) warn('种子色不是合法的 #RRGGBB：' + data.theme.fallbackSeed);
    if (data.theme.extractFrom === 'background' && b.images.length === 0 && !sc.enabled) {
      warn('取色来源是「跟随背景图」，但既没有背景图、也没开自动识别，会一直用种子色。');
    }

    if (b.images.length === 0 && !sc.enabled) warn('背景图为空且未开启自动识别：页面将没有背景图。');
    if (sc.enabled && !/\{[nN]\d?\}/.test(sc.pattern)) {
      warn('自动识别的 pattern 里找不到 {n} / {n2} / {n3} 占位符，无法逐个探测。');
    }
    if (sc.enabled && sc.from > sc.to) warn('自动识别：起始序号大于结束序号，探测会直接结束。');
    if (sc.enabled && (sc.to - sc.from + 1) < sc.missLimit) {
      warn('自动识别：探测范围比 missLimit 还短，可能一张都没探到就停了。');
    }
    if (sc.to - sc.from + 1 > 200) warn('自动识别范围超过 200 个序号，首屏之后会多发不少探测请求。');
    if (b.images.length <= 1 && !sc.enabled && !b.paused) {
      warn('背景图只有一张且未开自动识别：轮播不会有任何变化。');
    }

    var seen = {};
    data.groups.forEach(function (g, gi) {
      var gname = g.title.trim() || ('第 ' + (gi + 1) + ' 组');
      if (!g.title.trim()) warn('第 ' + (gi + 1) + ' 个分组没有标题。');
      if (g.links.length === 0) warn('分组「' + gname + '」下没有任何链接。');
      g.links.forEach(function (l, li) {
        var tag = '「' + gname + '」第 ' + (li + 1) + ' 个链接';
        if (!l.label.trim()) warn(tag + ' 缺少按钮文字（label）。');
        if (!l.url.trim() && !l.copy.trim()) warn(tag + ' 既没有 url 也没有 copy，点了不会有反应。');
        if (l.url && !/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(l.url.trim())) {
          warn(tag + ' 的 url 可能少了 https://：' + l.url);
        }
        if (l.icon && l.iconUrl) warn(tag + ' 同时填了 icon 与 iconUrl，实际只会用 iconUrl。');
        var u = l.url.trim();
        if (u) {
          if (seen[u]) warn('链接地址重复：' + u);
          else seen[u] = true;
        }
      });
    });
    if (data.groups.length === 0) warn('一个链接分组都没有，主页除了个人信息会是空的。');

    if (out.length === 0) out.push({ level: 'ok', text: '检查通过：没有发现明显问题，可以直接导出。' });
    return out;
  }

  /* ══════════════════════════════ 5. 提示条 / 主题 / 顶栏 ══════════════════════════════ */

  function toast(msg) {
    var el = $('#snackbar');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('snackbar--open');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(function () { el.classList.remove('snackbar--open'); }, SNACK_MS);
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('homepage-theme', next); } catch (e) { /* 隐私模式忽略 */ }
    renderPreview(true);       // 预览重新加载后才会应用新的深浅色
  }

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

  function syncBarAvatar() {
    var el = $('#barAvatar');
    if (!el) return;
    var src = data && data.profile ? str(data.profile.avatar).replace(/"/g, '') : '';
    el.style.backgroundImage = src ? 'url("' + src + '")' : '';
  }

  /* ══════════════════════════════ 6. 脏标记 / 草稿 ══════════════════════════════ */

  function setDirty(on) {
    var badge = $('#edDirty');
    if (badge) badge.hidden = !on;
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 忽略 */ }
  }

  function commit(opts) {
    opts = opts || {};
    setDirty(true);
    syncBarAvatar();
    saveDraft();
    if (activeTab === 'code') refreshCode();
    schedulePreview(opts.now === true);
  }

  /* ══════════════════════════════ 7. 预览 ══════════════════════════════ */

  function ensureTemplate(force) {
    if (template && !force) return Promise.resolve(template);
    return fetch('index.html', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (text) {
      template = text;
      templateFailed = false;
      return text;
    }).catch(function () {
      template = null;
      templateFailed = true;
      return null;
    });
  }

  function previewHtml() {
    var json = JSON.stringify(data, null, 2).replace(/<\//g, '<\\/');
    var base = new URL('index.html', location.href).href;
    var inject = '<base href="' + base.replace(/"/g, '%22') + '">' +
      '<script>window.SITE_DATA = ' + json + ';<\/script>';
    return template
      .replace(/<head([^>]*)>/i, function (m, attrs) { return '<head' + attrs + '>' + inject; })
      .replace(/[ \t]*<script src="data\.js"><\/script>[ \t]*\r?\n?/i, '');
  }

  function schedulePreview(now) {
    var auto = $('#chkAuto');
    if (auto && !auto.checked) { pendingPreview = true; return; }
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () { renderPreview(false); }, now ? 0 : 320);
  }

  function renderPreview(force) {
    var auto = $('#chkAuto');
    if (auto && !auto.checked && !force) { pendingPreview = true; return; }

    var frame = $('#edFrame');
    var note = $('#edFrameNote');
    if (!frame) return;

    ensureTemplate(force === true && templateFailed).then(function () {
      if (!template) {
        if (note) {
          note.hidden = false;
          note.innerHTML = '当前上下文无法读取 <code>index.html</code>，只能预览磁盘上的原始配置。' +
            '若你用 <code>file://</code> 直接打开本页，请改成启动一个本地服务器' +
            '（例如 <code>python3 -m http.server</code>）再访问。';
        }
        if (frame.getAttribute('src') !== 'index.html') frame.setAttribute('src', 'index.html');
        return;
      }
      if (note) note.hidden = true;
      frame.removeAttribute('src');
      frame.srcdoc = previewHtml();
      pendingPreview = false;
    });
  }

  function openPreviewTab() {
    ensureTemplate(false).then(function () {
      var html;
      if (template) {
        html = previewHtml();
      } else {
        html = null;
      }
      if (!html) { window.open('index.html', '_blank', 'noopener'); return; }
      var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      var win = window.open(url, '_blank', 'noopener');
      if (!win) toast('浏览器拦截了新窗口，请允许本页弹出窗口');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    });
  }

  /* ══════════════════════════════ 8. 表单控件 ══════════════════════════════ */

  function field(label, hint, control) {
    return h('div', { class: 'ed-field' }, [
      h('span', { class: 'ed-label' }, [
        label,
        hint ? h('span', { class: 'ed-hint', html: hint }) : null
      ]),
      control
    ]);
  }

  function subhead(text, hint) {
    return h('div', {}, [
      h('p', { class: 'ed-group__name', text: text }),
      hint ? h('p', { class: 'ed-section__hint', html: hint }) : null
    ]);
  }

  function inputText(value, onChange, opts) {
    opts = opts || {};
    var inp = h('input', {
      class: 'ed-input',
      type: opts.type || 'text',
      value: str(value),
      placeholder: opts.placeholder || '',
      'aria-label': opts.aria || '',
      spellcheck: opts.spellcheck === false ? 'false' : null
    });
    inp.addEventListener('input', function () { onChange(inp.value); });
    return inp;
  }

  function inputTextarea(value, onChange, opts) {
    opts = opts || {};
    var ta = h('textarea', {
      class: 'ed-input ed-textarea',
      placeholder: opts.placeholder || '',
      'aria-label': opts.aria || '',
      rows: opts.rows || 4
    });
    ta.value = str(value);
    ta.addEventListener('input', function () { onChange(ta.value); });
    return ta;
  }

  function inputNumber(value, onChange, opts) {
    opts = opts || {};
    var inp = h('input', {
      class: 'ed-input',
      type: 'number',
      min: opts.min,
      max: opts.max,
      step: opts.step || 1,
      value: value,
      'aria-label': opts.aria || ''
    });
    inp.addEventListener('input', function () {
      if (inp.value === '') return;
      var v = Number(inp.value);
      if (isFinite(v)) onChange(v);
    });
    return inp;
  }

  function inputSelect(value, options, onChange, aria) {
    var sel = h('select', { class: 'ed-input', 'aria-label': aria || '' });
    options.forEach(function (o) {
      var op = h('option', { value: o.v, text: o.t });
      if (o.v === value) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { onChange(sel.value); });
    return sel;
  }

  function inputSwitch(checked, labelText, onChange, hint) {
    var inp = h('input', { type: 'checkbox' });
    inp.checked = !!checked;
    inp.addEventListener('change', function () { onChange(inp.checked); });
    return h('label', { class: 'ed-switch' }, [
      inp,
      h('span', {}, [
        labelText,
        hint ? h('span', { class: 'ed-hint', html: '　' + hint }) : null
      ])
    ]);
  }

  function inputRange(value, opts, onChange) {
    opts = opts || {};
    var fmt = opts.format || function (v) {
      var n = Number(v);
      return (Math.round(n * 100) / 100) + (opts.suffix || '');
    };
    var out = h('output', {}, fmt(value));
    var inp = h('input', {
      type: 'range',
      min: opts.min, max: opts.max, step: opts.step || 1,
      value: value,
      'aria-label': opts.aria || ''
    });
    inp.addEventListener('input', function () {
      out.textContent = fmt(inp.value);
      onChange(Number(inp.value));
    });
    return h('div', { class: 'ed-range' }, [inp, out]);
  }

  function inputColor(value, onChange, opts) {
    opts = opts || {};
    var txt = h('input', {
      class: 'ed-input',
      type: 'text',
      value: str(value),
      placeholder: opts.placeholder || '#6750A4',
      'aria-label': opts.aria || ''
    });
    var col = h('input', { class: 'ed-input ed-color', type: 'color', value: hexOr(value, '#6750A4') });
    txt.addEventListener('input', function () {
      if (isHex(txt.value)) col.value = txt.value.trim();
      onChange(txt.value);
    });
    col.addEventListener('input', function () {
      txt.value = col.value;
      onChange(col.value);
    });
    return h('div', { class: 'ed-inline' }, [txt, col]);
  }

  function iconBtn(name, title, fn, disabled) {
    var b = h('button', {
      class: 'icon-btn ed-mini',
      type: 'button',
      title: title,
      'aria-label': title,
      html: iconSvg(name)
    });
    if (disabled) {
      b.disabled = true;
      b.style.opacity = '.35';
      b.style.pointerEvents = 'none';
    }
    b.addEventListener('click', fn);
    return b;
  }

  function btn(label, variant, fn, cls) {
    return h('button', {
      class: 'btn ' + (variant || 'btn--tonal') + (cls ? ' ' + cls : ''),
      type: 'button',
      text: label,
      onclick: fn
    });
  }

  function moveItem(arr, index, delta) {
    var next = index + delta;
    if (next < 0 || next >= arr.length) return;
    var tmp = arr[index];
    arr[index] = arr[next];
    arr[next] = tmp;
  }

  /** 通用「一行一个值」的列表编辑器 */
  function listEditor(arr, opts) {
    opts = opts || {};
    var toText = opts.toText || function (v) { return str(v); };
    var toValue = opts.toValue || function (t) { return t; };
    var make = opts.make || function () { return ''; };
    var box = h('div', {});

    function rebuild() {
      box.innerHTML = '';
      if (arr.length === 0 && opts.emptyHint) {
        box.appendChild(h('p', { class: 'ed-section__hint', text: opts.emptyHint }));
      }
      arr.forEach(function (val, i) {
        box.appendChild(h('div', { class: 'ed-row--item' }, [
          inputText(toText(val), function (v) { arr[i] = toValue(v); commit({ now: true }); }, {
            placeholder: opts.placeholder || '',
            spellcheck: false,
            aria: opts.aria || ''
          }),
          iconBtn('up', '上移', function () { moveItem(arr, i, -1); rebuild(); commit({ now: true }); }, i === 0),
          iconBtn('down', '下移', function () { moveItem(arr, i, 1); rebuild(); commit({ now: true }); }, i === arr.length - 1),
          iconBtn('trash', '删除', function () { arr.splice(i, 1); rebuild(); commit({ now: true }); })
        ]));
      });
      box.appendChild(btn('＋ ' + (opts.addLabel || '添加一项'), 'btn--outlined', function () {
        arr.push(make());
        rebuild();
        commit({ now: true });
      }, 'ed-add'));
    }

    rebuild();
    return box;
  }

  /* ══════════════════════════════ 9. 各标签页 ══════════════════════════════ */

  function section(tab, title, hint) {
    return h('section', { class: 'ed-section', dataset: { tab: tab } }, [
      h('h2', { class: 'ed-section__title', text: title }),
      hint ? h('p', { class: 'ed-section__hint', html: hint }) : null
    ]);
  }

  /* —— 基本信息 —— */
  function buildBasic() {
    var p = data.profile;
    var sec = section('basic', '基本信息',
      '对应 <code>data.js</code> 里的 <code>profile</code>：名字、头像、简介与页脚。');

    sec.appendChild(field('名称', '主标题，页面里最醒目的那行',
      inputText(p.name, function (v) { p.name = v; commit({ now: true }); }, { placeholder: '你的名字', aria: '名称' })));
    sec.appendChild(field('副标题', '小字，可留空',
      inputText(p.handle, function (v) { p.handle = v; commit({ now: true }); }, { placeholder: '@your_id', aria: '副标题' })));
    sec.appendChild(field('头像', '相对路径或图片直链',
      inputText(p.avatar, function (v) { p.avatar = v; commit({ now: true }); }, { placeholder: 'avatar.webp', aria: '头像' })));
    sec.appendChild(field('一句话签名', '可留空',
      inputText(p.tagline, function (v) { p.tagline = v; commit({ now: true }); }, { placeholder: '字幕工、教程制作', aria: '一句话签名' })));
    sec.appendChild(field('简介', '换行直接回车即可（导出时会写成 <code>\\n</code>）；用 <code>**两个星号**</code> 包住的文字会渲染成高亮色块',
      inputTextarea(p.bio, function (v) { p.bio = v; commit({ now: true }); }, { rows: 5, aria: '简介', placeholder: '一句话介绍自己' })));
    sec.appendChild(field('位置', '可留空',
      inputText(p.location, function (v) { p.location = v; commit({ now: true }); }, { placeholder: '中国·某地', aria: '位置' })));
    sec.appendChild(field('邮箱按钮', '填了才会显示「电子邮箱」按钮',
      inputText(p.email, function (v) { p.email = v; commit({ now: true }); }, { placeholder: 'you@example.com', aria: '邮箱' })));
    sec.appendChild(subhead('小标签', '名字下面的一排 chip，比如「字幕」「教程」。'));
    sec.appendChild(listEditor(p.chips, {
      placeholder: '标签文字',
      addLabel: '添加标签',
      make: function () { return '新标签'; },
      emptyHint: '还没有标签，点下面的按钮添加。'
    }));
    sec.appendChild(field('页脚文字', '留空则由站点自动生成',
      inputText(p.footer, function (v) { p.footer = v; commit({ now: true }); }, { placeholder: '留空自动生成', aria: '页脚文字' })));
    sec.appendChild(field('版权行', '留空则不显示',
      inputText(p.copyright, function (v) { p.copyright = v; commit({ now: true }); }, { placeholder: '© 2025 你的名字', aria: '版权行' })));
    return sec;
  }

  /* —— 主题取色 —— */
  function buildTheme() {
    var t = data.theme;
    var sec = section('theme', '主题取色',
      '对应 <code>data.js</code> 里的 <code>theme</code>：整套配色从哪张图里取、要不要偏转色相。');

    sec.appendChild(field('取色来源', '决定主色来自哪里',
      inputSelect(t.extractFrom, [
        { v: 'background', t: '跟随当前背景图（推荐）' },
        { v: 'avatar', t: '跟随头像' },
        { v: 'none', t: '不取色，固定用种子色' }
      ], function (v) { t.extractFrom = v; commit({ now: true }); }, '取色来源')));

    sec.appendChild(field('色相偏转', '0 = 不偏转；拖动即可换一个色系',
      inputRange(t.hueShift, {
        min: 0, max: 360, step: 1, suffix: '°',
        format: function (v) { return Math.round(v) + '°'; },
        aria: '色相偏转'
      }, function (v) { t.hueShift = v; commit({ now: true }); })));

    sec.appendChild(field('种子色', '取色失败或关闭取色时使用（Material 3 基准紫是 #6750A4）',
      inputColor(t.fallbackSeed, function (v) { t.fallbackSeed = v; commit({ now: true }); }, { aria: '种子色' })));

    sec.appendChild(field('初始深浅色', '首次访问时用哪种模式；不填过本地存储前一直有效',
      inputSelect(t.mode, [
        { v: 'auto', t: '跟随系统' },
        { v: 'light', t: '始终浅色' },
        { v: 'dark', t: '始终深色' }
      ], function (v) { t.mode = v; commit({ now: true }); }, '初始深浅色')));

    return sec;
  }

  /* —— 背景轮播 —— */
  function buildBg() {
    var b = data.background, sc = b.autoScan;
    var sec = section('bg', '背景轮播',
      '对应 <code>data.js</code> 里的 <code>background</code>。图片放 <code>backgrounds/</code> 目录，' +
      '按命名约定就能被自动识别，不必回来改清单。');

    /* 手动清单 */
    sec.appendChild(subhead('背景图清单', '按顺序轮播；下面的自动识别会把新图接在它们后面。'));
    sec.appendChild(listEditor(b.images, {
      placeholder: 'backgrounds/bg-01.webp',
      addLabel: '添加一张',
      make: function () { return 'backgrounds/bg-' + String(b.images.length + 1).padStart(2, '0') + '.webp'; },
      emptyHint: '还没有显式列出背景图（如果开了自动识别，仍会自动找到同目录的图）。'
    }));

    /* 自动识别 */
    sec.appendChild(subhead('自动识别新增背景图',
      '纯静态站没法「列目录」，只能按命名约定逐个探测：能加载出来就说明这张图存在，' +
      '连续 <code>missLimit</code> 个序号都探测不到就停止探测。'));
    sec.appendChild(inputSwitch(sc.enabled, '开启自动识别',
      function (v) { sc.enabled = v; commit({ now: true }); }));
    sec.appendChild(field('命名约定 pattern', '<code>{n}</code> = 1,2,3…；<code>{n2}</code> = 01,02…；<code>{n3}</code> = 001,002…',
      inputText(sc.pattern, function (v) { sc.pattern = v; commit({ now: true }); }, { placeholder: 'backgrounds/bg-{n2}.webp', aria: '命名约定' })));
    sec.appendChild(field('从几号开始探测', '',
      inputNumber(sc.from, function (v) { sc.from = v; commit({ now: true }); }, { min: 0, max: 999, aria: '起始序号' })));
    sec.appendChild(field('探到几号为止', '只是上限；正常早就因连续未命中而停了',
      inputNumber(sc.to, function (v) { sc.to = v; commit({ now: true }); }, { min: 1, max: 999, aria: '结束序号' })));
    sec.appendChild(field('连续几次未命中就收工', '默认 2：探到 bg-10、bg-11 都是 404 就停手',
      inputNumber(sc.missLimit, function (v) { sc.missLimit = v; commit({ now: true }); }, { min: 1, max: 99, aria: 'missLimit' })));
    sec.appendChild(field('跳过这几张', '写序号（如 4）或完整地址（如 backgrounds/bg-07.webp）',
      listEditor(sc.exclude, {
        placeholder: '4 或 backgrounds/bg-07.webp',
        addLabel: '添加跳过项',
        make: function () { return ''; },
        toValue: function (v) { var s = String(v).trim(); return /^\d+$/.test(s) ? Number(s) : s; },
        emptyHint: '没有跳过项。'
      })));

    /* 播放与视觉 */
    sec.appendChild(subhead('播放与视觉', ''));
    sec.appendChild(field('换图间隔', '最小 1 秒',
      inputRange(b.interval, { min: 1, max: 60, step: 1, suffix: ' 秒', format: function (v) { return Math.round(v) + ' 秒'; }, aria: '换图间隔' },
        function (v) { b.interval = v; commit({ now: true }); })));
    sec.appendChild(field('毛玻璃模糊', '0 = 不模糊；数字越大背景越朦胧',
      inputRange(b.blur, { min: 0, max: 30, step: 1, suffix: ' px', format: function (v) { return Math.round(v) + ' px'; }, aria: '模糊强度' },
        function (v) { b.blur = v; commit({ now: true }); })));
    sec.appendChild(field('遮罩浓度', '主题色遮罩：越大内容越清晰、背景越淡',
      inputRange(b.veil, { min: 0, max: 1, step: 0.05, aria: '遮罩浓度', format: function (v) { return Math.round(v * 100) + '%'; } },
        function (v) { b.veil = v; commit({ now: true }); })));
    sec.appendChild(inputSwitch(b.followColor, '配色跟随当前背景图',
      function (v) { b.followColor = v; commit({ now: true }); }, '背景每换一张，整套配色跟着变'));

    var cropField = field('auto 模式的容忍度', '用 cover 时最多容忍裁掉多少画面，超过就改成完整显示',
      inputRange(b.cropLimit, { min: 0, max: 1, step: 0.05, aria: 'cropLimit', format: function (v) { return Math.round(v * 100) + '%'; } },
        function (v) { b.cropLimit = v; commit({ now: true }); }));
    var fillField = field('留白填充模糊', '「完整显示」时四周填充层的模糊强度',
      inputRange(b.fillBlur, { min: 0, max: 120, step: 1, suffix: ' px', format: function (v) { return Math.round(v) + ' px'; }, aria: 'fillBlur' },
        function (v) { b.fillBlur = v; commit({ now: true }); }));

    sec.appendChild(field('缩放方式', '<code>cover</code> 填满裁切 · <code>contain</code> 完整显示 · <code>auto</code> 自动取舍',
      inputSelect(b.fit, [
        { v: 'cover', t: 'cover —— 填满页面，多出来的裁掉（默认）' },
        { v: 'contain', t: 'contain —— 完整显示整张图，四周留白' },
        { v: 'auto', t: 'auto —— 裁得太多才改成完整显示' }
      ], function (v) {
        b.fit = v;
        cropField.hidden = v !== 'auto';
        fillField.hidden = v !== 'contain';
        commit({ now: true });
      }, '缩放方式')));
    sec.appendChild(cropField);
    sec.appendChild(fillField);
    cropField.hidden = b.fit !== 'auto';
    fillField.hidden = b.fit !== 'contain';

    sec.appendChild(inputSwitch(b.loop, '播完循环', function (v) { b.loop = v; commit({ now: true }); }, '关闭则播到最后一张就停住'));
    sec.appendChild(inputSwitch(b.paused, '暂停轮播', function (v) { b.paused = v; commit({ now: true }); }, '只显示第一张，不自动换图'));

    return sec;
  }

  /* —— 链接分组 —— */
  function linkCard(g, link, rebuild) {
    var nameEl = h('span', { class: 'ed-subcard__name', text: link.label || '未命名链接' });
    var index = g.links.indexOf(link);

    var card = h('div', { class: 'ed-subcard' }, [
      h('div', { class: 'ed-subcard__head' }, [
        nameEl,
        h('span', { class: 'ed-tools' }, [
          iconBtn('up', '上移', function () { moveItem(g.links, index, -1); rebuild(); commit({ now: true }); }, index === 0),
          iconBtn('down', '下移', function () { moveItem(g.links, index, 1); rebuild(); commit({ now: true }); }, index === g.links.length - 1),
          iconBtn('trash', '删除链接', function () { g.links.splice(index, 1); rebuild(); commit({ now: true }); })
        ])
      ])
    ]);

    card.appendChild(field('按钮文字', '必填',
      inputText(link.label, function (v) {
        link.label = v;
        nameEl.textContent = v || '未命名链接';
        commit({ now: true });
      }, { placeholder: 'GitHub', aria: '按钮文字' })));

    card.appendChild(field('副文字', '可选，一句话说明',
      inputText(link.desc, function (v) { link.desc = v; commit({ now: true }); }, { placeholder: '代码与开源项目', aria: '副文字' })));

    card.appendChild(field('跳转地址', '填了就是「点击跳转」',
      inputText(link.url, function (v) { link.url = v; commit({ now: true }); }, { placeholder: 'https://github.com/your_id', aria: '跳转地址' })));

    card.appendChild(field('点击复制内容', '没有可跳转地址时用它：只填这里，卡片会变成「点击复制」',
      inputText(link.copy, function (v) { link.copy = v; commit({ now: true }); }, { placeholder: '123456789', aria: '复制内容' })));

    var adv = h('div', { hidden: true }, [
      field('图标名', 'simple-icons 的名字，如 <code>github</code>、<code>bilibili</code>；查询：simpleicons.org',
        inputText(link.icon, function (v) { link.icon = v; commit({ now: true }); }, { placeholder: 'github', aria: '图标名' })),
      field('图标图片地址', '优先级高于图标名',
        inputText(link.iconUrl, function (v) { link.iconUrl = v; commit({ now: true }); }, { placeholder: 'https://…/icon.png', aria: '图标图片地址' })),
      field('图标颜色', "留空跟随主题主色；填 <code>brand</code> 用品牌原色，或写 #RRGGBB",
        inputText(link.color, function (v) { link.color = v; commit({ now: true }); }, { placeholder: 'brand 或 #1DA1F2', aria: '图标颜色' }))
    ]);

    var advBtn = btn('更多设置（图标 / 颜色）', 'btn--tonal', function () {
      adv.hidden = !adv.hidden;
      advBtn.textContent = adv.hidden ? '更多设置（图标 / 颜色）' : '收起更多设置';
    }, 'ed-btn-sm ed-toggle-btn');
    card.appendChild(advBtn);
    card.appendChild(adv);

    card.appendChild(inputSwitch(link.sameTab, '当前标签页打开', function (v) { link.sameTab = v; commit({ now: true }); }, '默认新标签页'));
    card.appendChild(inputSwitch(link.featured, '显示为醒目大卡片', function (v) { link.featured = v; commit({ now: true }); }));

    return card;
  }

  function buildLinks() {
    var sec = section('links', '链接分组',
      '对应 <code>data.js</code> 里的 <code>groups</code>。每组是一排卡片；单个链接至少有文字，' +
      '以及 <code>url</code> 或 <code>copy</code> 之一。');

    function rebuild() {
      mountSection('links', buildLinks());
    }

    if (data.groups.length === 0) {
      sec.appendChild(h('p', { class: 'ed-section__hint', text: '还没有分组，点下面的按钮新建一个。' }));
    }

    data.groups.forEach(function (g, gi) {
      var nameEl = h('span', { class: 'ed-group__name', text: g.title || '未命名分组' });
      var card = h('div', { class: 'ed-group' }, [
        h('div', { class: 'ed-group__head' }, [
          nameEl,
          h('span', { class: 'ed-tools' }, [
            iconBtn('up', '上移分组', function () { moveItem(data.groups, gi, -1); rebuild(); commit({ now: true }); }, gi === 0),
            iconBtn('down', '下移分组', function () { moveItem(data.groups, gi, 1); rebuild(); commit({ now: true }); }, gi === data.groups.length - 1),
            iconBtn('trash', '删除分组', function () {
              data.groups.splice(gi, 1);
              rebuild();
              commit({ now: true });
              toast('已删除分组「' + (g.title || '未命名') + '」');
            })
          ])
        ])
      ]);

      card.appendChild(field('分组标题', '',
        inputText(g.title, function (v) {
          g.title = v;
          nameEl.textContent = v || '未命名分组';
          commit({ now: true });
        }, { placeholder: '视频平台', aria: '分组标题' })));

      card.appendChild(field('分组副标题', '可选',
        inputText(g.subtitle, function (v) { g.subtitle = v; commit({ now: true }); }, { placeholder: '熟肉与教程的主要发布地', aria: '分组副标题' })));

      g.links.forEach(function (link) {
        card.appendChild(linkCard(g, link, rebuild));
      });

      card.appendChild(btn('＋ 添加链接', 'btn--outlined', function () {
        g.links.push({ label: '新链接', desc: '', url: '', copy: '', icon: '', iconUrl: '', color: '', sameTab: false, featured: false });
        rebuild();
        commit({ now: true });
      }, 'ed-add'));

      sec.appendChild(card);
    });

    sec.appendChild(h('div', { class: 'ed-actions-row' }, [
      btn('＋ 添加分组', 'btn--filled', function () {
        data.groups.push({ title: '新分组', subtitle: '', links: [] });
        rebuild();
        commit({ now: true });
      })
    ]));

    return sec;
  }

  /* —— 导出 —— */
  function buildCode() {
    var sec = section('code', '导出 data.js',
      '把下面这段存成 <code>data.js</code> 覆盖站点里的同名文件即可生效；' +
      '也可以直接点「导出文件」下载。文本框可编辑，改完点「应用到表单」会解析回来。');

    var ta = h('textarea', { class: 'ed-input ed-textarea ed-code-area', spellcheck: 'false', 'aria-label': '生成的 data.js' });
    var issues = h('ul', { class: 'ed-issues' });

    sec.appendChild(field('生成的 data.js', '', ta));
    sec.appendChild(h('div', { class: 'ed-actions-row' }, [
      btn('复制', 'btn--tonal', function () { copyText(ta.value, '已复制 data.js'); }),
      btn('应用到表单', 'btn--outlined', applyCode),
      btn('重新生成', 'btn--outlined', refreshCode),
      btn('导出文件', 'btn--filled', download)
    ]));
    sec.appendChild(subhead('配置检查', '导出前顺手体检一遍，红色是不建议带着上线的问题。'));
    sec.appendChild(issues);

    codeEls = { ta: ta, issues: issues };
    refreshCode();
    return sec;
  }

  function refreshCode() {
    if (!codeEls) return;
    codeEls.ta.value = serialize();
    codeEls.issues.innerHTML = '';
    issuesOf().forEach(function (it) {
      codeEls.issues.appendChild(h('li', { class: it.level === 'ok' ? 'is-ok' : 'is-warn', text: it.text }));
    });
  }

  function applyCode() {
    if (!codeEls) return;
    try {
      var parsed = parseDataJs(codeEls.ta.value);
      data = normalize(parsed);
      rebuildAll();
      commit({ now: true });
      toast('已按文本框内容更新配置');
    } catch (err) {
      toast('解析失败：' + err.message);
    }
  }

  function parseDataJs(code) {
    var text = String(code || '').trim();
    if (!text) throw new Error('内容为空');
    if (text.charAt(0) === '{') {
      try {
        var j = JSON.parse(text);
        if (j && typeof j === 'object') return j;
      } catch (e) { /* 继续按 JS 解析 */ }
    }
    var box = {};
    try {
      new Function('window', text + '\n;return window.SITE_DATA;')(box);
    } catch (e) {
      throw new Error(e.message);
    }
    if (!box.SITE_DATA || typeof box.SITE_DATA !== 'object') throw new Error('文件里没有找到 window.SITE_DATA');
    return box.SITE_DATA;
  }

  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || '已复制'); };
    var fail = function () { toast('复制失败，请手动选择文本复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        legacyCopy(text) ? done() : fail();
      });
    } else {
      legacyCopy(text) ? done() : fail();
    }
  }

  function legacyCopy(text) {
    try {
      var ta = h('textarea', {});
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function download() {
    var text = serialize();
    var url = URL.createObjectURL(new Blob([text], { type: 'text/javascript;charset=utf-8' }));
    var a = h('a', { href: url, download: 'data.js' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    setDirty(false);
    clearDraft();
    if (activeTab === 'code') refreshCode();
    toast('已导出 data.js（覆盖站点里的同名文件即可生效）');
  }

  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        data = normalize(parseDataJs(reader.result));
        rebuildAll();
        setDirty(true);
        saveDraft();
        syncBarAvatar();
        renderPreview(true);
        toast('已导入 ' + file.name + '（点「导出数据.js」才会写回文件）');
      } catch (err) {
        toast('导入失败：' + err.message);
      }
    };
    reader.onerror = function () { toast('读取文件失败'); };
    reader.readAsText(file, 'utf-8');
  }

  /* ══════════════════════════════ 10. 装配与交互 ══════════════════════════════ */

  function mountSection(tab, el) {
    var form = $('#edForm');
    var old = sections[tab];
    if (old && old.parentNode) old.parentNode.replaceChild(el, old);
    else form.appendChild(el);
    sections[tab] = el;
    el.hidden = tab !== activeTab;
  }

  function rebuildAll() {
    mountSection('basic', buildBasic());
    mountSection('theme', buildTheme());
    mountSection('bg', buildBg());
    mountSection('links', buildLinks());
    mountSection('code', buildCode());
    syncBarAvatar();
  }

  function setTab(tab) {
    activeTab = tab;
    $$('.ed-tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    Object.keys(sections).forEach(function (k) { sections[k].hidden = k !== tab; });
    if (tab === 'code') refreshCode();
  }

  function setDevice(device) {
    $$('#edDevice .ed-seg__btn').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.device === device);
    });
    var wrap = $('#edFrameWrap');
    if (wrap) wrap.dataset.device = device;
  }

  function setMobileView(view) {
    document.body.classList.toggle('ed-view-preview', view === 'preview');
    $$('#edMobileToggle .ed-seg__btn').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.view === view);
    });
    if (view === 'preview' && pendingPreview) renderPreview(true);
  }

  function resetAll() {
    data = clone(original);
    clearDraft();
    rebuildAll();
    setDirty(false);
    renderPreview(true);
    toast('已放弃改动，恢复为 data.js 里的配置');
  }

  function wire() {
    /* 标签页 */
    $$('.ed-tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.dataset.tab); });
    });

    /* 顶部与底部按钮 */
    var btnTheme = $('#btnTheme');
    if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

    var btnImport = $('#btnImport');
    var fileImport = $('#fileImport');
    if (btnImport && fileImport) {
      btnImport.addEventListener('click', function () { fileImport.click(); });
      fileImport.addEventListener('change', function () {
        importFile(fileImport.files && fileImport.files[0]);
        fileImport.value = '';
      });
    }

    ['#btnDownload', '#btnDownloadTop'].forEach(function (sel) {
      var b = $(sel);
      if (b) b.addEventListener('click', download);
    });

    var btnReset = $('#btnReset');
    if (btnReset) btnReset.addEventListener('click', resetAll);

    var btnRefresh = $('#btnRefresh');
    if (btnRefresh) btnRefresh.addEventListener('click', function () {
      renderPreview(true);
      toast(pendingPreview ? '已刷新预览（含之前挂起的改动）' : '已刷新预览');
    });

    var btnOpen = $('#btnOpenPreview');
    if (btnOpen) btnOpen.addEventListener('click', openPreviewTab);

    /* 预览尺寸 */
    $$('#edDevice .ed-seg__btn').forEach(function (b) {
      b.addEventListener('click', function () { setDevice(b.dataset.device); });
    });

    /* 自动刷新开关 */
    var auto = $('#chkAuto');
    if (auto) auto.addEventListener('change', function () {
      if (auto.checked) {
        renderPreview(true);
        if (pendingPreview) toast('已补上挂起的改动');
      } else {
        toast('已关闭自动刷新，点「刷新」才会更新预览');
      }
    });

    /* 移动端编辑 / 预览切换 */
    $$('#edMobileToggle .ed-seg__btn').forEach(function (b) {
      b.addEventListener('click', function () { setMobileView(b.dataset.view); });
    });

    /* 快捷键：Ctrl/Cmd + S 导出 */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
        e.preventDefault();
        download();
      }
    });

    /* 有未导出的改动时提醒一下 */
    window.addEventListener('beforeunload', function (e) {
      if (!$('#edDirty') || $('#edDirty').hidden) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    });
  }

  /* ══════════════════════════════ 11. 启动 ══════════════════════════════ */

  function boot() {
    var seed = window.SITE_DATA;
    original = normalize(seed && typeof seed === 'object' ? seed : {});
    data = clone(original);

    var restored = false;
    try {
      var draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        var parsed = JSON.parse(draft);
        if (parsed && typeof parsed === 'object' && JSON.stringify(parsed) !== JSON.stringify(original)) {
          data = normalize(parsed);
          restored = true;
        }
      }
    } catch (e) { /* 草稿坏了就当没有 */ }

    rebuildAll();
    wire();
    watchAppBar();
    syncBarAvatar();

    if (!seed) toast('没读到 data.js（window.SITE_DATA 为空），已从空白配置开始');
    if (restored) {
      setDirty(true);
      toast('已恢复上次未导出的草稿（点「放弃改动」可还原）');
    }

    renderPreview(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 方便调试：控制台里可拿到当前编辑状态 */
  window.__editor = {
    get data() { return data; },
    get original() { return original; },
    serialize: function () { return serialize(); },
    issues: function () { return issuesOf(); },
    refresh: function () { renderPreview(true); }
  };
})();

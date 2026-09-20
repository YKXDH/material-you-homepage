/* ============================================================================
 * data.js —— 全站唯一需要你手动编辑的文件
 * ----------------------------------------------------------------------------
 * 改完保存、刷新页面即可生效，不需要任何构建步骤。
 * 所有文本都支持中文 / emoji；所有 url 记得写完整（含 https://）。
 *
 * 注意：本文件是**示例数据**（占位内容），请照着你自己的情况逐项替换。
 * ==========================================================================*/

window.SITE_DATA = {

  /* ─────────────────────────────────────────────────────────────────────
   * 1) 个人信息区
   * ─────────────────────────────────────────────────────────────────── */
  profile: {
    name: '你的名字',                        // 主标题（大字）
    handle: '@your_id',                     // 副标题（小字，可留空 ''）
    avatar: 'avatar.webp',                  // 头像路径：换成 avatar.jpg 或图片直链都行
    tagline: '一句话签名',                   // 一句话签名（可留空 ''）
    // 简介：换行用两个字符的反斜杠 + n（JS 换行转义）；想强调某段文字，
    // 用 **两个星号** 包起来就会渲染成高亮色块
    bio: '这里是自我介绍示例。你可以写多行内容，想强调某段文字就用 **两个星号** 包起来。',
    location: '中国 · 某地',                 // 位置（可留空 ''）
    chips: [],                              // 名字下面的小标签，不需要就写 []
    email: '',                              // 想显示邮箱按钮就填，否则留空 ''
    footer: '',                             // 页脚自定义文字；留空则自动生成
    copyright: ''                           // 版权行；留空则不显示
  },

  /* ─────────────────────────────────────────────────────────────────────
   * 2) 主题 / 动态取色
   * ─────────────────────────────────────────────────────────────────── */
  theme: {
    // 取色来源：
    //   'background' = 跟随当前背景图（推荐：背景每换一张，整套配色跟着变）
    //   'avatar'     = 跟随头像
    //   'none'       = 不取色，固定用下面的 fallbackSeed
    extractFrom: 'background',
    // 从上一步取色的结果里，可以手动"偏转"色相（单位：度，0 = 不偏转）
    hueShift: 0,
    // 取色失败 / 关闭自动取色时使用的种子色（Material 3 官方基准紫）
    fallbackSeed: '#6750A4',
    // 初始深浅色模式：'auto'（跟随系统）| 'light' | 'dark'
    mode: 'auto'
  },

  /* ─────────────────────────────────────────────────────────────────────
   * 3) 背景图轮播
   *    把图片放进 backgrounds/ 目录，按顺序列在这里即可。
   *    图片建议长边 1600~2000px（webp / jpg），单张控制在 300KB 以内；
   *    背景本身是模糊的，所以分辨率不需要太高，体积小一点加载更顺。
   * ─────────────────────────────────────────────────────────────────── */
  background: {
    images: [
      'backgrounds/bg-01.webp',
      'backgrounds/bg-02.webp',
      'backgrounds/bg-03.webp',
      'backgrounds/bg-04.webp',
      'backgrounds/bg-05.webp',
      'backgrounds/bg-06.webp',
      'backgrounds/bg-07.webp',
      'backgrounds/bg-08.webp',
      'backgrounds/bg-09.webp'
    ],
    /* 自动识别新增的背景图（加了新图不用回来改上面的 images）
     * 纯静态站（Cloudflare Pages / GitHub Pages…）没有「列目录」这种能力，
     * 浏览器也没法问服务器「这个文件夹里都有什么文件」，所以只能按**命名约定**探测：
     * 把 pattern 里的 {n} 依次换成序号去试着加载，能加载出来就说明这张图存在。
     * 一旦连续 missLimit 个序号都探测不到就停止（不会把 1~60 全试一遍白费流量）。
     * 探测到的图会自动追加进轮播列表，排在 images 里显式列出的那几张之后。 */
    autoScan: {
      enabled: true,
      // {n} = 1、2、3…（不补零）；{n2} = 01、02…；{n3} = 001、002…
      pattern: 'backgrounds/bg-{n2}.webp',
      from: 1,             // 从几号开始探
      to: 60,              // 探到几号为止（上限，正常早就因连续未命中而停了）
      missLimit: 2,        // 连续几个序号都探测不到就收工
      exclude: []          // 想跳过哪几张：写序号或完整地址，例如 [4, 'backgrounds/bg-07.webp']
    },
    interval: 5,          // 几秒换一张（最小 1 秒）
    blur: 2,             // 毛玻璃模糊强度（px）；0 = 不模糊，数字越大越朦胧
    veil: 0.50,           // 背景上盖一层主题色遮罩的浓度（0~1）；越大内容越清晰、背景越淡
    followColor: true,    // 是否让整套配色跟着当前背景图走（"网页自动取背景色"）
    // 缩放方式：
    //   'cover'   = 默认。等比放大到「刚好填满整个页面」，多出来的部分裁掉（不会留白）
    //   'contain' = 完整显示整张图（不裁切），四周留白用同一张图的模糊放大版填上
    //   'auto'    = 先算用 cover 会裁掉多少画面，裁得太多（超过 cropLimit）才改用 contain
    fit: 'cover',
    // 只在 'auto' 下生效：用 cover 时最多容忍裁掉多少画面（0~1），超过就改成完整显示
    cropLimit: 0.35,
    // 只在 'contain' 下生效：四周留白填充层的模糊强度（px）；越大越柔和
    fillBlur: 36,
    loop: true,          // false = 依次播完最后一张就停住；true = 播完再从第一张循环
    paused: false         // true = 只显示第一张，不自动轮播
  },

  /* ─────────────────────────────────────────────────────────────────────
   * 4) 链接分组
   *    每组: { title, subtitle?, links: [...] }
   *    单个链接:
   *      label   必填  按钮主文字
   *      desc    可选  按钮副文字（一句话说明）
   *      url     必填  跳转地址
   *      copy    可选  没有可跳转地址时用它：卡片变成「点击复制」，点了就把这个字符串复制到剪贴板
   *                    （例如 QQ 号：copy: '123456789'）
   *      icon    可选  simple-icons 的图标名，如 'github'、'bilibili'
   *                    （图标名可在 https://simpleicons.org 查询）
   *      iconUrl 可选  直接用一张图片当图标（优先级高于 icon）
   *      color   可选  图标颜色；不填则跟随主题主色；'brand' 表示使用品牌原色
   *      sameTab 可选  true = 当前标签页打开（默认新标签页打开）
   *      featured 可选 true = 显示为醒目的大卡片
   *
   *    想加新分组：复制下面 { ... } 那一段，粘在它后面，改内容即可。
   *    不要的分组：整段删掉，不要留空壳。
   * ─────────────────────────────────────────────────────────────────── */
  groups: [
    {
      title: '视频平台',
      subtitle: '视频与教程的发布地',
      links: [
        { label: 'Bilibili', desc: '', url: 'https://www.bilibili.com/',       icon: 'bilibili' },
        { label: '抖音',     desc: '', url: 'https://www.douyin.com/',         icon: 'douyin' },
        { label: '快手',     desc: '', url: 'https://www.kuaishou.com/',       icon: 'kuaishou' },
        { label: '小红书',   desc: '', url: 'https://www.xiaohongshu.com/',    icon: 'xiaohongshu' }
      ]
    },
    {
      title: '社交媒体',
      subtitle: '日常动态、社群与代码',
      links: [
        { label: 'X (Twitter)', desc: '碎碎念',       url: 'https://x.com/your_id',        icon: 'x' },
        { label: 'Telegram',    desc: '聊天与频道',   url: 'https://t.me/your_id',          icon: 'telegram' },
        { label: 'GitHub',      desc: '代码与开源项目', url: 'https://github.com/your_id',  icon: 'github' }
      ]
    },
    {
      title: '联系方式',
      subtitle: '',
      links: [
        { label: '电子邮箱', desc: 'you@example.com', url: 'mailto:you@example.com', icon: 'gmail', sameTab: true },
        { label: 'QQ',       desc: '123456789 · 点击复制', copy: '123456789',         icon: 'qq' }
      ]
    },
    {
      title: '个人站点',
      subtitle: '自己搭的地方',
      links: [
        { label: '个人博客', desc: '长文与技术笔记', url: 'https://example.com', icon: 'rss', featured: true }
      ]
    }
  ]
};

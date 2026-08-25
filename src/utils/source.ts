// 推广来源解析（utm_source + referer 兜底）
//
// 设计动机：
//   用户在多个平台（Google / Baidu / 微博 / 微信公众号 ...）投放工具链接，
//   需要在后台看出每个工具的访问来自哪个渠道，衡量各渠道引流效果。
//
// 解析优先级：
//   1. URL 查询参数 utm_source（标准 UTM，可识别具体活动 / 关键词）
//   2. document.referrer 域名命中内置指纹库（搜索引擎 / 社交 / 开发者社区）
//   3. 都没有 → 'direct'
//
// 首次解析后会写入 sessionStorage 锁定，站内跳转不再重新识别。
//   这样「从 Google 进来 → 点开九宫格 → 再点开图片切割」三条记录都归属 google。
//
// 来源标识（短横线和小写字母，便于 URL 参数、SQL 存储和后台筛选）：
//   - 'direct'           无 referer / referer 不可识别
//   - 搜索引擎：google / baidu / bing / sogou / so360 / duckduckgo
//   - 社交媒体：wechat / weibo / zhihu / xiaohongshu / douyin / x / facebook
//   - 开发者社区：csdn / juejin / v2ex / segmentfault / sspai
//   - 其他 utm_source 值会原样规范化（trim / 小写）后写入，作为自定义渠道
//
// 后端长度过滤：me/tool-usage.js 限制 source ≤ 64 字符，仅允许 [a-z0-9_-]。

/** 来源在后台的中文展示名（用户自定义渠道直接展示原文） */
export const SOURCE_LABELS: Record<string, string> = {
  direct: '直接访问',
  google: 'Google',
  baidu: '百度',
  bing: 'Bing',
  sogou: '搜狗',
  so360: '360 搜索',
  duckduckgo: 'DuckDuckGo',
  wechat: '微信',
  weibo: '微博',
  zhihu: '知乎',
  xiaohongshu: '小红书',
  douyin: '抖音',
  x: 'X (Twitter)',
  facebook: 'Facebook',
  csdn: 'CSDN',
  juejin: '掘金',
  v2ex: 'V2EX',
  segmentfault: 'SegmentFault',
  sspai: '少数派',
}

/**
 * referrer 域名 → 来源标识。
 *
 * 顺序敏感：先匹配更具体的（如 mp.weixin.qq.com 必须在 weixin.qq.com 之前）。
 * 注意：hostname 不含端口与协议，匹配时忽略大小写。
 */
const REFERRER_RULES: Array<[RegExp, string]> = [
  // 微信公众号（中转页 mp.weixin.qq.com 是主要来源）
  [/^mp\.weixin\.qq\.com$/, 'wechat'],
  [/^(?:www\.)?weixin\.qq\.com$/, 'wechat'],
  // 小红书短链
  [/^xhslink\.com$/, 'xiaohongshu'],
  [/^(?:www\.)?xiaohongshu\.com$/, 'xiaohongshu'],
  // X / Twitter（x.com 是新主域，twitter.com 保留兼容）
  [/^(?:www\.)?x\.com$/, 'x'],
  [/^(?:www\.)?twitter\.com$/, 'x'],
  // Facebook（含短链 fb.me / fb.com）
  [/^(?:www\.)?facebook\.com$/, 'facebook'],
  [/^(?:www\.)?fb\.com$/, 'facebook'],
  [/^fb\.me$/, 'facebook'],
  // 360 搜索
  [/^(?:www\.)?so\.com$/, 'so360'],
  // 搜狗
  [/^(?:www\.)?sogou\.com$/, 'sogou'],
  // DuckDuckGo
  [/^(?:www\.)?duckduckgo\.com$/, 'duckduckgo'],
  // Bing
  [/^(?:www\.)?bing\.com$/, 'bing'],
  // Google（覆盖所有 google.* 子域：google.com / google.com.hk / google.co.jp ...）
  [/^(?:[\w-]+\.)?google\.[a-z.]+$/, 'google'],
  // 百度
  [/^(?:www\.)?baidu\.com$/, 'baidu'],
  // 微博
  [/^(?:www\.)?weibo\.com$/, 'weibo'],
  [/^(?:www\.)?weibo\.cn$/, 'weibo'],
  // 知乎
  [/^(?:www\.)?zhihu\.com$/, 'zhihu'],
  // 抖音
  [/^(?:www\.)?douyin\.com$/, 'douyin'],
  // 开发者社区
  [/^(?:[\w-]+\.)?csdn\.net$/, 'csdn'],
  [/^(?:www\.)?juejin\.cn$/, 'juejin'],
  [/^(?:www\.)?v2ex\.com$/, 'v2ex'],
  [/^(?:www\.)?segmentfault\.com$/, 'segmentfault'],
  [/^(?:www\.)?sspai\.com$/, 'sspai'],
]

/** sessionStorage key：用于在首次访问时锁定来源，站内跳转保持稳定 */
const SOURCE_LOCK_KEY = 'tu_source'

/**
 * 规范化任意来源字符串：
 *   - trim + 转小写
 *   - 仅保留 [a-z0-9_-]，其余字符替换为 '_'（避免 SQL 注入与显示问题）
 *   - 限制最大长度 64（与后端限制一致，避免超长自定义渠道污染数据库）
 *   - 空字符串视为无效
 */
export function normalizeSource(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 64)
  return cleaned || null
}

/**
 * 从 URL 中提取 utm_source / utm 参数。
 * 同时支持 ?utm_source=google 和 ?utm=google（短形式，便于推广链接更短）。
 */
function extractUtmFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    return normalizeSource(params.get('utm_source') || params.get('utm'))
  } catch {
    return null
  }
}

/**
 * 从 document.referrer 提取来源。
 * 取 referrer 的 hostname，过站内置指纹库。
 * 同站跳转（hostname === location.hostname）视为站内来源，不计入推广渠道。
 */
function extractFromReferrer(): string | null {
  if (typeof document === 'undefined') return null
  const ref = document.referrer
  if (!ref) return null
  try {
    const url = new URL(ref)
    const host = url.hostname.toLowerCase()
    if (!host) return null
    // 同站跳转：站内浏览不应被算作外部推广来源
    if (window.location.hostname && host === window.location.hostname.toLowerCase()) {
      return null
    }
    for (const [pattern, source] of REFERRER_RULES) {
      if (pattern.test(host)) return source
    }
    return null
  } catch {
    // 非合法 URL（如 about:blank、data:、某些 app 内嵌）
    return null
  }
}

/**
 * 解析当前访问的推广来源。
 * 首次访问时锁定到 sessionStorage（'tu_source'），后续同会话内复用。
 *
 * 锁定策略：
 *   - 已锁定（sessionStorage 存在）→ 直接返回锁定值，referrer 与 utm 参数都不再覆盖
 *   - 未锁定 → 按 utm_source → referrer 指纹 → 'direct' 顺序解析，解析成功后写入
 *
 * 注意：
 *   - 同站跳转不应覆盖已锁定来源（referrer 会被同站解析返回 null，自然不会覆盖）
 *   - 隐私模式下 sessionStorage 可能抛错，外层 try/catch 兜底
 */
export function detectSource(): string {
  const FALLBACK = 'direct'
  if (typeof window === 'undefined') return FALLBACK
  try {
    const locked = sessionStorage.getItem(SOURCE_LOCK_KEY)
    if (locked) return locked
    const detected = extractUtmFromUrl() || extractFromReferrer() || FALLBACK
    sessionStorage.setItem(SOURCE_LOCK_KEY, detected)
    return detected
  } catch {
    return FALLBACK
  }
}

/**
 * 获取来源的中文展示名（用于后台 UI）。
 * 用户自定义渠道（未在 SOURCE_LABELS 中）直接展示原文。
 */
export function getSourceLabel(source: string | null | undefined): string {
  if (!source) return '-'
  return SOURCE_LABELS[source] || source
}

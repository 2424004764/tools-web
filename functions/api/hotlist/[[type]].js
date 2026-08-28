// 首页热门信息聚合端点
// GET /api/hotlist              -> 返回所有源（合并概览）
// GET /api/hotlist/:type        -> 返回单个源
//
// 支持的 type: toutiao | sspai | github | hn
//
// 数据源历史：
//   v1 用过 vvhan 聚合 API，但当时该域名在 Worker 网络下频繁超时/失败。
//   v2 改为各平台官方/可靠公开 API。
//
// 设计要点：
// 1. 所有第三方源在 Worker 内 fetch，统一加 CORS 头，前端无需处理跨域。
// 2. Cloudflare Cache API 兜底缓存 10 分钟（max-age=600），抗突发 + 减少上游压力。
// 3. 单源失败不影响其他源，失败项返回空数组 + error 字段。
// 4. 返回统一数据结构 { items: [{title, url, hot}] }，前端只需关心一份 schema。

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// 数据源定义。fetcher 必须返回 { items: [{title, url, hot?}] }。
// 新增源只需往这里加一项，无需改动其他代码。
import { readCache, readAllCache, upsertCache } from './_cache.js'
const SOURCES = {
  toutiao: { title: '头条热榜', fetcher: fetchToutiao },
  sspai: { title: '少数派', fetcher: fetchSspai },
  github: { title: 'GitHub Trending', fetcher: fetchGithub },
  hn: { title: 'Hacker News', fetcher: fetchHackerNews },
}

const COMMON_HEADERS = {
  // 上游多为对 UA 敏感的网页接口；用常见桌面浏览器 UA，避免被默认 fetch UA 拒绝。
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

// 统一的 fetch 包装：加超时（默认 10s）+ 详细错误。
// 不传 cf 字段，由响应头 Cache-Control 控制缓存策略，避免 Pages Functions 上 cf 行为差异。
async function safeFetch(url, options = {}, timeoutMs = 10000) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...options, signal: ctl.signal })
    return resp
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`fetch timeout after ${timeoutMs}ms: ${url}`)
    }
    throw new Error(`fetch failed: ${err?.message || err} (${url})`)
  } finally {
    clearTimeout(timer)
  }
}

// ---------- 头条热榜 ----------
// https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc
// 字段：Title / Url / HotValue(数字)
async function fetchToutiao() {
  const resp = await safeFetch(
    'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc',
    { headers: COMMON_HEADERS },
  )
  if (!resp.ok) throw new Error(`toutiao ${resp.status}`)
  const json = await resp.json()
  const list = Array.isArray(json?.data) ? json.data : []
  return {
    items: list.slice(0, 20).map((it) => ({
      title: it.Title || '',
      url: it.Url || '',
      hot: formatHotNumber(it.HotValue),
    })),
  }
}

function formatHotNumber(n) {
  const num = Number(n)
  if (!Number.isFinite(num) || num <= 0) return ''
  if (num >= 100_000_000) return `${(num / 100_000_000).toFixed(1)}亿`
  if (num >= 10_000) return `${(num / 10_000).toFixed(1)}万`
  return String(num)
}

// ---------- 少数派（sspai）----------
// https://sspai.com/api/v1/articles?offset=0&limit=20
// 字段：title / id / summary
async function fetchSspai() {
  const resp = await safeFetch(
    'https://sspai.com/api/v1/articles?offset=0&limit=20',
    { headers: COMMON_HEADERS },
  )
  if (!resp.ok) throw new Error(`sspai ${resp.status}`)
  const json = await resp.json()
  const list = Array.isArray(json?.list) ? json.list : []
  return {
    items: list.slice(0, 20).map((it) => ({
      title: it.title || '',
      url: `https://sspai.com/post/${it.id}`,
      hot: it.words_count ? `${it.words_count} 字` : '',
    })),
  }
}

// ---------- GitHub Trending（按 stars 排序替代）----------
// GitHub Trending 页面是纯客户端渲染，HTML 抓不到完整列表。
// 用 search API 按 stars 降序取近 7 天创建的 repo 作为"新热"代理。
// 公共 API，无需 token（限速 60/h，未登录 IP），加 Worker Cache 完全够用。
async function fetchGithub() {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const url =
    `https://api.github.com/search/repositories` +
    `?q=created:>${since}&sort=stars&order=desc&per_page=20`
  const resp = await safeFetch(url, {
    headers: {
      ...COMMON_HEADERS,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!resp.ok) throw new Error(`github ${resp.status}`)
  const json = await resp.json()
  const list = Array.isArray(json?.items) ? json.items : []
  return {
    items: list.map((it) => ({
      title: `${it.full_name} — ${it.description || ''}`.trim(),
      url: it.html_url,
      hot: `⭐ ${formatHotNumber(it.stargazers_count)}`,
    })),
  }
}

// ---------- Hacker News ----------
// 官方 Firebase API，配套 CORS，可以前端直调；这里走 Worker 统一缓存。
async function fetchHackerNews() {
  const idsResp = await safeFetch(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
    {},
  )
  if (!idsResp.ok) throw new Error(`hn ids ${idsResp.status}`)
  const ids = (await idsResp.json()).slice(0, 20)
  const details = await Promise.all(
    ids.map((id) =>
      safeFetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {})
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ),
  )
  return {
    items: details
      .filter((d) => d && d.title && d.url)
      .map((d) => ({
        title: d.title,
        url: d.url,
        hot: `${d.score ?? 0} 分`,
      })),
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      ...corsHeaders,
      ...extraHeaders,
    },
  })
}

async function fetchSource(type) {
  const def = SOURCES[type]
  if (!def) return null
  const start = Date.now()
  try {
    const { items } = await def.fetcher()
    return {
      type,
      title: def.title,
      updateTime: new Date().toISOString(),
      items,
      costMs: Date.now() - start,
    }
  } catch (err) {
    console.error(`[hotlist] ${type} fetch failed:`, err?.message || err)
    return {
      type,
      title: def.title,
      updateTime: new Date().toISOString(),
      items: [],
      error: err?.message || 'fetch failed',
      costMs: Date.now() - start,
    }
  }
}

async function handleSingle(context, type, cacheKey) {
  const edge = caches.default

  // L1: Edge Cache
  const edgeHit = await edge.match(cacheKey)
  if (edgeHit) {
    return new Response(await edgeHit.clone().text(), {
      status: edgeHit.status,
      headers: {
        ...Object.fromEntries(edgeHit.headers.entries()),
        'X-Cache': 'HIT-EDGE',
      },
    })
  }

  const def = SOURCES[type]
  if (!def) {
    return json(
      {
        error: `unknown type: ${type}`,
        supported: Object.keys(SOURCES),
      },
      400,
    )
  }

  const db = context.env?.DB

  // L2: D1
  const { state, data: cached } = await readCache(db, type)

  // fresh 或 stale：直接返回缓存 + 后台刷新
  if (cached && state !== 'miss') {
    if (context?.waitUntil) {
      context.waitUntil(refreshAndCache(db, edge, cacheKey, type))
    }
    return json(cached, 200, { 'X-Cache': `HIT-D1-${state.toUpperCase()}` })
  }

  // L3: D1 miss，必须同步拉上游（保证用户能看到数据）
  const fresh = await fetchSource(type)
  const resp = json(fresh)
  if (resp.status === 200 && !fresh.error) {
    // 写 L2（D1）+ L1（Edge），都通过 waitUntil 不阻塞响应
    // ⚠️ 必须在 return 之前 clone：Response body 是一次性 ReadableStream，
    // return 后 CF runtime 立刻开始读取并锁定 stream，再 clone 就报
    // "ReadableStream is currently locked to a reader"。
    // 把 resp.clone() 提前到分支顶部，作为 cacheResp 独立用于缓存写入，
    // 原始 resp 只用于 return 给客户端。
    const cacheResp = resp.clone()
    if (context?.waitUntil) {
      context.waitUntil(
        (async () => {
          await upsertCache(db, type, fresh)
          await edge.put(cacheKey, cacheResp)
        })(),
      )
    } else {
      upsertCache(db, type, fresh).catch(() => {})
      edge.put(cacheKey, cacheResp).catch(() => {})
    }
  }
  return resp
}

// 后台刷新：拉上游 → 成功则更新 D1 + Edge；失败保持旧缓存。
async function refreshAndCache(db, edge, cacheKey, type) {
  try {
    const fresh = await fetchSource(type)
    if (!fresh.error) {
      await upsertCache(db, type, fresh)
      const resp = json(fresh)
      await edge.put(cacheKey, resp)
    }
  } catch (err) {
    console.error(`[hotlist] background refresh ${type} failed:`, err?.message || err)
  }
}

async function handleAll(context) {
  const db = context?.env?.DB
  const types = Object.keys(SOURCES)
  const cacheMap = await readAllCache(db, types)

  const results = []
  const needSyncFetch = []
  for (const type of types) {
    const c = cacheMap[type]
    if (c.data) {
      // 有缓存：fresh 直接用，stale 用旧值并后台刷新
      results.push(c.data)
      if (c.state === 'stale') needSyncFetch.push(type)
    } else {
      // miss：标记需要同步拉
      needSyncFetch.push(type)
    }
  }

  // 同步补齐 miss/stale 的源
  if (needSyncFetch.length > 0) {
    const fetched = await Promise.all(needSyncFetch.map((t) => fetchSource(t)))
    const cacheKey = new Request(new URL(context.request.url).toString(), { method: 'GET' })
    for (let i = 0; i < needSyncFetch.length; i++) {
      const type = needSyncFetch[i]
      const data = fetched[i]
      // 替换 results 中对应位置的项（如果有 stale 占位）
      const idx = results.findIndex((r) => r?.type === type)
      if (idx >= 0) results[idx] = data
      else results.push(data)
      // 写入缓存（仅成功项）
      if (!data.error) {
        upsertCache(db, type, data).catch(() => {})
      }
    }
  }

  const resp = json({
    updateTime: new Date().toISOString(),
    sources: results,
  })
  return resp
}

export async function onRequest(context) {
  const { request } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return json({ error: 'method not allowed' }, 405)
  }

  const url = new URL(request.url)
  const type = url.pathname.replace(/^\/api\/hotlist\/?/, '').replace(/\/$/, '')

  try {
    if (!type) {
      return handleAll(context)
    }
    const cacheKey = new Request(url.toString(), { method: 'GET' })
    return await handleSingle(context, type, cacheKey)
  } catch (err) {
    console.error('[hotlist] handler error:', err)
    return json({ error: 'internal error', message: err?.message }, 500)
  }
}
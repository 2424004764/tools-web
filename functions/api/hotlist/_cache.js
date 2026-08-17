// hotlist D1 缓存工具
//
// 三级缓存策略：
//   L1: Cloudflare Edge Cache（caches.default，10 min）—— 在 [[type]].js 中处理
//   L2: D1 hotlist_cache 表（本模块）
//   L3: 上游 fetch
//
// 读取流程：
//   readFresh(db, source, now)
//     ├─ 返回 { state: 'fresh'|'stale'|'miss', data }
//     └─ caller 据此决定：fresh 直接返回 / stale 返回 + 后台刷新 / miss 同步上游
//
// 写入：仅在 fetchSource 成功时调用 upsert，避免污染缓存。

const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 分钟

/**
 * 读取单个源的缓存状态。
 * @param {D1Database} db - D1 binding
 * @param {string} source - 数据源 key
 * @returns {Promise<{state: 'fresh'|'stale'|'miss', data: object|null}>}
 */
export async function readCache(db, source, now = Date.now()) {
  if (!db) return { state: 'miss', data: null }
  try {
    const row = await db
      .prepare('SELECT data, expires_at FROM hotlist_cache WHERE source = ?1')
      .bind(source)
      .first()
    if (!row) return { state: 'miss', data: null }
    let data
    try {
      data = JSON.parse(row.data)
    } catch {
      // JSON 损坏等同于 miss，触发重新拉取并覆盖
      return { state: 'miss', data: null }
    }
    const state = row.expires_at > now ? 'fresh' : 'stale'
    return { state, data }
  } catch (err) {
    console.error(`[hotlist-cache] read ${source} failed:`, err?.message || err)
    return { state: 'miss', data: null }
  }
}

/**
 * 批量读取所有源（用于 handleAll 聚合）。
 * @returns {Promise<Record<string, {state, data}>>}
 */
export async function readAllCache(db, sources, now = Date.now()) {
  if (!db) return Object.fromEntries(sources.map((s) => [s, { state: 'miss', data: null }]))
  try {
    const result = await db
      .prepare(
        'SELECT source, data, expires_at FROM hotlist_cache WHERE source IN (' +
          sources.map(() => '?').join(',') +
          ')',
      )
      .bind(...sources)
      .all()
    const map = Object.fromEntries(sources.map((s) => [s, { state: 'miss', data: null }]))
    for (const row of result.results || []) {
      try {
        const data = JSON.parse(row.data)
        map[row.source] = {
          state: row.expires_at > now ? 'fresh' : 'stale',
          data,
        }
      } catch {
        // skip corrupted
      }
    }
    return map
  } catch (err) {
    console.error('[hotlist-cache] readAll failed:', err?.message || err)
    return Object.fromEntries(sources.map((s) => [s, { state: 'miss', data: null }]))
  }
}

/**
 * upsert 单个源的缓存。TTL 默认 10 min。
 * @param {D1Database} db
 * @param {string} source
 * @param {object} data - 要序列化的完整响应
 * @param {number} ttlMs
 */
export async function upsertCache(db, source, data, ttlMs = DEFAULT_TTL_MS, now = Date.now()) {
  if (!db) return
  const expiresAt = now + ttlMs
  try {
    await db
      .prepare(
        `INSERT INTO hotlist_cache (source, data, fetched_at, expires_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(source) DO UPDATE SET
           data = excluded.data,
           fetched_at = excluded.fetched_at,
           expires_at = excluded.expires_at`,
      )
      .bind(source, JSON.stringify(data), now, expiresAt)
      .run()
  } catch (err) {
    console.error(`[hotlist-cache] upsert ${source} failed:`, err?.message || err)
  }
}

export { DEFAULT_TTL_MS }
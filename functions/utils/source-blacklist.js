// 来源黑名单共享工具：admin 统计 / 明细查询共用
// 表结构见 migrations/106_create_tool_usage_source_blacklist.sql

/**
 * 黑名单过滤 SQL 片段（子查询形式，0 个绑定参数）。
 *
 * 为什么不用 `NOT IN (?, ?, ...)` 逐个绑定来源值：
 *   D1 限制每条查询最多 100 个绑定参数，黑名单超过 ~97 个时
 *   占位符超限直接报 `too many SQL variables`，整页统计/明细崩掉。
 *   黑名单表与记录表同库，子查询既不受参数上限约束，也与库内数据强一致。
 */
export const SOURCE_NOT_IN_BLACKLIST = `COALESCE(source, 'direct') NOT IN (SELECT source FROM tool_usage_source_blacklist)`
export const SOURCE_IN_BLACKLIST = `COALESCE(source, 'direct') IN (SELECT source FROM tool_usage_source_blacklist)`
/** topUsers/topTools 等带 r 别名查询用的版本 */
export const SOURCE_NOT_IN_BLACKLIST_R = `COALESCE(r.source, 'direct') NOT IN (SELECT source FROM tool_usage_source_blacklist)`

/**
 * 加载全部黑名单来源标识（仅用于统计个数与前端展示）。
 * 返回 null 表示表不存在（未执行迁移的旧环境），调用方应跳过过滤；
 * 返回数组表示表可用（可为空数组），调用方可安全使用子查询过滤。
 */
export async function loadSourceBlacklist(db) {
  if (!db) return null
  try {
    const res = await db.prepare('SELECT source FROM tool_usage_source_blacklist').all()
    return (res.results || []).map((r) => r.source)
  } catch {
    return null
  }
}

/**
 * 规范化来源标识（与 me/tool-usage.js 入库口径一致：小写 + 仅 [a-z0-9_-] + ≤64）。
 */
export function normalizeSourceKey(raw) {
  return (
    String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 64) || null
  )
}

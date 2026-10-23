// 用户删除级联清理共享逻辑
// 供 [uid]/index.js（单删）与 batch-delete.js（批删）复用，改动时两处行为保持一致。
//
// 文件名以 _ 开头：Cloudflare Pages Functions 不会将其实例化为路由。

// 级联清理的子表白名单（先删叶子子表，user 行由调用方最后删除）。
// 生产 D1 上部分子表可能尚未建表，直接 DELETE 会因 SQLITE_ERROR 整体失败，
// 因此执行前先查 sqlite_master 过滤存在的表。
// 表名取自本白名单常量，不接受外部输入 → 无 SQL 注入风险。
export const CASCADE_TABLES = [
  'credit_transactions',
  'user_credits',
  'generation_records',
  'credit_redeem_attempts',
  'todos',
  'notes',
  'resumes',
  'companies',
  'qa_pages',
  'password_entries',
  'password_groups',
  'weight_records',
  'weight_members',
  'oss_credentials',
  'mock_schemas',
  'life_trajectories',
  'user_season_scenery',
  'user_favorite_apps',
  'ai_providers',
  'bookmarks',
  'links',
  'letters',
]

// 查询当前库中实际存在的表名集合
export async function fetchExistingTables(db) {
  const result = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
  return new Set((result.results || []).map((r) => r.name))
}

// 构造单个 uid 的级联清理语句（不含 DELETE user，由调用方追加后包进 db.batch 原子执行）。
// credit_redeem_codes 特殊处理：保留记录，仅置空 used_by。
export function buildUserCascadeStatements(db, uid, existingTables) {
  const stmts = []
  const skippedTables = []
  for (const tbl of CASCADE_TABLES) {
    if (!existingTables.has(tbl)) {
      skippedTables.push(tbl)
      continue
    }
    stmts.push(db.prepare(`DELETE FROM ${tbl} WHERE uid = ?`).bind(uid))
  }
  if (existingTables.has('credit_redeem_codes')) {
    stmts.push(
      db.prepare('UPDATE credit_redeem_codes SET used_by = NULL WHERE used_by = ?').bind(uid),
    )
  } else {
    skippedTables.push('credit_redeem_codes')
  }
  return { stmts, skippedTables }
}

// Admin 批量删除用户 API
// POST /api/admin/users/batch-delete
// body: { uids: string[] }
//
// - uids 必填且非空：删除是不可恢复的破坏性操作，不支持「不勾选=全部用户」缺省范围
// - 自动跳过管理员账号与发起人自己（计入 skipped，附原因）
// - 每个 uid 的级联清理语句（与 [uid]/index.js 单删完全一致，见 _delete-cascade.js）
//   包在单独的 db.batch() 里原子执行；D1 不支持跨 uid 事务，单 uid 失败不影响其他
//
// 鉴权已在 _middleware.js 完成（context.data.adminUid 已注入）。

import { fetchExistingTables, buildUserCascadeStatements } from './_delete-cascade.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// 单次批量删除上限（与 credits/batch.js 的显式 uids 上限保持一致）
const BATCH_DELETE_LIMIT = 200

export async function onRequest(context) {
  const { request, env, data } = context
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const body = await request.json().catch(() => ({}))
  const { uids } = body || {}

  // ========== 参数校验 ==========
  if (!Array.isArray(uids) || uids.length === 0) {
    return jsonError('uids 必须是非空数组（批量删除不支持全量模式，请先勾选用户）', 400)
  }
  // 去重 + 类型过滤
  const seen = new Set()
  for (const u of uids) {
    if (typeof u === 'string' && u) seen.add(u)
  }
  const candidates = Array.from(seen)
  if (candidates.length === 0) {
    return jsonError('uids 中没有合法的用户 id', 400)
  }
  if (candidates.length > BATCH_DELETE_LIMIT) {
    return jsonError(
      `单次最多删除 ${BATCH_DELETE_LIMIT} 个用户，当前 ${candidates.length}`,
      400,
    )
  }

  const adminUid = data?.adminUid || null

  try {
    // 1) 一次性取回候选用户，分类出可删除目标
    const placeholders = candidates.map(() => '?').join(',')
    const rowsResult = await db
      .prepare(
        `SELECT id, email, username, is_admin FROM user WHERE id IN (${placeholders})`,
      )
      .bind(...candidates)
      .all()
    const rowMap = new Map((rowsResult.results || []).map((r) => [r.id, r]))

    const skipped = []
    const targets = []
    for (const uid of candidates) {
      const row = rowMap.get(uid)
      if (!row) {
        skipped.push({ uid, email: null, username: null, reason: '用户不存在' })
        continue
      }
      if (uid === adminUid) {
        skipped.push({ uid, email: row.email, username: row.username, reason: '不能删除自己的账号' })
        continue
      }
      if (row.is_admin === 1) {
        skipped.push({ uid, email: row.email, username: row.username, reason: '不能删除管理员账号' })
        continue
      }
      targets.push(row)
    }

    // 2) 逐 uid 级联删除（sqlite_master 只查一次，全部 uid 共用）
    const existingTables = await fetchExistingTables(db)
    const failed = []
    let succeeded = 0

    for (const row of targets) {
      try {
        const { stmts } = buildUserCascadeStatements(db, row.id, existingTables)
        stmts.push(db.prepare('DELETE FROM user WHERE id = ?').bind(row.id))
        await db.batch(stmts)
        succeeded++
        console.log(
          `[admin/users batch-delete] uid=${row.id} email=${row.email} username=${row.username} by adminUid=${adminUid}`,
        )
      } catch (err) {
        failed.push({
          uid: row.id,
          email: row.email,
          username: row.username,
          error: err?.message || '未知错误',
        })
      }
    }

    if (failed.length > 0) {
      console.error(
        `[admin/users batch-delete] ${failed.length} failed by adminUid=${adminUid}:`,
        JSON.stringify(failed),
      )
    }

    return json({
      requested: candidates.length,
      succeeded,
      skipped: skipped.length,
      skipped_detail: skipped,
      failed,
    })
  } catch (error) {
    console.error('admin/users/batch-delete error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

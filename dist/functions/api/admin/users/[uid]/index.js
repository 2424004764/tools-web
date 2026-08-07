// Admin 用户详情 / 更新 / 删除 API
// GET    /api/admin/users/:uid  获取用户详情（含积分、最近积分流水 10 条）
// PUT    /api/admin/users/:uid  更新 username、avatar（不允许改 email/is_admin/is_disabled）
// DELETE /api/admin/users/:uid  永久删除用户 + 级联清理全部子表（不可恢复）
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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

export async function onRequest(context) {
  const { request, env } = context
  const db = env.DB
  const uid = context.params?.uid
  if (!uid) return jsonError('缺少用户 id', 400)

  try {
    if (request.method === 'GET') {
      return await handleGet(db, uid)
    }
    if (request.method === 'PUT') {
      return await handlePut(context, db, uid)
    }
    if (request.method === 'DELETE') {
      return await handleDelete(context, db, uid)
    }
    return jsonError('不支持的请求方法', 405)
  } catch (error) {
    console.error('admin/users/[uid] error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

async function handleGet(db, uid) {
  const user = await db
    .prepare(
      `SELECT id, email, username, avatar, is_admin, is_disabled,
              disabled_reason, disabled_at, third_party_type,
              created_at, last_login
       FROM user WHERE id = ?`,
    )
    .bind(uid)
    .first()
  if (!user) return jsonError('用户不存在', 404)

  // 积分主表
  const credits = await db
    .prepare(
      'SELECT balance, total_earned, total_spent, frozen, remark, created_at, updated_at FROM user_credits WHERE uid = ?',
    )
    .bind(uid)
    .first()

  // 最近 10 条流水
  const recentTx = await db
    .prepare(
      `SELECT id, type, amount, balance_after, reason, source, operator_uid, created_at
       FROM credit_transactions WHERE uid = ?
       ORDER BY created_at DESC LIMIT 10`,
    )
    .bind(uid)
    .all()

  return json({
    user,
    credits: credits || {
      balance: 0,
      total_earned: 0,
      total_spent: 0,
      frozen: 0,
      remark: null,
      created_at: null,
      updated_at: null,
    },
    recentTransactions: recentTx.results || [],
  })
}

async function handlePut(context, db, uid) {
  const body = await context.request.json().catch(() => ({}))
  const { username, avatar } = body

  const sets = []
  const args = []
  if (username !== undefined) {
    if (typeof username !== 'string' || username.length > 64) {
      return jsonError('username 必须是字符串且不超过 64 字符', 400)
    }
    sets.push('username = ?')
    args.push(username)
  }
  if (avatar !== undefined) {
    sets.push('avatar = ?')
    args.push(avatar || null)
  }
  if (sets.length === 0) {
    return jsonError('没有要更新的字段', 400)
  }
  args.push(uid)

  const result = await db
    .prepare(`UPDATE user SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...args)
    .run()

  const changes = result.meta?.changes ?? result.changes ?? 0
  if (changes === 0) return jsonError('用户不存在', 404)
  return json({ updated: changes })
}

// ============ DELETE：永久删除用户 + 级联清理全部子表 ============
// D1 / SQLite 不支持跨语句事务；用 db.batch([...]) 装全部语句，任一失败整体回滚。
// 不使用软删除（项目无 deleted_at 先例），不做 ON DELETE CASCADE 补齐迁移。
// 子表 uid 字段全部无 FOREIGN KEY 约束，因此必须手动清理，否则会留下孤儿行。
async function handleDelete(context, db, uid) {
  const adminUid = context.data?.adminUid

  // 1) 自我保护
  if (uid === adminUid) {
    return jsonError('不能删除自己的账号', 400)
  }

  // 2) 存在性检查
  const existing = await db
    .prepare('SELECT id, email, username, is_admin FROM user WHERE id = ?')
    .bind(uid)
    .first()
  if (!existing) return jsonError('用户不存在', 404)

  // 3) 管理员保护
  if (existing.is_admin === 1) {
    return jsonError('不能删除其他管理员', 400)
  }

  // 4) 级联 SQL：先删叶子子表，最后 DELETE user；credit_redeem_codes.used_by 保留但置空
  // 关键：生产 D1 上部分子表（resumes/notes/companies/qa_pages 等）可能尚未建表，
  // 直接批量 DELETE 会因 SQLITE_ERROR 整体失败。执行前先查 sqlite_master 过滤存在表。
  // 表名取自下方白名单常量，不接受外部输入 → 无 SQL 注入风险。
  const CASCADE_TABLES = [
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

  const tablesResult = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
  const existingTables = new Set((tablesResult.results || []).map((r) => r.name))

  const stmts = []
  const skippedTables = []
  for (const tbl of CASCADE_TABLES) {
    if (!existingTables.has(tbl)) {
      skippedTables.push(tbl)
      continue
    }
    stmts.push(db.prepare(`DELETE FROM ${tbl} WHERE uid = ?`).bind(uid))
  }
  // credit_redeem_codes：保留记录，置空 used_by（独立处理，不走通用分支）
  if (existingTables.has('credit_redeem_codes')) {
    stmts.push(
      db.prepare('UPDATE credit_redeem_codes SET used_by = NULL WHERE used_by = ?').bind(uid),
    )
  } else {
    skippedTables.push('credit_redeem_codes')
  }
  // user 行强制删除（始终存在）
  stmts.push(db.prepare('DELETE FROM user WHERE id = ?').bind(uid))

  // 5) 原子执行（任一失败整体回滚）
  await db.batch(stmts)

  // 6) 审计日志
  console.log(
    `[admin/users DELETE] uid=${uid} email=${existing.email} username=${existing.username} by adminUid=${adminUid}`,
  )
  if (skippedTables.length > 0) {
    console.warn(
      `[admin/users DELETE] skipped non-existent tables: ${skippedTables.join(', ')}`,
    )
  }

  return json({
    id: uid,
    deleted: true,
    email: existing.email,
    username: existing.username,
  })
}
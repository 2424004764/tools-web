// Admin 用户详情 / 更新 API
// GET   /api/admin/users/:uid  获取用户详情（含积分、最近积分流水 10 条）
// PUT   /api/admin/users/:uid  更新 username、avatar（不允许改 email/is_admin/is_disabled）
//
// 鉴权已在 _middleware.js 完成。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
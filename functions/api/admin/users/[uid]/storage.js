// Admin 赠送/扣减用户存储额度 API
// POST /api/admin/users/:uid/storage
// body: { type: 'grant'|'deduct', mb: number, reason?: string }
//
// type=grant:  quota_bytes += mb * 1MB（无额度行则创建，与积分 UPSERT 同策略）
// type=deduct: quota_bytes = MAX(0, quota_bytes - mb * 1MB)
//              允许扣到低于已用（used_bytes 不动），剩余可用为 0 即不可再上传
//
// 鉴权已在 _middleware.js 完成。
//
// 说明：存储额度没有独立流水表（购买记录走 credit_transactions，
// 上传实扣见 subsite_uploads / storage_reservations），管理调整暂不落流水，
// reason 仅用于操作提示，不持久化。

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

const MB = 1024 * 1024
// 单次上限 1TB（1048576 MB），防误输入
const MAX_MB = 1024 * 1024

export async function onRequest(context) {
  const { request, env, data } = context
  if (request.method !== 'POST') return jsonError('不支持的请求方法', 405)

  const db = env.DB
  const uid = context.params?.uid
  if (!uid) return jsonError('缺少用户 id', 400)

  const body = await request.json().catch(() => ({}))
  const { type, mb } = body

  // 参数校验
  if (type !== 'grant' && type !== 'deduct') {
    return jsonError('type 必须是 grant 或 deduct', 400)
  }
  if (!Number.isInteger(mb) || mb <= 0 || mb > MAX_MB) {
    return jsonError(`mb 必须是 1~${MAX_MB} 的正整数`, 400)
  }

  try {
    // 用户存在性
    const user = await db.prepare('SELECT id FROM user WHERE id = ?').bind(uid).first()
    if (!user) return jsonError('用户不存在', 404)

    const cur = await db
      .prepare('SELECT quota_bytes, used_bytes FROM user_storage_quota WHERE uid = ?')
      .bind(uid)
      .first()
    const quotaBefore = Number(cur?.quota_bytes) || 0
    const usedBytes = Number(cur?.used_bytes) || 0
    const bytes = mb * MB

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    let quotaAfter

    if (type === 'grant') {
      quotaAfter = quotaBefore + bytes
      // UPSERT：无额度行（从未上传过）也能直接赠送
      await db
        .prepare(
          `INSERT INTO user_storage_quota (uid, quota_bytes, used_bytes, updated_at)
           VALUES (?, ?, 0, ?)
           ON CONFLICT(uid) DO UPDATE SET
             quota_bytes = quota_bytes + excluded.quota_bytes,
             updated_at = excluded.updated_at`,
        )
        .bind(uid, bytes, now)
        .run()
    } else {
      if (!cur) {
        return jsonError('该用户暂无存储额度记录，无法扣减', 400)
      }
      quotaAfter = Math.max(0, quotaBefore - bytes)
      const result = await db
        .prepare(
          `UPDATE user_storage_quota
           SET quota_bytes = MAX(0, quota_bytes - ?), updated_at = ?
           WHERE uid = ?`,
        )
        .bind(bytes, now, uid)
        .run()
      const changes = result?.meta?.changes ?? 0
      if (changes === 0) {
        return jsonError('扣减失败：额度记录不存在', 400)
      }
    }

    return json({
      uid,
      type,
      mb,
      quotaBytesBefore: quotaBefore,
      quotaBytesAfter: quotaAfter,
      usedBytes,
      // 扣减后额度低于已用：已有文件保留，但剩余可用为 0
      overUsed: quotaAfter < usedBytes,
      operatorUid: data?.adminUid || 'SYSTEM',
      created_at: now,
    })
  } catch (error) {
    console.error('admin/storage error:', error)
    return jsonError(error.message || '服务器错误', 500)
  }
}

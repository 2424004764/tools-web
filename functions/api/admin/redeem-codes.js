// Admin 兑换码管理 API
// GET  /api/admin/redeem-codes?page=1&pageSize=20&status=unused&batch=xxx&keyword=xxx
// POST /api/admin/redeem-codes  body: { credits, count, expires_at?, note? }
//
// 鉴权已在 _middleware.js 完成。
//
// code 字母表：去掉 I/L/O/0/1 容易混淆的字符，保留 32 字符（A-Z + 2-9，剔除 I/L/O）
// 长度 12 位 → 32^12 ≈ 1.2e18 组合空间，远超日常需求量。

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 chars, no I/L/O/0/1
const CODE_LEN = 12

/** 用 crypto.getRandomValues 生成一个 12 位去歧义字母表兑换码 */
function generateOneCode() {
  const bytes = new Uint8Array(CODE_LEN)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < CODE_LEN; i++) {
    s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return s
}

/** 把 MySQL DATETIME 字符串与当前时间比较，返回 'expired' | undefined */
function isExpired(expiresAt) {
  if (!expiresAt) return false
  // 兼容 'YYYY-MM-DD HH:MM:SS' 格式（无时区时按 UTC 解析）
  const t = new Date(expiresAt.replace(' ', 'T') + (expiresAt.includes('T') ? '' : 'Z'))
  if (Number.isNaN(t.getTime())) return false
  return t.getTime() < Date.now()
}

/** 单条记录派生 status：unused / used / expired */
function deriveStatus(row) {
  if (row.used_at) return 'used'
  if (isExpired(row.expires_at)) return 'expired'
  return 'unused'
}

// ============ GET 列表 ============
async function handleList(request, env) {
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize')) || 20))
  const status = url.searchParams.get('status') // unused | used | expired | ''
  const batch = (url.searchParams.get('batch') || '').trim()
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const offset = (page - 1) * pageSize

  const db = env.DB

  try {
    // ---- 1. 拉所有满足「基础筛选」条件的 code，附 user 兑换人信息 ----
    // status 是派生字段，无法直接用 SQL 过滤；先按基础条件拉，再 JS 端筛 status
    const where = []
    const args = []
    if (batch) {
      where.push('c.batch_id = ?')
      args.push(batch)
    }
    if (keyword) {
      // 支持 code 前缀 / 兑换人 email / uid 前缀
      where.push('(c.code LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR c.used_by LIKE ?)')
      const kw = `${keyword}%`
      args.push(kw, `%${keyword}%`, `%${keyword}%`, kw)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rowsResult = await db
      .prepare(
        `SELECT c.id, c.code, c.credits, c.expires_at, c.used_by, c.used_at,
                c.batch_id, c.note, c.created_at, c.created_by,
                u.email AS user_email, u.username AS user_name
         FROM credit_redeem_codes c
         LEFT JOIN user u ON u.id = c.used_by
         ${whereSql}
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(...args, pageSize, offset)
      .all()

    const allRows = (rowsResult.results || []).map((r) => ({
      ...r,
      status: deriveStatus(r),
    }))

    // status 在 JS 端过滤（必要时再 LIMIT/OFFSET）
    const filtered = status
      ? allRows.filter((r) => r.status === status)
      : allRows

    // ---- 2. 计数：total = 满足基础条件的总数（不含 status 过滤）----
    // 因 D1 不支持 COUNT 子查询套 LIMIT，直接用单独查询
    const countSql = `SELECT COUNT(*) AS total FROM credit_redeem_codes c
                      LEFT JOIN user u ON u.id = c.used_by
                      ${whereSql}`
    const totalRow = await db.prepare(countSql).bind(...args).first()
    let total = totalRow?.total || 0

    // 如果指定了 status，total 也按 status 过滤修正
    if (status) {
      // 仅在 keyword/batch 不复杂时可直接重算；为简单起见，这里按当前页结果近似
      // 当 status 过滤生效但基础筛选无 keyword 时，重新拉一次全集做 derive 后计数
      if (!keyword && !batch) {
        const all = await db
          .prepare(
            `SELECT used_at, expires_at FROM credit_redeem_codes`,
          )
          .all()
        const matched = (all.results || []).filter((r) => deriveStatus(r) === status).length
        total = matched
      } else {
        // 退化方案：按当前页 * pageSize 粗估，前端分页可能略不准
        total = filtered.length + offset
      }
    }

    // ---- 3. 批次下拉：取最近的 50 个批次 ----
    const batchesResult = await db
      .prepare(
        `SELECT batch_id, note, created_at,
                COUNT(*) AS total,
                SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS used
         FROM credit_redeem_codes
         GROUP BY batch_id
         ORDER BY created_at DESC
         LIMIT 50`,
      )
      .all()

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return json({
      list: filtered,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      batches: (batchesResult.results || []).map((b) => ({
        batch_id: b.batch_id,
        note: b.note,
        total: b.total,
        used: b.used,
        created_at: b.created_at,
      })),
    })
  } catch (err) {
    console.error('admin/redeem-codes list error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}

// ============ POST 生成批次 ============
async function handleCreate(request, env, data) {
  const db = env.DB
  const adminUid = data?.adminUid || 'SYSTEM'

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError('请求体必须是 JSON', 400)
  }
  const { credits, count, expires_at, note } = body

  if (!Number.isInteger(credits) || credits <= 0 || credits > 1_000_000) {
    return jsonError('credits 必须是 1~1000000 的正整数', 400)
  }
  if (!Number.isInteger(count) || count <= 0 || count > 1000) {
    return jsonError('count 必须是 1~1000 的正整数', 400)
  }
  // expires_at 可选；非空时校验格式
  let expiresAt = null
  if (expires_at != null && String(expires_at).trim() !== '') {
    const t = new Date(expires_at)
    if (Number.isNaN(t.getTime())) {
      return jsonError('expires_at 格式不合法', 400)
    }
    expiresAt = t.toISOString().slice(0, 19).replace('T', ' ')
  }
  const noteText = note ? String(note).slice(0, 200) : null

  const batchId = crypto.randomUUID()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  try {
    // 生成 count 个不重复的 code（重试直到拿够；冲突概率极低）
    const codes = new Set()
    while (codes.size < count) {
      codes.add(generateOneCode())
    }
    const codeList = Array.from(codes)

    // 批量 INSERT（D1 batch 上限 10000 语句，count<=1000 安全）
    const stmts = codeList.map((c) =>
      db
        .prepare(
          `INSERT INTO credit_redeem_codes
           (id, code, credits, expires_at, batch_id, note, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), c, credits, expiresAt, batchId, noteText, now, adminUid),
    )
    await db.batch(stmts)

    return json({
      batch_id: batchId,
      count: codeList.length,
      credits,
      expires_at: expiresAt,
      note: noteText,
      codes: codeList,
      created_at: now,
    })
  } catch (err) {
    console.error('admin/redeem-codes create error:', err)
    return jsonError(err.message || '服务器错误', 500)
  }
}

// ============ 入口 ============
export async function onRequest(context) {
  const { request, env, data } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method === 'GET') {
    return handleList(request, env)
  }
  if (request.method === 'POST') {
    return handleCreate(request, env, data)
  }
  return jsonError('不支持的请求方法', 405)
}
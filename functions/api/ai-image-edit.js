// AI 图片编辑代理端点
// POST /api/ai-image-edit
// Content-Type: multipart/form-data
// Fields: prompt, model, size, image (file)
//
// 有 image → 图生图：POST bafang.me/v1/images/edits（form-data）
// 无 image → 文生图：POST bafang.me/v1/images/generations（application/json）
//
// 鉴权：CF 环境变量 BAFANG_API_KEY
//
// 扣费：按 tool_models.credit_cost（model 维度）。
//   - cost == 0：不要求登录，不扣费，向后兼容
//   - cost > 0：必须登录；上游 4xx/5xx 或网络异常触发 reverse 流水自动回退积分
//   - model 查找优先级：tool_models → tool_features.credit_cost（兜底）→ 0
//
// 响应兼容（两个端点均为 OpenAI images 格式）：
//   data[0].url（首选）/ data[0].b64_json（兜底）

import { extractUidFromRequest } from './_lib/model-resolver.js'

const TOOL_URL = '/ai-image-edit/'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// 查用户当前余额（未登录返回 null）
async function queryBalance(db, uid) {
  if (!uid) return null
  try {
    const row = await db.prepare('SELECT balance FROM user_credits WHERE uid = ?').bind(uid).first()
    return row?.balance ?? null
  } catch {
    return null
  }
}

// 通用错误 json 带上 balance：前端拿到后直接覆盖显示
async function errorJson(db, uid, errMsg, status = 400) {
  const balance = await queryBalance(db, uid)
  return json({ ok: false, error: errMsg, balance }, status)
}

// 与 credits.js:73 同风格的 UTC 'YYYY-MM-DD HH:mm:ss'
function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * 反向事务：上游失败时退积分。
 * UPDATE 同步 total_spent，INSERT 一条 type='reverse' 的流水关联原 txId。
 * 重试 3 次（指数退避）防 D1 瞬时故障；UNIQUE 约束 (related_tx_id) 自动防重复 reverse。
 * 失败属于严重事件（扣了但没退），必须告警。
 *
 * 注意：idempotency_key 固定传 null，因为 reverse 用 related_tx_id 去重，
 * 且扣费流水已经用了同个 idempotency_key，UNIQUE(uid, idempotency_key) 会冲突。
 */
async function reverseDeduction(env, uid, cost, relatedTxId, reason) {
  const db = env.DB
  const now = nowSql()
  const reverseTxId = crypto.randomUUID()

  const tryOnce = async () => {
    // 先 UPDATE 原子加回积分（balance = balance + cost 无视并发），
    // 再用 RETURNING 拿到更新后的真实余额写入流水，避免 SELECT + UPDATE 之间并发差。
    const updateResult = await db
      .prepare(
        `UPDATE user_credits
         SET balance = balance + ?,
             total_spent = CASE WHEN total_spent >= ? THEN total_spent - ? ELSE 0 END,
             updated_at = ?
         WHERE uid = ?
         RETURNING balance`,
      )
      .bind(cost, cost, cost, now, uid)
      .first()
    const actualBalance = updateResult?.balance ?? 0

    // 再插入 reverse 流水（balance_after 用原子 UPDATE 后的真实值）
    await db
      .prepare(
        `INSERT INTO credit_transactions
         (id, uid, type, amount, balance_after, reason, operator_uid, source, related_tx_id, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        reverseTxId, uid, 'reverse', cost, actualBalance,
        reason, 'SYSTEM', 'tool', relatedTxId, null, now,
      )
      .run()
  }

  // 3 次重试，指数退避：200ms → 600ms → 1800ms
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await tryOnce()
      console.log(`[ai-image-edit] reverse OK uid=${uid.slice(0, 8)} cost=${cost} reverseTxId=${reverseTxId} attempt=${attempt}`)
      return
    } catch (err) {
      const msg = err?.message || ''
      // UNIQUE 冲突：同 related_tx_id 已有 reverse（防重入）
      if (/UNIQUE.*related_tx_id/i.test(msg)) {
        console.log(`[ai-image-edit] reverse already exists (idempotent) uid=${uid.slice(0, 8)} relatedTxId=${relatedTxId}`)
        return
      }
      console.error(`[ai-image-edit] reverse attempt ${attempt} failed uid=${uid.slice(0, 8)} cost=${cost}`, msg)
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 200 * 3 ** (attempt - 1)))
      } else {
        console.error('[ai-image-edit] REVERSE FAILED — MANUAL INTERVENTION REQUIRED', {
          uid, cost, relatedTxId, reason, err: msg,
        })
      }
    }
  }
}

/**
 * 从 images/edits 或 images/generations 响应里提取图片 URL/dataURL
 * data[0].url → data[0].b64_json → data.url
 */
function extractImageFromEditsResponse(data) {
  if (data?.data?.[0]?.url) return data.data[0].url
  if (data?.data?.[0]?.b64_json) return 'data:image/png;base64,' + data.data[0].b64_json
  if (data?.url) return data.url
  if (Array.isArray(data?.data) && data.data[0]?.url) return data.data[0].url
  return ''
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  const apiKey = env.BAFANG_API_KEY
  if (!apiKey) {
    return json({ ok: false, error: '服务未配置 API Key' }, 500)
  }

  // ============ 1. 解析 formData（在扣费前，避免空请求消耗积分） ============
  let formData
  try {
    formData = await request.formData()
  } catch {
    return json({ ok: false, error: '请求格式错误，需要 multipart/form-data' }, 400)
  }

  const prompt = (formData.get('prompt')?.toString() || '').trim().slice(0, 1000)
  const modelKey = (formData.get('model')?.toString() || '').trim() || 'gpt-image-2-1k'
  const size = formData.get('size')?.toString() || '1024x1024'
  const imageFile = formData.get('image')
  const hasImage = imageFile && imageFile instanceof File && imageFile.size > 0

  // 尽早初始化 db 和 uid，让所有错误路径都能带上 balance
  const db = env.DB
  const uid = await extractUidFromRequest(request, env).catch(() => null)

  // ============ 2. prompt 必填 ============
  if (!prompt) {
    return await errorJson(db, uid, '请输入提示词', 400)
  }

  // ============ 3. 查 model 维 cost（tool_models 优先，fallback 到 tool_features） ============
  let cost = 0
  let resolvedModelLabel = ''
  try {
    const m = await db
      .prepare(
        `SELECT credit_cost, model_label FROM tool_models
         WHERE tool_url = ? AND model_key = ? AND is_enabled = 1`,
      )
      .bind(TOOL_URL, modelKey)
      .first()
    if (m) {
      cost = m.credit_cost ?? 0
      resolvedModelLabel = m.model_label || ''
    } else {
      // fallback：工具维兜底
      const t = await db
        .prepare('SELECT credit_cost FROM tool_features WHERE url = ? AND is_enabled = 1')
        .bind(TOOL_URL)
        .first()
      cost = t?.credit_cost ?? 0
    }
  } catch {
    cost = 0
  }

  // ============ 4. 登录校验 + 扣费 ============
  if (cost > 0 && !uid) {
    return await errorJson(db, uid, '请先登录', 401)
  }

  // ============ 5. 幂等键：30 分钟内同 key 的请求复用结果 ============
  // 前端每次提交带 Idempotency-Key（UUID），后端：
  //   - 命中 reverse → 返上次同样错误（不重调上游、不重扣）
  //   - 命中 deduct 但没 reverse → 复用 cost/txId，跳过扣费，重调上游拿图
  //   - 都没命中 → 正常扣费
  // 数据库 UNIQUE(uid, idempotency_key) 自动防同 key 重复 deduct
  const idempotencyKey = (request.headers.get('Idempotency-Key') || '').trim() || crypto.randomUUID()

  let txId = ''
  let balanceAfter = 0
  let reusedDeduct = false
  if (cost > 0 && uid) {
    // 查同 key 的最近 reverse（30 分钟内）
    const priorReverse = await db
      .prepare(
        `SELECT id, reason FROM credit_transactions
         WHERE uid = ? AND idempotency_key = ? AND type = 'reverse'
           AND created_at > datetime('now', '-30 minutes')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(uid, idempotencyKey)
      .first()
    if (priorReverse) {
      // 命中 reverse：该请求此前已失败，返同样错误不重调上游
      console.log(`[ai-image-edit] idempotent-reverse uid=${uid.slice(0, 8)} key=${idempotencyKey.slice(0, 8)}`)
      const bal = await queryBalance(db, uid)
      return json({
        ok: false,
        error: '该请求此前已失败，请稍后重试或换个提示词',
        balance: bal,
        _idempotent: true,
        priorReason: priorReverse.reason,
      }, 400)
    }

    // 查同 key 的最近 deduct（30 分钟内）—— 上次成功扣费但客户端没收到
    const priorDeduct = await db
      .prepare(
        `SELECT id, amount, balance_after FROM credit_transactions
         WHERE uid = ? AND idempotency_key = ? AND type = 'deduct'
           AND created_at > datetime('now', '-30 minutes')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(uid, idempotencyKey)
      .first()
    if (priorDeduct) {
      // 命中 deduct：复用 cost + txId + balance_after，跳过扣费
      txId = priorDeduct.id
      balanceAfter = priorDeduct.balance_after
      reusedDeduct = true
      console.log(`[ai-image-edit] idempotent-reuse uid=${uid.slice(0, 8)} cost=${cost} txId=${txId.slice(0, 8)}`)
    } else {
      // 新请求：正常扣费
      const cur = await db
        .prepare('SELECT balance FROM user_credits WHERE uid = ?')
        .bind(uid)
        .first()
      const currentBalance = cur?.balance || 0
      if (currentBalance < cost) {
        return json({ ok: false, error: `积分余额不足：当前 ${currentBalance}，本次需 ${cost}`, balance: currentBalance }, 400)
      }

      txId = crypto.randomUUID()
      const now = nowSql()
      balanceAfter = currentBalance - cost
      const deductResults = await db.batch([
        db
          .prepare(
            `UPDATE user_credits
             SET balance = balance - ?,
                 total_spent = total_spent + ?,
                 updated_at = ?
             WHERE uid = ? AND balance >= ?`,
          )
          .bind(cost, cost, now, uid, cost),
        db
          .prepare(
            `INSERT INTO credit_transactions
             (id, uid, type, amount, balance_after, reason, operator_uid, source, idempotency_key, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(txId, uid, 'deduct', -cost, balanceAfter, `ai-image-edit:${modelKey}`, uid, 'tool', idempotencyKey, now),
      ])

      const changes = deductResults[0]?.meta?.changes ?? deductResults[0]?.changes ?? 0
      if (changes === 0) {
        return await errorJson(db, uid, '积分余额不足', 400)
      }
      console.log(`[ai-image-edit] deduct OK uid=${uid.slice(0, 8)} model=${modelKey} cost=${cost} txId=${txId.slice(0, 8)} key=${idempotencyKey.slice(0, 8)}`)
    }
  }

  // ============ 5. 调上游 ============
  let upstreamPath, upstreamInit

  if (hasImage) {
    // 图生图：POST /v1/images/edits（form-data）
    const upstreamForm = new FormData()
    upstreamForm.append('model', modelKey)
    upstreamForm.append('size', size)
    upstreamForm.append('prompt', prompt)
    upstreamForm.append('image', imageFile)
    upstreamPath = '/v1/images/edits'
    upstreamInit = {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    }
  } else {
    // 文生图：POST /v1/images/generations（application/json）
    upstreamPath = '/v1/images/generations'
    upstreamInit = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelKey,
        prompt,
        size,
      }),
    }
  }

  console.log('[ai-image-edit] 请求:', JSON.stringify({
    path: upstreamPath,
    model: modelKey,
    size,
    hasImage,
    promptLen: prompt.length,
  }))

  // 上游超时：AI 生图通常 30-90s。
  // 注意：Cloudflare Workers 免费计划可能出现单次请求 CPU 时间/耗时限制，
  // 若 Worker 被平台强行终止，catch 块不会执行，reverseDeduction 不会触发，
  // 积分已扣但不会退还。这是平台层面的限制，代码无法绕过。
  // 付费计划（Unbound）上限 900s，留 120s 超时足矣。
  const UPSTREAM_TIMEOUT_MS = 120000
  const upstreamController = new AbortController()
  const upstreamTimer = setTimeout(() => upstreamController.abort(), UPSTREAM_TIMEOUT_MS)
  upstreamInit.signal = upstreamController.signal

  try {
    const upstreamResponse = await fetch(`https://bafang.me${upstreamPath}`, upstreamInit)
    clearTimeout(upstreamTimer)

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text().catch(() => '')
      console.error('[ai-image-edit] 上游错误:', upstreamResponse.status, errText.slice(0, 500))
      if (cost > 0 && uid && txId) {
        await reverseDeduction(env, uid, cost, txId, `ai-image-edit:reverse:upstream-${upstreamResponse.status}`)
      }
      return await errorJson(db, uid, `上游错误 ${upstreamResponse.status}: ${errText.slice(0, 300)}`, upstreamResponse.status)
    }

    const data = await upstreamResponse.json()

    // 解析响应：两个端点都是 OpenAI images 格式（data[0].url / data[0].b64_json）
    const imageUrl = extractImageFromEditsResponse(data)

    if (!imageUrl) {
      console.error('[ai-image-edit] 无法从响应中提取图片:', JSON.stringify(data).slice(0, 500))
      if (cost > 0 && uid && txId) {
        await reverseDeduction(env, uid, cost, txId, 'ai-image-edit:reverse:no-image-in-response')
      }
      return await errorJson(db, uid, '上游返回成功但未找到图片数据', 502)
    }

    console.log('[ai-image-edit] 成功:', imageUrl.slice(0, 100) + (imageUrl.length > 100 ? '...' : ''))

    return json({
      ok: true,
      data: {
        url: imageUrl,
        cost,
        txId: txId || null,
        balanceAfter: cost > 0 ? balanceAfter : null,
      },
    })
  } catch (error) {
    console.error('[ai-image-edit] 请求失败:', error)
    const isTimeout = error?.name === 'AbortError' || /abort/i.test(error?.message || '')
    if (cost > 0 && uid && txId) {
      const reason = isTimeout
        ? 'ai-image-edit:reverse:upstream-timeout'
        : 'ai-image-edit:reverse:network-error'
      await reverseDeduction(env, uid, cost, txId, reason)
    }
    return await errorJson(db, uid, isTimeout ? '上游调用超时，请稍后重试' : (error.message || '调用失败'), isTimeout ? 504 : 500)
  }
}

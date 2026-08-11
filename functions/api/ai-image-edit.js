// AI 图片编辑代理端点
// POST /api/ai-image-edit
// Content-Type: multipart/form-data
// Fields: prompt, model, size, image (file)
//
// 路由分支（按 model_key 决定走哪条上游路径）：
//   - gemini-*（Google Gemini 图片模型）→ bafang.me/v1beta/models/{model}:generateContent
//     使用 Google 原生 contents/parts/generationConfig 格式，鉴权用 x-goog-api-key
//   - 其他（gpt-image-2 等）→ bafang.me OpenAI 兼容端点
//     有 image → POST /v1/images/edits（form-data）
//     无 image → POST /v1/images/generations（application/json）
//
// 鉴权：CF 环境变量 BAFANG_API_KEY
//
// 扣费：按 tool_models.credit_cost（model 维度）。
//   - cost == 0：不要求登录，不扣费，向后兼容
//   - cost > 0：必须登录；上游 4xx/5xx 或网络异常触发 reverse 流水自动回退积分
//   - model 查找优先级：tool_models → tool_features.credit_cost（兜底）→ 0
//
// 响应兼容：
//   - OpenAI 路径：data[0].url（首选）/ data[0].b64_json（兜底）
//   - Gemini 路径：candidates[0].content.parts[].inline_data.data（base64）

import { extractUidFromRequest } from './_lib/model-resolver.js'
import { startGeneration, finalizeGeneration } from './_lib/record-generation.js'

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

// ============ Gemini 专用 ============

/** 检测是否走 Google Gemini 原生 API 路径（bafang.me 透传到 Google） */
function isGeminiModel(modelKey) {
  return typeof modelKey === 'string' && modelKey.toLowerCase().startsWith('gemini-')
}

/**
 * 前端 size 字符串 → Gemini aspectRatio
 * 1024x1024 → 1:1
 * 1024x1792 → 9:16（竖版）
 * 1792x1024 → 16:9（横版）
 * 其他（含 auto）→ 1:1（最常见，避免上游默认行为不可控）
 */
function mapSizeToAspectRatio(size) {
  switch (size) {
    case '1024x1792':
    case '1024x1920':
    case '1080x1920':
      return '9:16'
    case '1792x1024':
    case '1920x1024':
    case '1920x1080':
      return '16:9'
    case '1024x1024':
    case '1080x1080':
      return '1:1'
    default:
      return '1:1'
  }
}

/** 把 File 读成 base64 字符串（不带 data: 前缀） */
async function fileToBase64(file) {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    )
  }
  return btoa(binary)
}

/**
 * 构造 Gemini generateContent 请求体
 * - 文生图：parts = [{ text: prompt }]
 * - 图生图：parts = [{ text: prompt }, { inline_data: { mime_type, data } }]
 * 固定 responseModalities: ['IMAGE']，imageSize 默认 '1K'（生成速度快、积分低）
 */
async function buildGeminiRequestBody({ prompt, hasImage, imageFile, aspectRatio, imageSize = '1K' }) {
  const parts = [{ text: prompt }]
  if (hasImage && imageFile) {
    const b64 = await fileToBase64(imageFile)
    parts.push({
      inline_data: {
        mime_type: imageFile.type || 'image/png',
        data: b64,
      },
    })
  }
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio, imageSize },
    },
  }
}

/**
 * 从 Gemini generateContent 响应里提取图片
 * 遍历 candidates[0].content.parts[]，找到第一个有 inline_data 的部分
 * 返回 data:mime;base64,... 形式
 */
function extractImageFromGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  for (const part of parts) {
    if (part?.inline_data?.data) {
      const mime = part.inline_data.mime_type || 'image/png'
      return `data:${mime};base64,${part.inline_data.data}`
    }
  }
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

  // 请求级时间戳 + 客户端信息（写日志用）
  const t0 = Date.now()
  const clientIp =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    null
  const userAgent = (request.headers.get('User-Agent') || '').slice(0, 256) || null

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

  const prompt = (formData.get('prompt')?.toString() || '').trim().slice(0, 5000)
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

  if (isGeminiModel(modelKey)) {
    // Gemini 走 Google 原生 API：POST /v1beta/models/{model}:generateContent
    // 请求体用 contents/parts/generationConfig 格式，鉴权用 x-goog-api-key
    const geminiBody = await buildGeminiRequestBody({
      prompt,
      hasImage,
      imageFile,
      aspectRatio: mapSizeToAspectRatio(size),
    })
    upstreamPath = `/v1beta/models/${modelKey}:generateContent`
    upstreamInit = {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiBody),
    }
  } else if (hasImage) {
    // OpenAI 风格图生图：POST /v1/images/edits（form-data）
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
    // OpenAI 风格文生图：POST /v1/images/generations（application/json）
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

  // 客户端断开检测：监听 request.signal，关闭/刷新页面都会触发。
  // 触发时：取消 upstream fetch（省资源）+ 退还积分 + 日志记 'reversed'。
  let clientAborted = false
  if (request.signal) {
    request.signal.addEventListener('abort', () => {
      if (!clientAborted) {
        clientAborted = true
        console.log('[ai-image-edit] client disconnected, will refund if deducted')
        // 顺带取消 upstream fetch，避免白跑
        try { upstreamController.abort() } catch {}
      }
    })
  }

  // 上游超时：10 分钟（600s）。生图模型偶尔会跑到 3-5 分钟。
  // 注意：Cloudflare Workers 免费计划可能出现单次请求 CPU 时间/耗时限制，
  // 若 Worker 被平台强行终止（不是客户端断开），catch 块不会执行，
  // reverseDeduction 不会触发，积分已扣但不会退还——这是平台层面的限制。
  // 付费计划（Unbound）上限 900s，600s 超时留 300s 余量。
  const UPSTREAM_TIMEOUT_MS = 600000
  const upstreamController = new AbortController()
  const upstreamTimer = setTimeout(() => upstreamController.abort(), UPSTREAM_TIMEOUT_MS)
  upstreamInit.signal = upstreamController.signal

  // 已扣费标志：失败时若已扣费，状态记为 'reversed'（表示自动退还过）
  const reversed = cost > 0 && uid && txId

  // 通用记录字段（start / finalize 共用）
  const recordBase = {
    uid,
    source: TOOL_URL,
    mode: hasImage ? 'image-to-image' : 'text-to-image',
    model: modelKey,
    cost,
    txId: txId || null,
    idempotencyKey,
    rawData: {
      prompt,
      size,
      has_input_image: hasImage ? 1 : 0,
      client_ip: clientIp,
      user_agent: userAgent,
      request: isGeminiModel(modelKey)
        ? {
            endpoint: `/v1beta/models/${modelKey}:generateContent`,
            model: modelKey,
            aspectRatio: mapSizeToAspectRatio(size),
            imageSize: '1K',
            prompt,
            image_mime: hasImage ? imageFile.type : null,
            image_size: hasImage ? imageFile.size : 0,
          }
        : hasImage
          ? { endpoint: '/v1/images/edits', model: modelKey, size, prompt, image_size: imageFile.size, image_type: imageFile.type }
          : { endpoint: '/v1/images/generations', model: modelKey, size, prompt },
    },
  }

  // 两段式日志：先插入 in_progress，请求结束再 UPDATE 终态
  const recordId = crypto.randomUUID()
  const startOk = await startGeneration(env, recordId, recordBase)
  // 终态写入 helper（自动算 durationMs，方便各 return 点调用）
  const finalizeRecord = (extra) => finalizeGeneration(env, recordId, {
    ...recordBase,
    durationMs: Date.now() - t0,
    startOk,
    ...extra,
  })

  let upstreamT0 = 0
  let upstreamDurationMs = 0

  try {
    upstreamT0 = Date.now()
    const upstreamResponse = await fetch(`https://bafang.me${upstreamPath}`, upstreamInit)
    upstreamDurationMs = Date.now() - upstreamT0
    clearTimeout(upstreamTimer)

    // 上游已成功返回但客户端已断开：仍按"退还"处理（用户感知不到结果）
    if (clientAborted) {
      console.log('[ai-image-edit] fetch returned but client already gone, refunding')
      if (reversed) {
        await reverseDeduction(env, uid, cost, txId, 'ai-image-edit:reverse:client-disconnected-after-fetch')
      }
      await finalizeRecord({
        status: reversed ? 'reversed' : 'failed',
        upstreamStatus: upstreamResponse.status,
        upstreamDurationMs,
        errorMessage: '客户端已断开连接',
      })
      return await errorJson(db, uid, '客户端已断开连接', 499)
    }

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text().catch(() => '')
      console.error('[ai-image-edit] 上游错误:', upstreamResponse.status, errText.slice(0, 500))
      if (reversed) {
        await reverseDeduction(env, uid, cost, txId, `ai-image-edit:reverse:upstream-${upstreamResponse.status}`)
      }
      await finalizeRecord({
        status: reversed ? 'reversed' : 'failed',
        upstreamStatus: upstreamResponse.status,
        upstreamDurationMs,
        errorMessage: `上游错误 ${upstreamResponse.status}: ${errText.slice(0, 300)}`,
      })
      return await errorJson(db, uid, `上游错误 ${upstreamResponse.status}: ${errText.slice(0, 300)}`, upstreamResponse.status)
    }

    const data = await upstreamResponse.json()

    // 解析响应：按上游格式分支
    //   - OpenAI 路径：data[0].url / data[0].b64_json
    //   - Gemini 路径：candidates[0].content.parts[].inline_data.data
    const imageUrl = isGeminiModel(modelKey)
      ? extractImageFromGeminiResponse(data)
      : extractImageFromEditsResponse(data)

    if (!imageUrl) {
      console.error('[ai-image-edit] 无法从响应中提取图片:', JSON.stringify(data).slice(0, 500))
      if (reversed) {
        await reverseDeduction(env, uid, cost, txId, 'ai-image-edit:reverse:no-image-in-response')
      }
      await finalizeRecord({
        status: reversed ? 'reversed' : 'failed',
        upstreamStatus: upstreamResponse.status,
        upstreamDurationMs,
        errorMessage: '上游返回成功但未找到图片数据',
        rawData: { ...recordBase.rawData, response: data },
      })
      return await errorJson(db, uid, '上游返回成功但未找到图片数据', 502)
    }

    console.log('[ai-image-edit] 成功:', imageUrl.slice(0, 100) + (imageUrl.length > 100 ? '...' : ''))

    await finalizeRecord({
      status: 'success',
      resultUrl: imageUrl,
      upstreamStatus: upstreamResponse.status,
      upstreamDurationMs,
      rawData: { ...recordBase.rawData, response: data },
    })

    return json({
      ok: true,
      data: {
        url: imageUrl,
        recordId, // 前端下载走代理 /api/me/generation-records/:id/image 用
        cost,
        txId: txId || null,
        balanceAfter: cost > 0 ? balanceAfter : null,
      },
    })
  } catch (error) {
    console.error('[ai-image-edit] 请求失败:', error)
    const isClientAbort = clientAborted
    const isTimeout = !isClientAbort && (error?.name === 'AbortError' || /abort/i.test(error?.message || ''))
    if (reversed) {
      const reason = isClientAbort
        ? 'ai-image-edit:reverse:client-disconnected'
        : isTimeout
          ? 'ai-image-edit:reverse:upstream-timeout'
          : 'ai-image-edit:reverse:network-error'
      await reverseDeduction(env, uid, cost, txId, reason)
    }
    await finalizeRecord({
      status: reversed ? 'reversed' : (isTimeout ? 'timeout' : 'failed'),
      upstreamDurationMs,
      errorMessage: isClientAbort
        ? '客户端已断开连接'
        : isTimeout
          ? '上游调用超时'
          : (error?.message || '调用失败'),
    })
    return await errorJson(
      db,
      uid,
      isClientAbort
        ? '客户端已断开连接'
        : isTimeout
          ? '上游调用超时，请稍后重试'
          : (error.message || '调用失败'),
      isClientAbort ? 499 : (isTimeout ? 504 : 500),
    )
  }
}

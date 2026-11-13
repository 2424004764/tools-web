// AI 图片编辑代理端点
// POST /api/ai-image-edit
// Content-Type: multipart/form-data
// Fields: prompt, model, size, images (file[])  — 最多 16 张，不传则走文生图
//
// 上游厂商：走 tool_models.upstreams 配置的有序链（_lib/image-upstream.js），
// 失败自动切换下一家（仅网络/超时/5xx/429/401/403/404 等"换厂商有意义"的错误）。
// 未配置时回退 legacy：bafang.me + env.BAFANG_API_KEY（与旧版硬编码行为一致）。
// 每项的风格分支（在 image-upstream.js 内）：
//   - gemini（gemini-* 前缀或显式指定）→ /v1beta/models/{model}:generateContent（Google 原生格式）
//   - openai（gpt-image-2 等）→ 有 image /v1/images/edits（form-data）；无 image /v1/images/generations（JSON）
//
// 鉴权：ai_providers.api_key（bafang 兜底 env.BAFANG_API_KEY）
//
// 扣费：按用户选中的 tool_models.credit_cost（model 维度），failover 不改变扣费金额。
//   - cost == 0：不要求登录，不扣费，向后兼容
//   - cost > 0：必须登录；整链失败或网络异常触发 reverse 流水自动回退积分
//   - model 查找优先级：tool_models → tool_features.credit_cost（兜底）→ 0
//
// 响应兼容：
//   - OpenAI 路径：data[0].url（首选）/ data[0].b64_json（兜底）
//   - Gemini 路径：candidates[0].content.parts[].inline_data.data（base64）

import { extractUidFromRequest } from './_lib/model-resolver.js'
import { resolveUpstreamChain, runWithFailover, UPSTREAM_MODEL_ID_PATTERN } from './_lib/image-upstream.js'
import { startGeneration, finalizeGeneration } from './_lib/record-generation.js'
import { persistGeneratedImage } from '../services/generatedImageStorage.js'

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

  // ============ 1. 解析 formData（在扣费前，避免空请求消耗积分） ============
  let formData
  try {
    formData = await request.formData()
  } catch {
    return json({ ok: false, error: '请求格式错误，需要 multipart/form-data' }, 400)
  }

  const prompt = (formData.get('prompt')?.toString() || '').trim().slice(0, 5000)
  let modelKey = (formData.get('model')?.toString() || '').trim() || 'gpt-image-2-1k'
  // model 是 tool_models.model_key（查链/积分用），legacy 回退时还会直传上游；
  // 用共享库的格式校验（字母数字开头，可含 . _ - 和中文——存量 key 如 'gpt-image2-超分'），
  // 杜绝 ../、?、# 等注入
  if (!UPSTREAM_MODEL_ID_PATTERN.test(modelKey)) {
    return json({ ok: false, error: '不支持的模型名' }, 400)
  }
  // model_id 是 tool_models.id（新版前端下拉框的取值）：同工具下允许重复 model_key
  // （同一模型的静图 / 动图等多个变体）后，靠行 id 精确命中变体；
  // 老客户端不传则按 model_key 取排序最前的一行（行为与从前一致）
  const modelIdRaw = (formData.get('model_id')?.toString() || '').trim()
  const modelId = /^\d+$/.test(modelIdRaw) ? parseInt(modelIdRaw, 10) : 0
  const size = formData.get('size')?.toString() || '1024x1024'
  // 多图：同一字段名重复提交，formData.getAll 取数组。
  // 兼容旧版单图字段 'image'，无 'images' 时降级到 'image'（保证向后兼容）
  let imageFiles = formData.getAll('images').filter(f => f && f instanceof File && f.size > 0)
  if (imageFiles.length === 0) {
    const legacy = formData.get('image')
    if (legacy && legacy instanceof File && legacy.size > 0) imageFiles = [legacy]
  }
  // 上限 16 张（与前端 MAX_IMAGES 对齐）；超出截断并提示
  const MAX_INPUT_IMAGES = 16
  if (imageFiles.length > MAX_INPUT_IMAGES) {
    imageFiles = imageFiles.slice(0, MAX_INPUT_IMAGES)
  }
  const hasImage = imageFiles.length > 0

  // 尽早初始化 db 和 uid，让所有错误路径都能带上 balance
  const db = env.DB
  const uid = await extractUidFromRequest(request, env).catch(() => null)

  // ============ 2. prompt 必填 ============
  if (!prompt) {
    return await errorJson(db, uid, '请输入提示词', 400)
  }

  // ============ 3. 查 model 维 cost（tool_models 优先，fallback 到 tool_features）+ 上游链 ============
  let cost = 0
  let resolvedModelLabel = ''
  let rawUpstreams
  try {
    // 行解析优先级：model_id 精确命中（重复 key 的变体区分）> model_key 匹配
    // （老客户端；key 重复时取 sort_order 最前的一行，保证确定性）
    let m = null
    if (modelId > 0) {
      m = await db
        .prepare(
          `SELECT model_key, credit_cost, model_label, upstreams FROM tool_models
           WHERE id = ? AND tool_url = ? AND is_enabled = 1`,
        )
        .bind(modelId, TOOL_URL)
        .first()
    }
    if (!m) {
      m = await db
        .prepare(
          `SELECT model_key, credit_cost, model_label, upstreams FROM tool_models
           WHERE tool_url = ? AND model_key = ? AND is_enabled = 1
           ORDER BY sort_order ASC, id ASC LIMIT 1`,
        )
        .bind(TOOL_URL, modelKey)
        .first()
    }
    if (m) {
      modelKey = m.model_key || modelKey
      cost = m.credit_cost ?? 0
      resolvedModelLabel = m.model_label || ''
      rawUpstreams = m.upstreams || null
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

  // 按 model_id 命中的行 model_key 可能与请求传入的不同，覆盖后同样过一遍格式校验
  if (!UPSTREAM_MODEL_ID_PATTERN.test(modelKey)) {
    return json({ ok: false, error: '不支持的模型名' }, 400)
  }

  // ============ 3.5 解析上游链（在扣费前：链完全不可用时直接 500，不收积分） ============
  const { chain, legacy, skipped } = await resolveUpstreamChain(db, TOOL_URL, modelKey, env, { rawUpstreams })
  if (chain.length === 0) {
    console.error('[ai-image-edit] 无可用上游: model=' + modelKey + ' skipped=' + JSON.stringify(skipped))
    return await errorJson(db, uid, '服务未配置上游厂商或 API Key', 500)
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
  // 数据库 UNIQUE(uid, idempotency_key) 防同 key 重复 deduct：
  //   并发同 key 撞 UNIQUE 时回退本次扣费并复用已入库的那条流水（不再裸抛 500）
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
      // 新请求：正常扣费。
      // D1 batch 只在语句 SQL 报错时回滚，"UPDATE 命中 0 行"不报错——
      // 扣费必须单独执行并检查 changes，否则并发下扣到 0 行时会出现
      // "余额没扣、流水却记了 -cost"的幻影流水。
      txId = crypto.randomUUID()
      const now = nowSql()
      try {
        const deduct = await db
          .prepare(
            `UPDATE user_credits
             SET balance = balance - ?,
                 total_spent = total_spent + ?,
                 updated_at = ?
             WHERE uid = ? AND balance >= ?`,
          )
          .bind(cost, cost, now, uid, cost)
          .run()
        if ((deduct?.meta?.changes ?? deduct?.changes ?? 0) === 0) {
          const bal = await queryBalance(db, uid)
          return json({ ok: false, error: `积分余额不足：当前 ${bal}，本次需 ${cost}`, balance: bal }, 400)
        }

        // 流水的 balance_after 用子查询取扣费后的真实余额（不依赖预读快照）
        const logResult = await db
          .prepare(
            `INSERT INTO credit_transactions
             (id, uid, type, amount, balance_after, reason, operator_uid, source, idempotency_key, created_at)
             VALUES (?, ?, 'deduct', ?, (SELECT balance FROM user_credits WHERE uid = ?), ?, ?, 'tool', ?, ?)
             RETURNING balance_after`,
          )
          .bind(txId, uid, -cost, uid, `ai-image-edit:${modelKey}`, uid, idempotencyKey, now)
          .run()
        const returned = logResult?.results?.[0]?.balance_after
        balanceAfter =
          typeof returned === 'number' ? returned : await queryBalance(db, uid)
        console.log(`[ai-image-edit] deduct OK uid=${uid.slice(0, 8)} model=${modelKey} cost=${cost} txId=${txId.slice(0, 8)} key=${idempotencyKey.slice(0, 8)}`)
      } catch (err) {
        if (!String(err?.message || '').includes('UNIQUE constraint failed')) {
          console.error('[ai-image-edit] deduct error:', err)
          return await errorJson(db, uid, '积分扣费失败，请稍后重试', 500)
        }
        // 同 Idempotency-Key 并发重试：另一请求已抢先完成扣费入库。
        // 回退本次已扣的费，复用已入库的那条 deduct 流水。
        try {
          await db
            .prepare(
              `UPDATE user_credits
               SET balance = balance + ?,
                   total_spent = MAX(0, total_spent - ?),
                   updated_at = ?
               WHERE uid = ?`,
            )
            .bind(cost, cost, now, uid)
            .run()
          const winner = await db
            .prepare(
              `SELECT id, balance_after FROM credit_transactions
               WHERE uid = ? AND idempotency_key = ? AND type = 'deduct'
               ORDER BY created_at DESC LIMIT 1`,
            )
            .bind(uid, idempotencyKey)
            .first()
          if (!winner) {
            console.error('[ai-image-edit] idempotent race but no prior deduct found:', err)
            return await errorJson(db, uid, '积分扣费失败，请稍后重试', 500)
          }
          txId = winner.id
          balanceAfter = winner.balance_after
          reusedDeduct = true
          console.log(`[ai-image-edit] idempotent-race-reuse uid=${uid.slice(0, 8)} key=${idempotencyKey.slice(0, 8)}`)
        } catch (e2) {
          // 回退失败属异常路径：记日志供人工对账（可能双扣），保证返回 JSON
          console.error('[ai-image-edit] idempotent-race refund error:', e2)
          return await errorJson(db, uid, '积分扣费异常，请联系管理员核对流水', 500)
        }
      }
    }
  }

  // ============ 5. 调上游（可配置厂商链 + 自动容灾，见 _lib/image-upstream.js） ============
  console.log('[ai-image-edit] 请求:', JSON.stringify({
    model: modelKey,
    size,
    imageCount: imageFiles.length,
    promptLen: prompt.length,
    chain: chain.map(c => `${c.provider}/${c.modelId}`),
    legacy,
  }))

  // 客户端断开检测：监听 request.signal（关闭/刷新页面触发）。
  // fetch 的实时取消由 runWithFailover 的 externalSignal 处理；这里只维护标志，
  // 供"上游已返回但客户端已走"的结果作废退款判断用。
  let clientAborted = false
  if (request.signal) {
    request.signal.addEventListener('abort', () => {
      if (!clientAborted) {
        clientAborted = true
        console.log('[ai-image-edit] client disconnected, will refund if deducted')
      }
    })
  }

  // 上游超时：10 分钟（600s）。生图模型偶尔会跑到 3-5 分钟。
  // 整条 failover 链共享该预算（runWithFailover），避免多家厂商各跑 600s
  // 把请求拖过平台限制（付费计划 Unbound 上限 900s，600s 留 300s 余量）。
  // 注意：Cloudflare Workers 免费计划可能出现单次请求 CPU 时间/耗时限制，
  // 若 Worker 被平台强行终止（不是客户端断开），catch 块不会执行，
  // reverseDeduction 不会触发，积分已扣但不会退还——这是平台层面的限制。
  const UPSTREAM_TIMEOUT_MS = 600000

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
      has_input_image: hasImage ? imageFiles.length : 0,
      client_ip: clientIp,
      user_agent: userAgent,
      // 发往上游的真实请求参数（只含厂商需要的内容）
      request: {
        model: modelKey,
        prompt,
        image_mimes: hasImage ? imageFiles.map(f => f.type) : [],
        image_sizes: hasImage ? imageFiles.map(f => f.size) : [],
      },
      // 上游链路配置（仅落库排障用，不会发给厂商）；实际逐次请求见 attempts（含完整 URL）
      upstream: {
        legacy,
        chain: chain.map(c => ({ provider: c.provider, model_id: c.modelId, style: c.style })),
        ...(skipped.length ? { skipped } : {}),
        timeout_ms: UPSTREAM_TIMEOUT_MS,
      },
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
    const result = await runWithFailover(chain, {
      prompt,
      imageFiles,
      size,
      totalTimeoutMs: UPSTREAM_TIMEOUT_MS,
      externalSignal: request.signal,
      onAttempt: (a) => console.log('[ai-image-edit] upstream attempt:', JSON.stringify(a)),
    })
    upstreamDurationMs = result.totalDurationMs ?? (Date.now() - upstreamT0)

    // 客户端已断开：无论上游是否成功，按"退还"处理（用户感知不到结果）
    if (clientAborted || (!result.ok && result.reason === 'client-aborted')) {
      console.log('[ai-image-edit] client gone, refunding if deducted')
      if (reversed) {
        await reverseDeduction(env, uid, cost, txId, 'ai-image-edit:reverse:client-disconnected')
      }
      await finalizeRecord({
        status: reversed ? 'reversed' : 'failed',
        upstreamStatus: result.attempts?.[result.attempts.length - 1]?.status ?? 0,
        upstreamDurationMs,
        errorMessage: '客户端已断开连接',
        rawData: { ...recordBase.rawData, attempts: result.attempts },
      })
      return await errorJson(db, uid, '客户端已断开连接', 499)
    }

    if (!result.ok) {
      const isTimeout = result.reason === 'timeout'
      console.error('[ai-image-edit] 上游链失败:', result.reason, result.error)
      if (reversed) {
        const reason = isTimeout
          ? 'ai-image-edit:reverse:upstream-timeout'
          : `ai-image-edit:reverse:upstream-${result.reason}-${result.status || 0}`
        await reverseDeduction(env, uid, cost, txId, reason)
      }
      await finalizeRecord({
        status: reversed ? 'reversed' : (isTimeout ? 'timeout' : 'failed'),
        upstreamStatus: result.status || 0,
        upstreamDurationMs,
        errorMessage: result.error,
        rawData: { ...recordBase.rawData, attempts: result.attempts },
      })
      return await errorJson(
        db,
        uid,
        isTimeout ? '上游调用超时，请稍后重试' : result.error,
        isTimeout ? 504 : (result.status || 500),
      )
    }

    console.log('[ai-image-edit] 上游图片已提取，开始上传 R2')
    const storedImage = await persistGeneratedImage(env, {
      uid,
      recordId,
      imageUrl: result.imageUrl,
    })
    const resultUrl = storedImage.publicUrl
    console.log('[ai-image-edit] R2 持久化成功:', resultUrl)

    await finalizeRecord({
      status: 'success',
      resultUrl,
      upstreamStatus: result.status,
      upstreamDurationMs,
      rawData: {
        ...recordBase.rawData,
        response: result.data,
        r2_key: storedImage.r2Key,
        provider_used: result.used.provider,
        model_id_used: result.used.modelId,
        attempts: result.attempts,
      },
    })

    return json({
      ok: true,
      data: {
        url: resultUrl,
        recordId, // 前端下载走代理 /api/me/generation-records/:id/image 用
        // 已持久化的 R2 对象：保存到「我的 AI 创作」画廊时直接复用，避免同一张图存两份
        r2_key: storedImage.r2Key,
        bytes: storedImage.size,
        cost,
        txId: txId || null,
        balanceAfter: cost > 0 ? balanceAfter : null,
      },
    })
  } catch (error) {
    // runWithFailover 自身不抛错（失败都走 result 分支）；这里兜 R2 持久化等未预期异常
    console.error('[ai-image-edit] 请求失败:', error)
    if (reversed) {
      await reverseDeduction(env, uid, cost, txId, 'ai-image-edit:reverse:network-error')
    }
    await finalizeRecord({
      status: reversed ? 'reversed' : 'failed',
      upstreamDurationMs,
      errorMessage: error?.message || '调用失败',
    })
    return await errorJson(db, uid, error?.message || '调用失败', 500)
  }
}

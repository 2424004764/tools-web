// AI 穿搭建议 代理端点
// POST /api/ai-outfit
// Content-Type: multipart/form-data
// Fields:
//   - personImages      (file[], required)   人物照，1~16 张；兼容旧字段 personImage
//   - clothingImages    (file[], optional)   衣物照，0~N 张；兼容旧字段 clothingImage
//   - style             (string, optional)   用户的「风格 / 场景」提示词
//   - model             (string)             模型 key（默认 gpt-image-2-1k）
//   - size              (string)             输出尺寸：auto / 1024x1024 / 1024x1792 / 1792x1024
//
// 模式分支（按 clothingImages 是否非空）：
//   1. 未传 clothingImages（outfit-generate）：仅人物照，让 AI 自动设计一套完整穿搭
//   2. 上传了 clothingImages（outfit-replace）：人物照 + 衣物照，把人物身上的衣物替换为上传的衣物
//
// 鉴权：ai_providers.api_key（bafang 兜底 env.BAFANG_API_KEY）
// 扣费：与 ai-image-edit 一致（按用户选中的 model 查 tool_models.cost，failover 不改变扣费）
//
// 上游厂商：走 tool_models.upstreams 配置的有序链（_lib/image-upstream.js），
// 失败自动切换下一家。未配置时回退 legacy：bafang.me + env.BAFANG_API_KEY。
// 图片顺序（两种风格一致）：人物照（≥1）在前，衣物照（0~N）在后

import { extractUidFromRequest } from './_lib/model-resolver.js'
import { resolveUpstreamChain, runWithFailover, UPSTREAM_MODEL_ID_PATTERN } from './_lib/image-upstream.js'
import { startGeneration, finalizeGeneration } from './_lib/record-generation.js'
import { persistGeneratedImage } from '../services/generatedImageStorage.js'

const TOOL_URL = '/ai-outfit/'

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

async function queryBalance(db, uid) {
  if (!uid) return null
  try {
    const row = await db.prepare('SELECT balance FROM user_credits WHERE uid = ?').bind(uid).first()
    return row?.balance ?? null
  } catch {
    return null
  }
}

async function errorJson(db, uid, errMsg, status = 400) {
  const balance = await queryBalance(db, uid)
  return json({ ok: false, error: errMsg, balance }, status)
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

async function reverseDeduction(env, uid, cost, relatedTxId, reason) {
  const db = env.DB
  const now = nowSql()
  const reverseTxId = crypto.randomUUID()
  const tryOnce = async () => {
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
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await tryOnce()
      console.log(`[ai-outfit] reverse OK uid=${uid.slice(0, 8)} cost=${cost} reverseTxId=${reverseTxId}`)
      return
    } catch (err) {
      const msg = err?.message || ''
      if (/UNIQUE.*related_tx_id/i.test(msg)) {
        console.log(`[ai-outfit] reverse already exists uid=${uid.slice(0, 8)} relatedTxId=${relatedTxId}`)
        return
      }
      console.error(`[ai-outfit] reverse attempt ${attempt} failed uid=${uid.slice(0, 8)} cost=${cost}`, msg)
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 200 * 3 ** (attempt - 1)))
      } else {
        console.error('[ai-outfit] REVERSE FAILED — MANUAL INTERVENTION REQUIRED', {
          uid, cost, relatedTxId, reason, err: msg,
        })
      }
    }
  }
}

/**
 * 把「风格 / 场景」用户输入拼到两套 prompt 的对应位置。
 * 空字符串走默认占位（outfit-generate 时填「时髦、得体、百搭」；outfit-replace 时直接省略此行）
 */
function buildGeneratePrompt(styleText) {
  const userStyle = styleText && styleText.trim()
    ? styleText.trim()
    : '时髦、得体、百搭'
  return [
    '请为照片中的人物设计一套完整、时尚、风格协调的穿搭。',
    '要求：',
    '- 保持人物的面部特征、五官、表情、发型、姿态、肤色完全不变；',
    '- 如果提供了多张人物照，请综合考虑每张图里人物的姿态、角度、可见的身体部位（不要因为多张图就误判为多个人）；',
    '- 保持背景完全不变；',
    '- 只替换 / 添加衣物，包括上衣、下装、鞋子、外套、配饰（帽子、包、首饰等）；',
    `- 整体风格遵循用户指示：${userStyle}；`,
    '- 输出照片级真实感的高清人像，主体居中、姿态自然。',
  ].join('\n')
}

function buildReplacePrompt(styleText) {
  const userStyle = styleText && styleText.trim()
    ? `\n- 用户风格偏好：${styleText.trim()}；`
    : ''
  return [
    '请把人物照中人物的衣物替换为衣物照里展示的衣物。',
    '说明：',
    '- 可能有多张人物照，它们展示的是同一个人（不同角度 / 姿态 / 部位）；综合考虑所有人物照，保持人物的面部特征、五官、表情、发型、肤色、姿态、背景完全不变；',
    '- 可能有多张衣物照，它们是要被穿上的若干单品（上下装、鞋子、配饰等）；',
    '要求：',
    '- 把衣物照中的每件衣物「穿到」人物身上，自动适配人物的身材和姿态，包含合理的褶皱、光影、贴合度；',
    '- 衣物照中已覆盖到的部位用对应衣物替换；衣物照里没有覆盖到的部位保留人物原有穿着或按风格补全；' +
      userStyle,
    '- 输出照片级真实感的高清人像。',
  ].join('\n')
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  const t0 = Date.now()
  const clientIp =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    null
  const userAgent = (request.headers.get('User-Agent') || '').slice(0, 256) || null

  // ============ 1. 解析 formData ============
  let formData
  try {
    formData = await request.formData()
  } catch {
    return json({ ok: false, error: '请求格式错误，需要 multipart/form-data' }, 400)
  }

  // 多图：同一字段名重复提交，formData.getAll 取数组。
  // 兼容旧版单图字段 'personImage' / 'clothingImage'（降级到数组 [single]）
  let personFiles = formData.getAll('personImages').filter(f => f && f instanceof File && f.size > 0)
  if (personFiles.length === 0) {
    const legacy = formData.get('personImage')
    if (legacy && legacy instanceof File && legacy.size > 0) personFiles = [legacy]
  }
  let clothingFiles = formData.getAll('clothingImages').filter(f => f && f instanceof File && f.size > 0)
  if (clothingFiles.length === 0) {
    const legacy = formData.get('clothingImage')
    if (legacy && legacy instanceof File && legacy.size > 0) clothingFiles = [legacy]
  }
  const hasPersonImage = personFiles.length > 0
  const hasClothingImage = clothingFiles.length > 0
  const style = (formData.get('style')?.toString() || '').trim().slice(0, 5000)
  let modelKey = (formData.get('model')?.toString() || '').trim() || 'gpt-image-2-1k'
  // model 是 tool_models.model_key（查链/积分用），legacy 回退时直传上游；
  // 与 ai-image-edit 同款格式校验（此前 outfit 没有校验，顺手补上）
  if (!UPSTREAM_MODEL_ID_PATTERN.test(modelKey)) {
    return json({ ok: false, error: '不支持的模型名' }, 400)
  }
  // model_id 是 tool_models.id（新版前端下拉框的取值）：同工具下允许重复 model_key
  // （同一模型的静图 / 动图等多个变体）后，靠行 id 精确命中变体；
  // 老客户端不传则按 model_key 取排序最前的一行（行为与从前一致）
  const modelIdRaw = (formData.get('model_id')?.toString() || '').trim()
  const modelId = /^\d+$/.test(modelIdRaw) ? parseInt(modelIdRaw, 10) : 0
  const size = formData.get('size')?.toString() || '1024x1024'

  // 上限：人物 + 衣物合计 ≤ 16（与前端 MAX_TOTAL_IMAGES 对齐）；超出截断
  const MAX_INPUT_IMAGES = 16
  const total = personFiles.length + clothingFiles.length
  if (total > MAX_INPUT_IMAGES) {
    // 优先保住人物照；衣物照被截断
    const overflow = total - MAX_INPUT_IMAGES
    if (clothingFiles.length >= overflow) {
      clothingFiles = clothingFiles.slice(0, Math.max(0, clothingFiles.length - overflow))
    } else {
      const personOverflow = overflow - clothingFiles.length
      personFiles = personFiles.slice(0, Math.max(0, personFiles.length - personOverflow))
      clothingFiles = []
    }
  }

  const db = env.DB
  const uid = await extractUidFromRequest(request, env).catch(() => null)

  // ============ 2. personImages 必填（≥1 张）============
  if (!hasPersonImage || personFiles.length === 0) {
    return await errorJson(db, uid, '请上传人物照', 400)
  }

  // ============ 3. 拼实际 prompt（按是否有衣物照切换两套模板） ============
  const mode = hasClothingImage ? 'outfit-replace' : 'outfit-generate'
  const prompt = hasClothingImage
    ? buildReplacePrompt(style)
    : buildGeneratePrompt(style)

  // ============ 4. 查 model 维 cost + 上游链 ============
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

  // ============ 4.5 解析上游链（在扣费前：链完全不可用时直接 500，不收积分） ============
  const { chain, legacy, skipped } = await resolveUpstreamChain(db, TOOL_URL, modelKey, env, { rawUpstreams })
  if (chain.length === 0) {
    console.error('[ai-outfit] 无可用上游: model=' + modelKey + ' skipped=' + JSON.stringify(skipped))
    return await errorJson(db, uid, '服务未配置上游厂商或 API Key', 500)
  }

  // ============ 5. 登录校验 ============
  if (cost > 0 && !uid) {
    return await errorJson(db, uid, '请先登录', 401)
  }

  // ============ 6. 幂等键 ============
  const idempotencyKey = (request.headers.get('Idempotency-Key') || '').trim() || crypto.randomUUID()

  let txId = ''
  let balanceAfter = 0
  let reusedDeduct = false
  if (cost > 0 && uid) {
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
      console.log(`[ai-outfit] idempotent-reverse uid=${uid.slice(0, 8)} key=${idempotencyKey.slice(0, 8)}`)
      const bal = await queryBalance(db, uid)
      return json({
        ok: false,
        error: '该请求此前已失败，请稍后重试或换个提示词',
        balance: bal,
        _idempotent: true,
        priorReason: priorReverse.reason,
      }, 400)
    }

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
      txId = priorDeduct.id
      balanceAfter = priorDeduct.balance_after
      reusedDeduct = true
      console.log(`[ai-outfit] idempotent-reuse uid=${uid.slice(0, 8)} cost=${cost} txId=${txId.slice(0, 8)}`)
    } else {
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
          .bind(txId, uid, 'deduct', -cost, balanceAfter, `ai-outfit:${modelKey}:${mode}`, uid, 'tool', idempotencyKey, now),
      ])

      const changes = deductResults[0]?.meta?.changes ?? deductResults[0]?.changes ?? 0
      if (changes === 0) {
        return await errorJson(db, uid, '积分余额不足', 400)
      }
      console.log(`[ai-outfit] deduct OK uid=${uid.slice(0, 8)} model=${modelKey} cost=${cost} txId=${txId.slice(0, 8)} key=${idempotencyKey.slice(0, 8)}`)
    }
  }

  // ============ 7. 调上游（可配置厂商链 + 自动容灾，见 _lib/image-upstream.js） ============
  // 图片顺序（两种风格一致）：人物照在前、衣物照在后
  const upstreamImages = [...personFiles, ...clothingFiles]

  console.log('[ai-outfit] 请求:', JSON.stringify({
    model: modelKey,
    size,
    mode,
    personCount: personFiles.length,
    clothingCount: clothingFiles.length,
    promptLen: prompt.length,
    chain: chain.map(c => `${c.provider}/${c.modelId}`),
    legacy,
  }))

  // ============ 8. 客户端断开检测 ============
  // fetch 的实时取消由 runWithFailover 的 externalSignal 处理；这里只维护标志，
  // 供"上游已返回但客户端已走"的结果作废退款判断用。
  let clientAborted = false
  if (request.signal) {
    request.signal.addEventListener('abort', () => {
      if (!clientAborted) {
        clientAborted = true
        console.log('[ai-outfit] client disconnected, will refund if deducted')
      }
    })
  }

  // 上游超时：整条 failover 链共享 600s 预算（runWithFailover），
  // 避免多家厂商各跑 600s 把请求拖过平台限制（付费计划 Unbound 上限 900s）
  const UPSTREAM_TIMEOUT_MS = 600000

  const reversed = cost > 0 && uid && txId
  const recordBase = {
    uid,
    source: TOOL_URL,
    mode,
    model: modelKey,
    cost,
    txId: txId || null,
    idempotencyKey,
    rawData: {
      prompt,
      size,
      mode,
      person_count: personFiles.length,
      clothing_count: clothingFiles.length,
      style,
      client_ip: clientIp,
      user_agent: userAgent,
      // 发往上游的真实请求参数（只含厂商需要的内容）
      request: {
        model: modelKey,
        prompt,
        person_mimes: personFiles.map(f => f.type),
        person_sizes: personFiles.map(f => f.size),
        clothing_mimes: hasClothingImage ? clothingFiles.map(f => f.type) : [],
        clothing_sizes: hasClothingImage ? clothingFiles.map(f => f.size) : [],
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

  const recordId = crypto.randomUUID()
  const startOk = await startGeneration(env, recordId, recordBase)
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
      imageFiles: upstreamImages,
      size,
      totalTimeoutMs: UPSTREAM_TIMEOUT_MS,
      externalSignal: request.signal,
      onAttempt: (a) => console.log('[ai-outfit] upstream attempt:', JSON.stringify(a)),
    })
    upstreamDurationMs = result.totalDurationMs ?? (Date.now() - upstreamT0)

    // 客户端已断开：无论上游是否成功，按"退还"处理（用户感知不到结果）
    if (clientAborted || (!result.ok && result.reason === 'client-aborted')) {
      console.log('[ai-outfit] client gone, refunding if deducted')
      if (reversed) {
        await reverseDeduction(env, uid, cost, txId, 'ai-outfit:reverse:client-disconnected')
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
      console.error('[ai-outfit] 上游链失败:', result.reason, result.error)
      if (reversed) {
        const reason = isTimeout
          ? 'ai-outfit:reverse:upstream-timeout'
          : `ai-outfit:reverse:upstream-${result.reason}-${result.status || 0}`
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

    console.log('[ai-outfit] 上游图片已提取，开始上传 R2')
    const storedImage = await persistGeneratedImage(env, {
      uid,
      recordId,
      imageUrl: result.imageUrl,
    })
    const resultUrl = storedImage.publicUrl
    console.log('[ai-outfit] R2 持久化成功:', resultUrl)

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
        recordId,
        cost,
        txId: txId || null,
        balanceAfter: cost > 0 ? balanceAfter : null,
      },
    })
  } catch (error) {
    // runWithFailover 自身不抛错（失败都走 result 分支）；这里兜 R2 持久化等未预期异常
    console.error('[ai-outfit] 请求失败:', error)
    if (reversed) {
      await reverseDeduction(env, uid, cost, txId, 'ai-outfit:reverse:network-error')
    }
    await finalizeRecord({
      status: reversed ? 'reversed' : 'failed',
      upstreamDurationMs,
      errorMessage: error?.message || '调用失败',
    })
    return await errorJson(db, uid, error?.message || '调用失败', 500)
  }
}

// AI 穿搭建议 代理端点
// POST /api/ai-outfit
// Content-Type: multipart/form-data
// Fields:
//   - personImage      (file, required)   人物照
//   - clothingImage    (file, optional)   衣物照；未上传时由 AI 自动设计穿搭
//   - style            (string, optional) 用户的「风格 / 场景」提示词
//   - model            (string)           模型 key（默认 gpt-image-2-1k）
//   - size             (string)           输出尺寸：auto / 1024x1024 / 1024x1792 / 1792x1024
//
// 模式分支（按 clothingImage 是否上传）：
//   1. 未传 clothingImage（outfit-generate）：单图生图，让 AI 自动设计一套完整穿搭
//   2. 上传了 clothingImage（outfit-replace）：双图生图，把人物身上的衣物替换为上传的衣物
//
// 鉴权：CF 环境变量 BAFANG_API_KEY
// 扣费：与 ai-image-edit 一致（按 model 查 tool_models.cost）
//
// 上游分支（按 model_key）：
//   - gemini-*：POST bafang.me/v1beta/models/{model}:generateContent
//     多 parts：第一段 text 为穿搭场景提示词，第二/三段 inline_data 为图片
//   - 其他：POST bafang.me/v1/images/edits（form-data, image[] 多 file）

import { extractUidFromRequest } from './_lib/model-resolver.js'
import { startGeneration, finalizeGeneration } from './_lib/record-generation.js'

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

function extractImageFromEditsResponse(data) {
  if (data?.data?.[0]?.url) return data.data[0].url
  if (data?.data?.[0]?.b64_json) return 'data:image/png;base64,' + data.data[0].b64_json
  if (data?.url) return data.url
  if (Array.isArray(data?.data) && data.data[0]?.url) return data.data[0].url
  return ''
}

function isGeminiModel(modelKey) {
  return typeof modelKey === 'string' && modelKey.toLowerCase().startsWith('gemini-')
}

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
    '请把第一张图片（人物照）中人物的衣物替换为第二张图片（衣物照）里展示的衣物。',
    '要求：',
    '- 保持人物的面部特征、五官、表情、发型、肤色、姿态、背景完全不变；',
    '- 把衣物照中的衣物「穿到」人物身上，自动适配人物的身材和姿态，包含合理的褶皱、光影、贴合度；',
    '- 如果衣物照里包含多件单品（上下装、鞋子、配饰），就替换对应部位，原衣物照里没有覆盖到的部位保留人物原有穿着或按风格补全；' +
      userStyle,
    '- 输出照片级真实感的高清人像。',
  ].join('\n')
}

/**
 * 构造 Gemini generateContent 请求体。
 * parts 顺序：[{ text: prompt }, { inline_data: personImage }, ...clothingImage]
 */
async function buildGeminiRequestBody({ prompt, personFile, clothingFile, aspectRatio, imageSize = '1K' }) {
  const parts = [{ text: prompt }]
  const personB64 = await fileToBase64(personFile)
  parts.push({
    inline_data: {
      mime_type: personFile.type || 'image/png',
      data: personB64,
    },
  })
  if (clothingFile) {
    const clothingB64 = await fileToBase64(clothingFile)
    parts.push({
      inline_data: {
        mime_type: clothingFile.type || 'image/png',
        data: clothingB64,
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

  // ============ 1. 解析 formData ============
  let formData
  try {
    formData = await request.formData()
  } catch {
    return json({ ok: false, error: '请求格式错误，需要 multipart/form-data' }, 400)
  }

  const personImage = formData.get('personImage')
  const hasPersonImage = personImage && personImage instanceof File && personImage.size > 0
  const clothingImage = formData.get('clothingImage')
  const hasClothingImage = clothingImage && clothingImage instanceof File && clothingImage.size > 0
  const style = (formData.get('style')?.toString() || '').trim().slice(0, 5000)
  const modelKey = (formData.get('model')?.toString() || '').trim() || 'gpt-image-2-1k'
  const size = formData.get('size')?.toString() || '1024x1024'

  const db = env.DB
  const uid = await extractUidFromRequest(request, env).catch(() => null)

  // ============ 2. personImage 必填 ============
  if (!hasPersonImage) {
    return await errorJson(db, uid, '请上传人物照', 400)
  }

  // ============ 3. 拼实际 prompt（按是否有衣物照切换两套模板） ============
  const mode = hasClothingImage ? 'outfit-replace' : 'outfit-generate'
  const prompt = hasClothingImage
    ? buildReplacePrompt(style)
    : buildGeneratePrompt(style)

  // ============ 4. 查 model 维 cost ============
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
      const t = await db
        .prepare('SELECT credit_cost FROM tool_features WHERE url = ? AND is_enabled = 1')
        .bind(TOOL_URL)
        .first()
      cost = t?.credit_cost ?? 0
    }
  } catch {
    cost = 0
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

  // ============ 7. 调上游 ============
  let upstreamPath, upstreamInit

  if (isGeminiModel(modelKey)) {
    const geminiBody = await buildGeminiRequestBody({
      prompt,
      personFile: personImage,
      clothingFile: hasClothingImage ? clothingImage : null,
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
  } else {
    // OpenAI 风格图生图：POST /v1/images/edits（form-data, image[]）
    const upstreamForm = new FormData()
    upstreamForm.append('model', modelKey)
    upstreamForm.append('size', size)
    upstreamForm.append('prompt', prompt)
    // 两个图都叫 image，按 OpenAI 多 file 约定顺序传：人物照先，衣物照后
    upstreamForm.append('image', personImage)
    if (hasClothingImage) {
      upstreamForm.append('image', clothingImage)
    }
    upstreamPath = '/v1/images/edits'
    upstreamInit = {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    }
  }

  console.log('[ai-outfit] 请求:', JSON.stringify({
    path: upstreamPath,
    model: modelKey,
    size,
    mode,
    hasClothingImage,
    promptLen: prompt.length,
  }))

  // ============ 8. 客户端断开检测 ============
  let clientAborted = false
  const upstreamController = new AbortController()
  const upstreamTimer = setTimeout(() => upstreamController.abort(), 600000)
  upstreamInit.signal = upstreamController.signal
  if (request.signal) {
    request.signal.addEventListener('abort', () => {
      if (!clientAborted) {
        clientAborted = true
        console.log('[ai-outfit] client disconnected, will refund if deducted')
        try { upstreamController.abort() } catch {}
      }
    })
  }

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
      has_person_image: 1,
      has_clothing_image: hasClothingImage ? 1 : 0,
      style,
      client_ip: clientIp,
      user_agent: userAgent,
      request: isGeminiModel(modelKey)
        ? {
            endpoint: `/v1beta/models/${modelKey}:generateContent`,
            model: modelKey,
            aspectRatio: mapSizeToAspectRatio(size),
            imageSize: '1K',
            prompt,
            person_mime: personImage.type,
            person_size: personImage.size,
            clothing_mime: hasClothingImage ? clothingImage.type : null,
            clothing_size: hasClothingImage ? clothingImage.size : 0,
          }
        : {
            endpoint: '/v1/images/edits',
            model: modelKey,
            size,
            prompt,
            person_size: personImage.size,
            person_type: personImage.type,
            clothing_size: hasClothingImage ? clothingImage.size : 0,
            clothing_type: hasClothingImage ? clothingImage.type : null,
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
    const upstreamResponse = await fetch(`https://bafang.me${upstreamPath}`, upstreamInit)
    upstreamDurationMs = Date.now() - upstreamT0
    clearTimeout(upstreamTimer)

    if (clientAborted) {
      console.log('[ai-outfit] fetch returned but client already gone, refunding')
      if (reversed) {
        await reverseDeduction(env, uid, cost, txId, 'ai-outfit:reverse:client-disconnected-after-fetch')
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
      console.error('[ai-outfit] 上游错误:', upstreamResponse.status, errText.slice(0, 500))
      if (reversed) {
        await reverseDeduction(env, uid, cost, txId, `ai-outfit:reverse:upstream-${upstreamResponse.status}`)
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

    const imageUrl = isGeminiModel(modelKey)
      ? extractImageFromGeminiResponse(data)
      : extractImageFromEditsResponse(data)

    if (!imageUrl) {
      console.error('[ai-outfit] 无法从响应中提取图片:', JSON.stringify(data).slice(0, 500))
      if (reversed) {
        await reverseDeduction(env, uid, cost, txId, 'ai-outfit:reverse:no-image-in-response')
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

    console.log('[ai-outfit] 成功:', imageUrl.slice(0, 100) + (imageUrl.length > 100 ? '...' : ''))

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
        recordId,
        cost,
        txId: txId || null,
        balanceAfter: cost > 0 ? balanceAfter : null,
      },
    })
  } catch (error) {
    console.error('[ai-outfit] 请求失败:', error)
    const isClientAbort = clientAborted
    const isTimeout = !isClientAbort && (error?.name === 'AbortError' || /abort/i.test(error?.message || ''))
    if (reversed) {
      const reason = isClientAbort
        ? 'ai-outfit:reverse:client-disconnected'
        : isTimeout
          ? 'ai-outfit:reverse:upstream-timeout'
          : 'ai-outfit:reverse:network-error'
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

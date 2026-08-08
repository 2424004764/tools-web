// AI 通用代理端点
// POST /api/ai-proxy
// Body: { capability, model_key, params, user_api_key? }
// - capability: 'chat' | 'chat_stream' | 'image_generation' | 'image_edit' | 'video_submit' | 'video_poll'
// - model_key: 业务唯一键，如 'agnes/agnes-2.0-flash'
// - params: 入参对象（会按 input_template 渲染）
// - user_api_key: 可选，私有厂商允许用户在请求里覆盖 key
//
// 流式响应：透传 SSE，每 chunk 用 output_paths[capability].delta 抽取转发
// 非流式：解析上游 JSON，按 output_paths[capability] 抽取字段后返回

import {
  resolveModel,
  renderTemplate,
  extractByPath,
  buildUrl,
  extractUidFromRequest
} from './_lib/model-resolver.js'

const corsHeaders = {

  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  const db = env.DB
  const uid = await extractUidFromRequest(request, env)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: '无效的 JSON 请求体' }, 400)
  }

  const { capability, model_key, params = {}, user_api_key } = body

  if (!capability || !model_key) {
    return json({ ok: false, error: 'capability 和 model_key 必填' }, 400)
  }

  // 解析模型
  const resolved = await resolveModel(db, model_key, uid)
  if (!resolved) {
    return json({ ok: false, error: `模型不存在或无权访问: ${model_key}` }, 404)
  }

  // 校验能力
  if (!resolved.model.capabilities.includes(capability)) {
    return json({
      ok: false,
      error: `模型 ${model_key} 不支持 capability "${capability}"`
    }, 400)
  }

  const endpoint = resolved.endpoints[capability]
  if (!endpoint || !endpoint.path) {
    return json({ ok: false, error: `模型 ${model_key} 未配置 ${capability} 端点` }, 500)
  }

  // 渲染入参 body
  const template = resolved.inputTemplate[capability] || resolved.inputTemplate
  const renderParams = {
    ...params,
    model_id: resolved.model.model_id,
  }
  const requestBody = renderTemplate(template, renderParams)

  // 拼接 URL
  const url = buildUrl(
    resolved.provider.base_url,
    endpoint.path,
    endpoint.query,
    renderParams
  )

  // 选 API Key：用户提供的 key 优先；否则使用系统配置的 key（登录用户与游客都可用）
  let apiKey = user_api_key || resolved.apiKey

  // 非管理员用 user_api_key 时，要求厂商 is_open=1（管理员不受限）
  if (user_api_key && uid) {
    const adminCheck = await db.prepare(`SELECT is_admin FROM user WHERE id = ?`).bind(uid).first()
    const isAdminUser = !!adminCheck?.is_admin
    if (!isAdminUser && !resolved.provider.is_open) {
      return json({
        ok: false,
        error: '该厂商未开放用户自定义 Key（仅管理员可用）'
      }, 403)
    }
  }

  if (!apiKey) {
    return json({
      ok: false,
      error: '未配置 API Key，请在厂商设置中填写'
    }, 400)
  }

  // 流式 vs 非流式
  const isStream = capability === 'chat_stream'

  try {
    // 调试日志：打印原始 params 和模板
    console.log('[ai-proxy] INCOMING params:', JSON.stringify(params))
    console.log('[ai-proxy] template for', capability, ':', JSON.stringify(template))

    // image_edit / image_generation：直接把前端传入的 prompt 覆盖到顶层（绕过模板 $ref 引用）
    if ((capability === 'image_edit' || capability === 'image_generation') && typeof params.prompt === 'string') {
      requestBody.prompt = params.prompt
    }

    // image_edit / image_generation：把前端传入的 width × height 覆盖到顶层 size（绕过模板 $const / $fn）
    if ((capability === 'image_edit' || capability === 'image_generation')
        && Number.isFinite(params.width) && Number.isFinite(params.height)) {
      requestBody.size = `${params.width}x${params.height}`
    }

    // 非流式 capability（chat）：强制 stream=false，
    // 避免 input_template 里 "$const":true 导致上游返回 SSE 而下方却按 JSON 解析
    if (!isStream) {
      requestBody.stream = false
    }

    // 日志：打印真正发出去的上游请求头（含 Authorization 完整掩码 + 全部 headers），便于排查
    const maskedKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '(空)'
    console.log('[ai-proxy] >>> FULL UPSTREAM REQUEST')
    console.log('[ai-proxy]   capability:', capability)
    console.log('[ai-proxy]   model_key :', model_key)
    console.log('[ai-proxy]   provider  :', resolved.provider.slug, '| base_url:', resolved.provider.base_url)
    console.log('[ai-proxy]   url       :', url)
    console.log('[ai-proxy]   method    :', endpoint.method || 'POST')
    console.log('[ai-proxy]   apiKey    :', maskedKey)
    console.log('[ai-proxy]   ---------- REQUEST HEADERS ----------')
    console.log('[ai-proxy]   Content-Type:', 'application/json')
    console.log('[ai-proxy]   Authorization:', `Bearer ${maskedKey}`)
    console.log('[ai-proxy]   Accept:', isStream ? 'text/event-stream' : '(未设置)')
    console.log('[ai-proxy]   ---------- REQUEST BODY ----------')
    console.log('[ai-proxy]   body      :', JSON.stringify(isStream ? { ...requestBody, stream: true } : requestBody, null, 2))

    const upstreamHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(isStream ? { 'Accept': 'text/event-stream' } : {}),
    }
    // GET / HEAD 不能带 body（否则 fetch 会抛 "Request with a GET or HEAD method cannot have a body"）
    const upstreamMethod = (endpoint.method || 'POST').toUpperCase()
    const hasBody = upstreamMethod !== 'GET' && upstreamMethod !== 'HEAD'
    const fetchInit = {
      method: upstreamMethod,
      headers: upstreamHeaders,
    }
    if (hasBody) {
      fetchInit.body = isStream
        ? JSON.stringify({ ...requestBody, stream: true })
        : JSON.stringify(requestBody)
    }
    // 视频接口专用：上游 503 video_queue_full 时自动退避重试
    // 其他 capability / 其他错误直接透传，避免影响 chat / image 等低延迟接口
    const upstreamResponse = await fetchUpstreamWithQueueRetry(
      url,
      fetchInit,
      capability.startsWith('video_')
    )

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text().catch(() => '')
      let friendlyError = errText
      try {
        const errJson = JSON.parse(errText)
        if (errJson?.code === 'video_queue_full') {
          friendlyError = 'Agnes 视频队列繁忙，已自动重试 3 次仍无法提交，请过几分钟再试'
        }
      } catch {}
      return json({
        ok: false,
        error: `上游错误 ${upstreamResponse.status}: ${friendlyError.slice(0, 500)}`
      }, upstreamResponse.status)
    }

    // 流式响应：透传 SSE + 抽取 delta
    if (isStream) {
      return handleStreamResponse(upstreamResponse, resolved.outputPaths[capability] || {})
    }

    // 非流式响应：解析 JSON + 抽取字段
    const rawJson = await upstreamResponse.json()
    const outputPaths = resolved.outputPaths[capability] || {}
    const data = {}

    for (const [field, path] of Object.entries(outputPaths)) {
      data[field] = extractByPath(rawJson, path)
    }

    return json({ ok: true, data })
  } catch (error) {
    console.error('ai-proxy error:', error)
    return json({ ok: false, error: error.message || '调用失败' }, 500)
  }
}

/**
 * 调用上游并对 503 video_queue_full 做退避重试
 * - 仅当 capability 为视频类（video_submit / video_poll）且上游返回 503 且 body.code === 'video_queue_full' 时重试
 * - 其他能力 / 其他错误码 / 其他错误体一律不重试，立即返回
 * - 默认最多 3 次尝试（首次 + 2 次重试），间隔 5s / 10s
 * @returns {Promise<Response>} 最后一次上游响应
 */
async function fetchUpstreamWithQueueRetry(url, init, isVideoCapability) {
  const MAX_ATTEMPTS = 3
  const delays = [5000, 10000] // 第 1、2 次重试前的等待

  let response = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    response = await fetch(url, init)

    // 成功 / 非视频能力 / 非 503：直接返回
    if (response.ok || !isVideoCapability || response.status !== 503) {
      return response
    }

    // 解析 body 判断是否为 video_queue_full（503 也可能用于其他错误）
    const text = await response.clone().text().catch(() => '')
    let isQueueFull = false
    try {
      const json = JSON.parse(text)
      isQueueFull = json?.code === 'video_queue_full'
    } catch {}

    // 不是 video_queue_full 或已是最后一次尝试：返回当前响应
    if (!isQueueFull || attempt === MAX_ATTEMPTS) {
      return response
    }

    // 退避后重试
    const delayMs = delays[attempt - 1]
    console.log(`[ai-proxy] video_queue_full，${delayMs}ms 后重试（第 ${attempt}/${MAX_ATTEMPTS - 1} 次重试）`)
    await new Promise(r => setTimeout(r, delayMs))
  }
  return response
}

/**
 * 处理流式 SSE 响应
 * 读取上游 SSE 流，按 output_paths[capability].delta 抽取字段后
 * 包装为统一的 SSE 格式转发给前端
 */
async function handleStreamResponse(upstreamResponse, outputPaths) {
  const deltaPath = outputPaths.delta || '$.choices[0].delta.content'
  const reader = upstreamResponse.body.getReader()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (!data || data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const delta = extractByPath(json, deltaPath)
              if (delta) {
                // 转发为统一格式
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ delta })}\n\n`
                ))
              }
            } catch {
              // 忽略解析失败的行
            }
          }
        }
      } catch (error) {
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders,
    }
  })
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}
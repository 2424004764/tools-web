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
  'Access-Control-Allow-Origin': '*',
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
  const uid = extractUidFromRequest(request)

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

  // 选 API Key：用户提供的 key 优先；登录用户还能用厂商配置的 key；游客必须自己提供
  let apiKey = user_api_key || ''
  if (!apiKey && uid) {
    apiKey = resolved.apiKey  // 登录用户可使用系统配置的 key
  }

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
      error: uid
        ? '未配置 API Key，请在厂商设置中填写'
        : '游客必须配置自己的 API Key（点击页面顶部 🔑 我的 API Key）'
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

    // 日志放在 prompt 注入之后，确保看到真正发出去的 requestBody
    console.log('[ai-proxy] request', JSON.stringify({
      capability,
      model_key,
      url,
      requestBody
    }, null, 2))

    const upstreamResponse = await fetch(url, {
      method: endpoint.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(isStream ? { 'Accept': 'text/event-stream' } : {}),
      },
      body: isStream ? JSON.stringify({ ...requestBody, stream: true }) : JSON.stringify(requestBody),
    })

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text().catch(() => '')
      return json({
        ok: false,
        error: `上游错误 ${upstreamResponse.status}: ${errText.slice(0, 500)}`
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
// Agnes AI Chat 端点（过渡期保留）
// 内部走 ai-proxy 逻辑（resolver + renderTemplate + extractByPath）
// 保持原有 URL /api/agnes-chat 不变以兼容现有调用
// 支持 capability：chat（非流式）、chat_stream（流式）
// 通过 ?capability=xxx 切换，默认 chat_stream（与原行为一致）

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

const DEFAULT_MODEL_KEY = 'agnes/agnes-2.0-flash'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const db = env.DB
  const uid = extractUidFromRequest(request)
  const url = new URL(request.url)
  const capability = url.searchParams.get('capability') || 'chat_stream'

  let body
  try { body = await request.json() } catch { return json({ error: '无效的 JSON' }, 400) }

  const modelKey = body.model_key || DEFAULT_MODEL_KEY
  const resolved = await resolveModel(db, modelKey, uid)
  if (!resolved) return json({ error: `模型不存在或无权访问: ${modelKey}` }, 404)

  if (!resolved.model.capabilities.includes(capability)) {
    return json({ error: `模型不支持 capability: ${capability}` }, 400)
  }

  const endpoint = resolved.endpoints[capability]
  if (!endpoint) return json({ error: '端点未配置' }, 500)

  const template = resolved.inputTemplate[capability] || resolved.inputTemplate
  const params = {
    ...body,
    model_id: resolved.model.model_id,
  }
  const requestBody = renderTemplate(template, params)
  const upstreamUrl = buildUrl(resolved.provider.base_url, endpoint.path, endpoint.query, params)
  const authHeader = request.headers.get('Authorization')

  // 如果客户端指定了 stream 字段，优先用客户端的值；否则流式 capability 默认 true
  if (capability === 'chat_stream' && requestBody.stream === undefined) {
    requestBody.stream = true
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: endpoint.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || `Bearer ${resolved.apiKey}`,
        ...(capability === 'chat_stream' ? { 'Accept': 'text/event-stream' } : {}),
      },
      body: JSON.stringify(requestBody),
    })

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '')
      return json({ error: errText.slice(0, 500) }, upstream.status)
    }

    // 流式：透传（保留原 agnes-chat 流式行为，不重新包装）
    if (capability === 'chat_stream') {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }

    // 非流式：透传原始 JSON
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (error) {
    return json({ error: error.message }, 500)
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}
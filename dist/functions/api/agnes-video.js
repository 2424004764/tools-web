// Agnes AI 视频任务提交端点（过渡期保留）
// 内部走 ai-proxy 逻辑，支持自定义 model_key
// POST /api/agnes-video
// Body 兼容原有：{ model, prompt, num_frames, frame_rate, width, height, extra_body?: { image: [...] } }
// 新增可选：{ model_key } 默认 'agnes/agnes-video-v2.0'

import {
  resolveModel,
  renderTemplate,
  buildUrl,
  extractUidFromRequest
} from './_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const DEFAULT_MODEL_KEY = 'agnes/agnes-video-v2.0'

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
  const authHeader = request.headers.get('Authorization')

  let body
  try { body = await request.json() } catch { return json({ error: '无效的 JSON' }, 400) }

  const modelKey = body.model_key || DEFAULT_MODEL_KEY
  const resolved = await resolveModel(db, modelKey, uid)
  if (!resolved) return json({ error: `模型不存在: ${modelKey}` }, 404)

  if (!resolved.model.capabilities.includes('video_submit')) {
    return json({ error: '模型不支持视频提交' }, 400)
  }

  const endpoint = resolved.endpoints.video_submit
  const template = resolved.inputTemplate.video_submit || resolved.inputTemplate

  // 把原 agnes-video 的 frames/width/height 字段映射到模板需要的字段
  // 原 body: { prompt, num_frames, frame_rate, width, height, extra_body?: { image } }
  // 模板需要: { prompt, frames, width, height, images? }
  const params = {
    prompt: body.prompt,
    frames: body.num_frames ?? body.frames,
    width: body.width,
    height: body.height,
    images: body.extra_body?.image || body.images || [],
    model_id: resolved.model.model_id,
  }

  const requestBody = renderTemplate(template, params)
  const upstreamUrl = buildUrl(resolved.provider.base_url, endpoint.path, endpoint.query, params)

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || `Bearer ${resolved.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

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
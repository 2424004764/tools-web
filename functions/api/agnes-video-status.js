// Agnes AI 视频状态轮询端点（过渡期保留）
// GET /api/agnes-video-status?video_id=xxx&model_key=xxx
// 内部走 ai-proxy 逻辑

import {
  resolveModel,
  buildUrl,
  extractUidFromRequest
} from './_lib/model-resolver.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const DEFAULT_MODEL_KEY = 'agnes/agnes-video-v2.0'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const db = env.DB
  const uid = extractUidFromRequest(request)
  const url = new URL(request.url)
  const videoId = url.searchParams.get('video_id')
  const modelKey = url.searchParams.get('model_key') || DEFAULT_MODEL_KEY

  if (!videoId) return json({ error: 'video_id is required' }, 400)

  const resolved = await resolveModel(db, modelKey, uid)
  if (!resolved) return json({ error: `模型不存在: ${modelKey}` }, 404)

  if (!resolved.model.capabilities.includes('video_poll')) {
    return json({ error: '模型不支持视频轮询' }, 400)
  }

  const endpoint = resolved.endpoints.video_poll
  const authHeader = request.headers.get('Authorization')
  const upstreamUrl = buildUrl(
    resolved.provider.base_url,
    endpoint.path,
    endpoint.query,
    { video_id: videoId }
  )

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader || `Bearer ${resolved.apiKey}`,
      },
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
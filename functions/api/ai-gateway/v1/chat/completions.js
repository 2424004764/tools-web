// 统一 AI 网关 - OpenAI 原生兼容入口
// POST /api/ai-gateway/v1/chat/completions
//
// 任何 OpenAI SDK / 兼容客户端把 baseURL 指到本站即可用：
//   baseURL: https://<site>/api/ai-gateway/v1
//   apiKey:  站内登录 JWT（Bearer）；后续接入服务间 X-Gateway-Key
//   model:   调度组 group_key（推荐，自动容灾）或 gateway_models.id（数字串直连）
//
// 响应完全对齐 OpenAI：
//   非流式 chat.completion；流式 chat.completion.chunk + data: [DONE]
//   上游 anthropic / gemini 的流事件已在网关内转换为 OpenAI chunk 格式

import { extractUidFromRequest } from '../../../_lib/model-resolver.js'
import { runGatewayChat, logGatewayCall, instrumentedEvents, sanitizeJsonForLog } from '../../../_lib/gateway/index.js'

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function openaiError(message, status, type = 'invalid_request_error') {
  return json({ error: { message, type, code: status } }, status)
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return openaiError('Method not allowed', 405)

  const t0 = Date.now()

  const uid = await extractUidFromRequest(request, env)
  if (!uid) return openaiError('请先登录（apiKey 传站内 JWT）', 401, 'authentication_error')

  let body
  try {
    body = await request.json()
  } catch {
    return openaiError('无效的 JSON 请求体', 400)
  }

  const modelField = typeof body.model === 'string' ? body.model.trim() : ''
  if (!modelField) return openaiError('model 必填（调度组 group_key 或模型 ID）', 400)

  const db = env.DB

  // model 解析：先按调度组 key，再按 gateway_models.id（数字串）
  let groupKey
  let modelId
  try {
    const group = await db
      .prepare('SELECT id FROM gateway_groups WHERE group_key = ? AND status = 1')
      .bind(modelField)
      .first()
    if (group) {
      groupKey = modelField
    } else if (/^\d+$/.test(modelField)) {
      modelId = Number(modelField)
    }
  } catch {
    /* 查询异常走 404 分支 */
  }
  if (!groupKey && !modelId) {
    return openaiError(`model 不存在: ${modelField}（需为启用的调度组 group_key，或 gateway_models.id 数字串）`, 404, 'invalid_request_error')
  }

  const stream = body.stream === true
  const canonicalPayload = {
    messages: body.messages,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    top_p: body.top_p,
    stop: body.stop,
  }
  const outcome = await runGatewayChat(db, {
    groupKey,
    modelId,
    payload: canonicalPayload,
    stream,
    totalTimeoutMs: 120000,
    externalSignal: request.signal,
  })

  // ============ 调用明细埋点（与 /api/ai-gateway 同构） ============
  const fireAndForget = (p) => {
    try {
      if (typeof context.waitUntil === 'function') context.waitUntil(p)
    } catch {
      /* 非 CF 运行时（单测）忽略 */
    }
  }
  const groupLabel = groupKey || `model:${modelId}`
  const requestLogBody = () => sanitizeJsonForLog({ source: 'openai-compat', model: modelField, payload: canonicalPayload })
  const attemptsDetailOf = (oc) =>
    JSON.stringify(
      (oc.attempts || []).map((a) => ({
        provider: a.provider,
        model_id: a.model_id,
        status: a.status,
        durationMs: a.durationMs,
        ...(a.error ? { error: a.error } : {}),
      })),
    )
  const lastHit = outcome.attempts?.[outcome.attempts.length - 1] || {}
  const logFinal = (extra = {}) => {
    fireAndForget(
      logGatewayCall(db, {
        uid,
        capability: stream ? 'chat_stream' : 'chat',
        groupKey: groupLabel,
        providerSlug: outcome.used?.providerSlug || lastHit.provider || '',
        modelId: outcome.used?.modelId || lastHit.model_id || '',
        ok: !!outcome.ok,
        httpStatus: outcome.status || 0,
        durationMs: Date.now() - t0,
        attempts: outcome.attempts?.length || 1,
        error: outcome.ok ? '' : outcome.error,
        requestBody: requestLogBody(),
        attemptsDetail: attemptsDetailOf(outcome),
        ...(outcome.ok && !stream ? { ttftMs: Date.now() - t0 } : {}),
        ...extra,
      }),
    )
  }

  if (!outcome.ok) {
    logFinal()
    const type = outcome.reason === 'bad-request' ? 'invalid_request_error' : 'api_error'
    return openaiError(outcome.error || '网关调用失败', outcome.status || 502, type)
  }

  const completionId = `chatcmpl-gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const created = Math.floor(Date.now() / 1000)

  // ---------- 非流式 ----------
  if (!stream) {
    const usage = outcome.result.usage || {}
    logFinal({
      responseBody: sanitizeJsonForLog({ content: outcome.result.content }),
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      finishReason: outcome.result.finish_reason || '',
    })
    return json({
      id: completionId,
      object: 'chat.completion',
      created,
      model: modelField,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: outcome.result.content },
          finish_reason: outcome.result.finish_reason || 'stop',
        },
      ],
      ...(usage
        ? {
            usage: {
              prompt_tokens: usage.input_tokens || 0,
              completion_tokens: usage.output_tokens || 0,
              total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
            },
          }
        : {}),
    })
  }

  // ---------- 流式：canonical 事件 → OpenAI chunk ----------
  const encoder = new TextEncoder()
  const chunk = (delta, finishReason = null) =>
    `data: ${JSON.stringify({
      id: completionId,
      object: 'chat.completion.chunk',
      created,
      model: modelField,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`

  // 流式明细：首字/全文/token 统计，流结束后经 waitUntil 落库
  const wrappedEvents = instrumentedEvents(outcome.result.events, t0, (stats) => {
    fireAndForget(
      logGatewayCall(db, {
        uid,
        capability: 'chat_stream',
        groupKey: groupLabel,
        providerSlug: outcome.used.providerSlug,
        modelId: outcome.used.modelId,
        ok: !stats.streamError,
        httpStatus: 200,
        durationMs: Date.now() - t0,
        attempts: outcome.attempts.length,
        error: stats.streamError,
        requestBody: requestLogBody(),
        responseBody: sanitizeJsonForLog({
          content: stats.text,
          ...(stats.reasoning ? { reasoning: stats.reasoning } : {}),
        }),
        ttftMs: stats.ttftMs,
        inputTokens: stats.usage?.input_tokens || 0,
        outputTokens: stats.usage?.output_tokens || 0,
        finishReason: stats.finishReason || (stats.streamError ? 'error' : 'stop'),
        attemptsDetail: attemptsDetailOf(outcome),
      }),
    )
  })

  const streamOut = new ReadableStream({
    async start(controller) {
      let finished = false
      try {
        controller.enqueue(encoder.encode(chunk({ role: 'assistant', content: '' })))
        for await (const ev of wrappedEvents) {
          if (ev.error) {
            // 已提交后的上游中断：不换厂商重放，正常收尾（内容已部分送达）
            break
          }
          if (ev.delta) controller.enqueue(encoder.encode(chunk({ content: ev.delta })))
          if (ev.reasoning) controller.enqueue(encoder.encode(chunk({ reasoning_content: ev.reasoning })))
          if (ev.usage) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: completionId,
                  object: 'chat.completion.chunk',
                  created,
                  model: modelField,
                  choices: [],
                  usage: {
                    prompt_tokens: ev.usage.input_tokens || 0,
                    completion_tokens: ev.usage.output_tokens || 0,
                    total_tokens: (ev.usage.input_tokens || 0) + (ev.usage.output_tokens || 0),
                  },
                })}\n\n`,
              ),
            )
          }
          if (ev.finish) {
            controller.enqueue(encoder.encode(chunk({}, ev.finish)))
            finished = true
          }
        }
        if (!finished) controller.enqueue(encoder.encode(chunk({}, 'stop')))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch {
        try {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch {
          /* 客户端已断开 */
        }
      }
    },
  })

  return new Response(streamOut, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders,
      'X-Gateway-Provider': outcome.used?.providerSlug || '',
      'X-Gateway-Model': outcome.used?.modelId || '',
    },
  })
}

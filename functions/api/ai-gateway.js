// 统一 AI 网关入口（内部 canonical 格式）
// POST /api/ai-gateway
// Body: { capability, group, model, payload, timeout_ms? }
//   - capability: 'chat' | 'chat_stream' | 'image_gen'
//   - group:      调度组 group_key（按候选链自动容灾，推荐用法）
//   - model:      gateway_models.id 直连指定模型（调试用；与 group 二选一，group 优先）
//   - payload:    chat → { messages, max_tokens?, temperature?, top_p?, stop? }
//                 image_gen → { prompt, size? }
//   - timeout_ms: 整链共享总预算（5000~600000，默认 chat 120s / image 300s）
//
// 响应：
//   非流式 { ok:true, data:{...}, meta:{ provider, model, group, attempts, duration_ms } }
//   流式   SSE：data: {"delta"|"reasoning"|"usage"|"finish"|...} 逐事件，结束 data: [DONE]
//          响应头 X-Gateway-Provider / X-Gateway-Model 标记实际命中（或最后尝试）的候选
//
// 调用明细：每次请求写 gateway_logs（出入参脱敏快照 / 首字 ttft / 总耗时 / token /
// 容灾尝试链），流式在流结束后经 waitUntil 落库，不影响响应收口。
//
// 鉴权：需登录（Bearer JWT）。平台 Key 消耗的是后台配置的厂商额度，不对匿名开放。

import { extractUidFromRequest } from './_lib/model-resolver.js'
import {
  runGatewayChat,
  runGatewayImageGen,
  logGatewayCall,
  instrumentedEvents,
  sanitizeJsonForLog,
  GATEWAY_CAPABILITIES,
} from './_lib/gateway/index.js'

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

function sseResponse(events, extraHeaders = {}) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
        }
      } catch {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '流式响应中断' })}\n\n`))
        } catch {
          /* 客户端已断开 */
        }
      } finally {
        try {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch {
          /* 已关闭 */
        }
      }
    },
  })
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders,
      ...extraHeaders,
    },
  })
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const t0 = Date.now()

  // 登录门槛前置（与 /api/ai-proxy 同策略：防匿名枚举/消耗平台 Key）
  const uid = await extractUidFromRequest(request, env)
  if (!uid) {
    return json({ ok: false, error: '请先登录后再使用 AI 网关' }, 401)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: '无效的 JSON 请求体' }, 400)
  }

  const capability = body.capability
  if (!GATEWAY_CAPABILITIES.includes(capability)) {
    return json({ ok: false, error: `capability 只支持 ${GATEWAY_CAPABILITIES.join(' / ')}` }, 400)
  }
  const groupKey = typeof body.group === 'string' ? body.group.trim() : ''
  const modelId = body.model
  if (!groupKey && !modelId) {
    return json({ ok: false, error: 'group 与 model 必填其一' }, 400)
  }

  const defaultTimeout = capability === 'image_gen' ? 300000 : 120000
  let timeoutMs = defaultTimeout
  if (body.timeout_ms != null) {
    const t = Number(body.timeout_ms)
    if (!Number.isFinite(t)) return json({ ok: false, error: 'timeout_ms 非法' }, 400)
    timeoutMs = Math.min(600000, Math.max(5000, Math.floor(t)))
  }

  const db = env.DB
  const groupLabel = groupKey || `model:${modelId}`

  // ============ 调用明细埋点 ============
  // 流式日志依赖流结束后回调，用 waitUntil 保证 Workers 在响应收口后仍完成写入
  const fireAndForget = (p) => {
    try {
      if (typeof context.waitUntil === 'function') context.waitUntil(p)
    } catch {
      /* 非 CF 运行时（单测）忽略 */
    }
  }
  const requestLogBody = () => sanitizeJsonForLog({ capability, group: groupLabel, payload: body.payload })
  const attemptsDetailOf = (outcome) =>
    JSON.stringify(
      (outcome.attempts || []).map((a) => ({
        provider: a.provider,
        model_id: a.model_id,
        status: a.status,
        durationMs: a.durationMs,
        ...(a.error ? { error: a.error } : {}),
      })),
    )
  const lastHitOf = (outcome) => outcome.attempts?.[outcome.attempts.length - 1] || {}

  /** 非流式 / 失败路径统一落明细（流式走 instrumentedEvents 的 onDone） */
  const logFinal = (outcome, extra = {}) => {
    fireAndForget(
      logGatewayCall(db, {
        uid,
        capability,
        groupKey: groupLabel,
        providerSlug: outcome.used?.providerSlug || lastHitOf(outcome).provider || '',
        modelId: outcome.used?.modelId || lastHitOf(outcome).model_id || '',
        ok: !!outcome.ok,
        httpStatus: outcome.status || 0,
        durationMs: Date.now() - t0,
        attempts: outcome.attempts?.length || 1,
        error: outcome.ok ? '' : outcome.error,
        requestBody: requestLogBody(),
        attemptsDetail: attemptsDetailOf(outcome),
        ...(outcome.ok ? { ttftMs: Date.now() - t0 } : {}), // 非流式首字=响应唯一一次到达
        ...extra,
      }),
    )
  }

  try {
    const common = {
      db,
      groupKey: groupKey || undefined,
      modelId: modelId ?? undefined,
      payload: body.payload,
      totalTimeoutMs: timeoutMs,
      externalSignal: request.signal,
    }

    // ---------- 生图 ----------
    if (capability === 'image_gen') {
      const outcome = await runGatewayImageGen(db, common)
      if (!outcome.ok) {
        logFinal(outcome)
        return json({ ok: false, error: outcome.error, meta: { attempts: outcome.attempts } }, outcome.status || 502)
      }
      logFinal(outcome, {
        // data URL 会被 sanitize 占位（不落大体积 base64）
        responseBody: sanitizeJsonForLog({ image_url: outcome.result.image }),
        finishReason: 'stop',
      })
      return json({
        ok: true,
        data: { image_url: outcome.result.image },
        meta: buildMeta(outcome),
      })
    }

    // ---------- 生文 ----------
    const stream = capability === 'chat_stream'
    const outcome = await runGatewayChat(db, { ...common, stream })
    if (!outcome.ok) {
      logFinal(outcome)
      return json({ ok: false, error: outcome.error, meta: { attempts: outcome.attempts } }, outcome.status || 502)
    }
    const meta = buildMeta(outcome)

    if (stream) {
      // 流式：包一层统计（首字/全文/token），流结束后落明细
      const wrapped = instrumentedEvents(outcome.result.events, t0, (stats) => {
        fireAndForget(
          logGatewayCall(db, {
            uid,
            capability,
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
      return sseResponse(wrapped, {
        'X-Gateway-Provider': outcome.used.providerSlug,
        'X-Gateway-Model': outcome.used.modelId,
      })
    }

    const usage = outcome.result.usage || {}
    logFinal(outcome, {
      responseBody: sanitizeJsonForLog({ content: outcome.result.content }),
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      finishReason: outcome.result.finish_reason || '',
    })
    return json({
      ok: true,
      data: {
        content: outcome.result.content,
        finish_reason: outcome.result.finish_reason,
        usage: outcome.result.usage,
      },
      meta,
    })
  } catch (error) {
    console.error('[ai-gateway] error:', error)
    return json({ ok: false, error: '调用失败，请稍后重试' }, 500)
  }
}

function buildMeta(outcome) {
  return {
    provider: outcome.used?.providerSlug || '',
    model: outcome.used?.modelId || '',
    group: outcome.group?.key || '',
    attempts: outcome.attempts || [],
    duration_ms: outcome.totalDurationMs || 0,
  }
}

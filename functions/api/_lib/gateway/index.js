// 统一 AI 网关 - 核心编排
// 对外（端点层）暴露：
//   runGatewayChat      生文（stream=false 返回归一化 JSON；stream=true 返回事件异步迭代器）
//   runGatewayImageGen  生图（openai images/generations + gemini 原生生图）
//   probeProvider       厂商连通性探测（后台「测试连接」，单候选不走链）
//   logGatewayCall      gateway_logs 埋点（失败不抛错）
//
// 流式容灾语义：拉到上游首个 SSE 事件即视为「已提交」，此前失败可切换下一候选；
// 已提交后中断只能结束流（不换厂商重放，避免内容拼接错乱/重复计费）。

import { ADAPTERS, PROTOCOLS, normalizeBaseUrl } from './adapters.js'
import { resolveGatewayChain, runChainWithFailover, isFailoverableStatus } from './scheduler.js'

// 入口支持的 capability（注册表可存 image_edit/video，运行时随 adapter 扩充再放开）
export const GATEWAY_CAPABILITIES = ['chat', 'chat_stream', 'image_gen']

const ROLES = ['system', 'user', 'assistant']
const MAX_MESSAGES = 200
const MAX_CONTENT_CHARS = 200000

// ============ payload 归一化 ============

/**
 * 校验并归一化 chat payload
 * @returns {{ok:true, value:object} | {ok:false, error:string}}
 */
export function normalizeChatPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'payload 必须是对象' }
  const messages = payload.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: 'messages 必须是非空数组' }
  }
  if (messages.length > MAX_MESSAGES) return { ok: false, error: `messages 超过上限 ${MAX_MESSAGES} 条` }

  let totalChars = 0
  for (const m of messages) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'messages 每项必须是对象' }
    if (!ROLES.includes(m.role)) return { ok: false, error: `role 只能是 ${ROLES.join(' / ')}` }
    if (typeof m.content === 'string') {
      totalChars += m.content.length
      continue
    }
    if (!Array.isArray(m.content)) return { ok: false, error: 'content 必须是字符串或分块数组' }
    for (const p of m.content) {
      if (!p || typeof p !== 'object') return { ok: false, error: 'content 分块格式非法' }
      if (p.type === 'text') {
        if (typeof p.text !== 'string') return { ok: false, error: 'text 分块缺少 text 字段' }
        totalChars += p.text.length
      } else if (p.type === 'image_url') {
        const url = p.image_url?.url
        if (typeof url !== 'string' || !url) return { ok: false, error: 'image_url 分块缺少 url' }
      } else {
        return { ok: false, error: 'content 分块 type 只支持 text / image_url' }
      }
    }
  }
  if (totalChars > MAX_CONTENT_CHARS) return { ok: false, error: '文本内容过长' }

  const value = { messages }
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  const maxTokens = num(payload.max_tokens)
  if (maxTokens !== undefined) {
    if (maxTokens < 1 || maxTokens > 200000) return { ok: false, error: 'max_tokens 范围 1~200000' }
    value.max_tokens = Math.floor(maxTokens)
  }
  const temperature = num(payload.temperature)
  if (temperature !== undefined) {
    if (temperature < 0 || temperature > 2) return { ok: false, error: 'temperature 范围 0~2' }
    value.temperature = temperature
  }
  const topP = num(payload.top_p)
  if (topP !== undefined) {
    if (topP < 0 || topP > 1) return { ok: false, error: 'top_p 范围 0~1' }
    value.top_p = topP
  }
  if (payload.stop !== undefined && payload.stop !== null) {
    const stop = Array.isArray(payload.stop) ? payload.stop : [payload.stop]
    if (stop.some((s) => typeof s !== 'string' || !s)) return { ok: false, error: 'stop 必须是非空字符串数组' }
    if (stop.length > 4) return { ok: false, error: 'stop 最多 4 项' }
    value.stop = stop.slice(0, 4)
  }
  return { ok: true, value }
}

// ============ SSE 解析 ============

/** 读取 SSE body，逐个 yield 出 data: 行解析后的 JSON（[DONE] 与解析失败跳过） */
async function* sseJsonGenerator(reader) {
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const s = line.trim()
        if (!s.startsWith('data:')) continue
        const data = s.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          yield JSON.parse(data)
        } catch {
          // 非 JSON 行忽略
        }
      }
    }
  } finally {
    try {
      // errored 流的 cancel() 会以 storedError 拒绝，必须 await 让 catch 接住，
      // 否则产生 unhandled rejection（Workers 日志噪音/严格模式风险）
      await reader.cancel()
    } catch {
      /* 上游已关 */
    }
  }
}

/** 已提交后的流：继续拉 source，经 adapter 转成 canonical 事件；中途异常 → error 事件收尾 */
function committedEventStream(firstEvent, source, adapter) {
  return {
    [Symbol.asyncIterator]() {
      let yieldedFirst = false
      let failed = false
      return {
        async next() {
          if (!yieldedFirst) {
            yieldedFirst = true
            if (firstEvent) return { value: firstEvent, done: false }
          }
          while (true) {
            // 注意：终止事件（error）必须以 done:false 发出——for await 会丢弃
            // done:true 结果上的 value，挂在 done:true 上 = 消费方永远收不到
            if (failed) return { done: true }
            let r
            try {
              r = await source.next()
            } catch (err) {
              failed = true
              return {
                value: { error: `流式响应中断: ${String(err?.message || err).slice(0, 200)}`, finish: 'error' },
                done: false,
              }
            }
            if (r.done) return { done: true }
            const ev = adapter.extractStreamEvent(r.value)
            if (ev) return { value: ev, done: false }
          }
        },
      }
    },
  }
}

// ============ attempt 构造 ============

async function fetchOrNetworkError(fetchImpl, url, init) {
  try {
    return { res: await fetchImpl(url, init) }
  } catch (err) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(err?.message || '')
    return {
      failure: { ok: false, failoverable: true, status: 0, error: isAbort ? '上游调用超时' : err?.message || '网络错误' },
    }
  }
}

async function badResponse(res) {
  const text = await res.text().catch(() => '')
  return {
    ok: false,
    failoverable: isFailoverableStatus(res.status),
    status: res.status,
    error: `上游错误 ${res.status}: ${text.slice(0, 300)}`,
  }
}

const makeChatJsonAttempt = (canonical, fetchImpl) => async (entry, signal) => {
  const adapter = ADAPTERS[entry.protocol]
  const { url, headers, body } = adapter.buildChat(entry, canonical, { stream: false })
  const { res, failure } = await fetchOrNetworkError(fetchImpl, url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (failure) return failure
  if (!res.ok) return badResponse(res)

  let json
  try {
    json = await res.json()
  } catch {
    return { ok: false, failoverable: true, status: res.status, error: '上游返回非 JSON 响应' }
  }
  const parsed = adapter.parseChat(json)
  if (!parsed || parsed.content == null || parsed.content === '') {
    return { ok: false, failoverable: true, status: res.status, error: '上游返回空内容' }
  }
  return {
    ok: true,
    content: parsed.content,
    finish_reason: parsed.finish_reason || 'stop',
    usage: parsed.usage || null,
  }
}

const makeChatStreamAttempt = (canonical, fetchImpl) => async (entry, signal) => {
  const adapter = ADAPTERS[entry.protocol]
  const { url, headers, body } = adapter.buildChat(entry, canonical, { stream: true })
  const { res, failure } = await fetchOrNetworkError(fetchImpl, url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (failure) return failure
  if (!res.ok) return badResponse(res)
  if (!res.body) return { ok: false, failoverable: true, status: res.status, error: '上游未返回流式响应体' }

  // 首事件前可容灾：拉到首个 SSE 事件即提交
  const source = sseJsonGenerator(res.body.getReader())
  let first
  try {
    first = await source.next()
  } catch (err) {
    return { ok: false, failoverable: true, status: res.status, error: `读取上游流失败: ${String(err?.message || err).slice(0, 200)}` }
  }
  if (first.done) {
    return { ok: false, failoverable: true, status: res.status, error: '上游未返回任何流式事件' }
  }
  return { ok: true, events: committedEventStream(adapter.extractStreamEvent(first.value), source, adapter) }
}

const makeImageGenAttempt = (payload, fetchImpl) => async (entry, signal) => {
  const adapter = ADAPTERS[entry.protocol]
  const { url, headers, body } = adapter.buildImageGen(entry, payload)
  const { res, failure } = await fetchOrNetworkError(fetchImpl, url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (failure) return failure
  if (!res.ok) return badResponse(res)

  let json
  try {
    json = await res.json()
  } catch {
    return { ok: false, failoverable: true, status: res.status, error: '上游返回非 JSON 响应' }
  }
  const image = adapter.parseImageGen(json)
  if (!image) {
    return { ok: false, failoverable: true, status: res.status, error: '上游返回成功但未找到图片数据' }
  }
  return { ok: true, image }
}

// ============ 高层入口 ============

/**
 * 生文（chat / chat_stream 统一入口）
 * @param {object} opts { db, groupKey, modelId, payload, stream, totalTimeoutMs, externalSignal, fetchImpl }
 * @returns 非流式成功：{ ok:true, result:{content, finish_reason, usage}, used, attempts, skipped, group, totalDurationMs }
 *          流式成功：  { ok:true, result:{events}, used, attempts, skipped, group, totalDurationMs }
 *          失败：      { ok:false, reason, status, error, attempts, skipped, group, totalDurationMs }
 */
export async function runGatewayChat(db, opts = {}) {
  const {
    groupKey,
    modelId,
    payload,
    stream = false,
    totalTimeoutMs = 120000,
    externalSignal = null,
    fetchImpl = fetch,
  } = opts

  const norm = normalizeChatPayload(payload)
  if (!norm.ok) {
    return { ok: false, reason: 'bad-request', status: 400, error: norm.error, attempts: [], skipped: [], group: null, totalDurationMs: 0 }
  }

  let resolved
  try {
    resolved = await resolveGatewayChain(db, { groupKey, modelId, capability: 'chat' })
  } catch (err) {
    console.error('[ai-gateway] resolveGatewayChain error:', err)
    return { ok: false, reason: 'internal', status: 500, error: '调度组解析失败，请稍后重试', attempts: [], skipped: [], group: null, totalDurationMs: 0 }
  }
  if (!resolved.chain.length) {
    return { ok: false, reason: 'no-upstream', status: 503, error: describeSkipped(resolved.skipped), attempts: [], ...resolved, totalDurationMs: 0 }
  }

  const attempt = stream ? makeChatStreamAttempt(norm.value, fetchImpl) : makeChatJsonAttempt(norm.value, fetchImpl)
  const outcome = await runChainWithFailover(resolved.chain, {
    attempt,
    totalTimeoutMs,
    externalSignal,
  })
  return { ...outcome, skipped: resolved.skipped, group: resolved.group }
}

/**
 * 生图
 * @param {object} opts { db, groupKey, modelId, payload:{prompt,size?}, totalTimeoutMs=300000, ... }
 */
export async function runGatewayImageGen(db, opts = {}) {
  const { groupKey, modelId, payload, totalTimeoutMs = 300000, externalSignal = null, fetchImpl = fetch } = opts

  const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : ''
  if (!prompt) {
    return { ok: false, reason: 'bad-request', status: 400, error: 'prompt 必填', attempts: [], skipped: [], group: null, totalDurationMs: 0 }
  }
  if (prompt.length > 8000) {
    return { ok: false, reason: 'bad-request', status: 400, error: 'prompt 过长（≤8000 字符）', attempts: [], skipped: [], group: null, totalDurationMs: 0 }
  }
  const size = typeof payload?.size === 'string' && /^\d{2,5}x\d{2,5}$/.test(payload.size) ? payload.size : '1024x1024'

  let resolved
  try {
    resolved = await resolveGatewayChain(db, { groupKey, modelId, capability: 'image_gen' })
  } catch (err) {
    console.error('[ai-gateway] resolveGatewayChain error:', err)
    return { ok: false, reason: 'internal', status: 500, error: '调度组解析失败，请稍后重试', attempts: [], skipped: [], group: null, totalDurationMs: 0 }
  }
  if (!resolved.chain.length) {
    return { ok: false, reason: 'no-upstream', status: 503, error: describeSkipped(resolved.skipped), attempts: [], ...resolved, totalDurationMs: 0 }
  }

  const outcome = await runChainWithFailover(resolved.chain, {
    attempt: makeImageGenAttempt({ prompt, size }, fetchImpl),
    totalTimeoutMs,
    externalSignal,
  })
  return { ...outcome, skipped: resolved.skipped, group: resolved.group }
}

/**
 * 厂商连通性探测（后台「测试连接」）：单候选直连，不走调度链
 * @param {object} opts { providerId, modelId(厂商侧), timeoutMs=30000, fetchImpl }
 */
export async function probeProvider(db, opts = {}) {
  const { providerId, modelId, timeoutMs = 30000, fetchImpl = fetch } = opts
  const t0 = Date.now()
  let p
  try {
    p = await db
      .prepare('SELECT id, slug, protocol, base_url, api_key, status FROM gateway_providers WHERE id = ?')
      .bind(providerId)
      .first()
  } catch {
    p = null
  }
  if (!p) return { ok: false, latencyMs: 0, error: '厂商不存在' }
  if (p.status !== 1) return { ok: false, latencyMs: 0, error: '厂商已停用' }
  if (!PROTOCOLS.includes(p.protocol)) return { ok: false, latencyMs: 0, error: `协议非法: ${p.protocol}` }
  if (!(p.api_key || '').trim()) return { ok: false, latencyMs: 0, error: '未配置 API Key' }
  if (!modelId || !/^[\w.-]{1,128}$/.test(modelId)) return { ok: false, latencyMs: 0, error: 'model_id 非法' }

  const entry = {
    providerSlug: p.slug,
    protocol: p.protocol,
    baseUrl: normalizeBaseUrl(p.base_url),
    apiKey: p.api_key.trim(),
    modelId,
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let result
  try {
    result = await makeChatJsonAttempt(
      { messages: [{ role: 'user', content: '连通性测试，请只回复：OK' }], max_tokens: 16 },
      fetchImpl,
    )(entry, controller.signal)
  } finally {
    clearTimeout(timer)
  }
  const latencyMs = Date.now() - t0
  if (result.ok) {
    return { ok: true, latencyMs, reply: String(result.content).slice(0, 200), protocol: p.protocol }
  }
  return { ok: false, latencyMs, status: result.status || 0, error: String(result.error || '探测失败').slice(0, 300) }
}

/** skipped 摘要 → 给前端的一句话错误 */
export function describeSkipped(skipped) {
  if (!Array.isArray(skipped) || skipped.length === 0) return '无可用上游'
  const parts = skipped.slice(0, 5).map((s) => [s.provider, s.model, s.reason].filter(Boolean).join(': '))
  return `无可用上游（${parts.join('；')}）`
}

// ============ 调用明细日志（出入参 / 首字 / token） ============

/**
 * 入参脱敏序列化（落 gateway_logs.request_body / response_body 用）：
 *   - data URL（base64 图片等）替换为 `data:<mime>;base64,<N chars>` 占位
 *   - 超长整体截断（默认 16KB），尾部标注原始长度
 */
export function sanitizeJsonForLog(value, maxLen = 16384) {
  let json
  try {
    json = JSON.stringify(value, (_k, v) => {
      if (typeof v === 'string' && v.startsWith('data:') && v.includes('base64,')) {
        const semi = v.indexOf(';')
        const mime = semi > 5 ? v.slice(5, semi) : ''
        return `data:${mime};base64,<${v.length} chars>`
      }
      return v
    })
  } catch {
    return '(序列化失败)'
  }
  if (typeof json !== 'string') return String(json)
  if (json.length > maxLen) return `${json.slice(0, maxLen)}…(截断，共 ${json.length} 字符)`
  return json
}

/**
 * 包装 canonical 事件流：逐个透传，同时累计首字时间 / 输出全文 / token 用量 / 结束原因，
 * 流结束（正常 / 异常 / 消费方提前 break）后回调 onDone(stats)。
 * 端点用它在 SSE 泵送完成后写 gateway_logs 明细。
 * stats: { ttftMs, text, reasoning, usage: {input_tokens, output_tokens}|null, finishReason, streamError }
 */
export function instrumentedEvents(events, t0, onDone) {
  let ttftMs = 0
  let text = ''
  let reasoning = ''
  let usage = null
  let finishReason = null
  let streamError = ''
  let notified = false
  const notify = () => {
    if (notified) return
    notified = true
    try {
      onDone({ ttftMs, text, reasoning, usage, finishReason, streamError })
    } catch (err) {
      console.error('[ai-gateway] instrumentedEvents onDone error:', err)
    }
  }
  // 入参可能是 async generator（自带 .next）或 { [Symbol.asyncIterator] } 对象
  // （committedEventStream 产物），先归一化成 iterator 再用
  const toIterator = (src) => {
    if (src && typeof src[Symbol.asyncIterator] === 'function') return src[Symbol.asyncIterator]()
    return src
  }
  return {
    [Symbol.asyncIterator]() {
      const it = toIterator(events)
      return {
        async next() {
          let r
          try {
            r = await it.next()
          } catch (err) {
            streamError = String(err?.message || err).slice(0, 300)
            notify()
            throw err
          }
          if (r.done) {
            notify()
            return r
          }
          const ev = r.value || {}
          // 首字时间：第一个 delta 或 reasoning 事件
          if (!ttftMs && (ev.delta || ev.reasoning)) ttftMs = Date.now() - t0
          if (ev.delta) text += ev.delta
          if (ev.reasoning) reasoning += ev.reasoning
          if (ev.usage) usage = { ...(usage || {}), ...ev.usage }
          if (ev.finish) finishReason = ev.finish
          if (ev.error) streamError = String(ev.error).slice(0, 300)
          return r
        },
        async return(v) {
          notify()
          return typeof it.return === 'function' ? it.return(v) : { done: true, value: v }
        },
        async throw(e) {
          if (!streamError) streamError = String(e?.message || e).slice(0, 300)
          notify()
          return typeof it.throw === 'function' ? it.throw(e) : Promise.reject(e)
        },
      }
    },
  }
}

/** gateway_logs 埋点：失败静默（日志不影响主链路） */
export async function logGatewayCall(db, row) {
  try {
    await db
      .prepare(
        `INSERT INTO gateway_logs
         (uid, capability, group_key, provider_slug, model_id, ok, http_status, duration_ms, attempts, error,
          request_body, response_body, ttft_ms, input_tokens, output_tokens, finish_reason, attempts_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.uid || '',
        row.capability || '',
        row.groupKey || '',
        row.providerSlug || '',
        row.modelId || '',
        row.ok ? 1 : 0,
        row.httpStatus || 0,
        row.durationMs || 0,
        row.attempts || 1,
        String(row.error || '').slice(0, 500),
        String(row.requestBody || '').slice(0, 65535),
        String(row.responseBody || '').slice(0, 65535),
        Math.max(0, Math.min(row.ttftMs || 0, 86400000)),
        Math.max(0, Math.min(row.inputTokens || 0, 2147483647)),
        Math.max(0, Math.min(row.outputTokens || 0, 2147483647)),
        String(row.finishReason || '').slice(0, 32),
        String(row.attemptsDetail || '').slice(0, 16384),
      )
      .run()
  } catch (err) {
    console.error('[ai-gateway] logGatewayCall failed:', err)
  }
}

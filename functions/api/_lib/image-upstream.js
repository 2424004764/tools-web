// 生图上游共享库：可配置厂商链（手动切换 / 自动容灾）
// 被 /api/ai-image-edit 与 /api/ai-outfit 共用。
//
// 链解析：tool_models.upstreams（JSON 有序数组）→ ai_providers 按 slug 取 base_url / api_key
//   每项 { "provider": "bafang", "model_id": "gpt-image-2-1k", "style": "auto" }
//     - provider：ai_providers.slug（如 'bafang'）
//     - model_id：厂商侧真实模型 ID（拼上游 URL / 请求体用，与 tool_models.model_key 解耦）
//     - style：'auto'（gemini- 前缀 → Google 原生，否则 OpenAI 兼容）/ 'openai' / 'gemini'
//   未配置 / 解析失败 / 全部项被跳过 → legacy 回退：https://bafang.me + env.BAFANG_API_KEY
//   （与改造前行为完全一致；env key 缺失时返回空链，由调用方报「服务未配置」）
//
// API Key 优先级：ai_providers.api_key →（仅 bafang，迁移过渡）env.BAFANG_API_KEY → 该项被跳过
//
// failover 条件（只有「换厂商才有意义」的错误才切换）：
//   网络/超时（无 HTTP 状态）、5xx、429 限流、401/403（key 失效欠费）、404（对方无此模型）、
//   200 但解析不出图片
//   400/422 参数错误不切换（换哪家都一样，白花时间）
//
// 超时预算：runWithFailover 整链共享 totalTimeoutMs（默认 600s，与改造前单次一致），
// 每次尝试用剩余预算，避免 failover 后总时长翻倍。

export const LEGACY_BAFANG_BASE_URL = 'https://bafang.me'

// model_id 会拼进上游 URL（gemini 分支 /v1beta/models/{model}:generateContent）并落库，
// 只放行常规模型名（字母数字开头，可含 . _ - 和中文——存量 model_key 如 'gpt-image2-超分'），
// 杜绝 ../、?、# 等注入。嵌入 URL 时另做 encodeURIComponent。
export const UPSTREAM_MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-\u4e00-\u9fa5]{0,63}$/

export const UPSTREAM_STYLES = ['auto', 'openai', 'gemini']

/** style 解析：显式 openai/gemini 优先，auto（含未传）按 model_id 前缀判断 */
export function resolveStyle(style, modelId) {
  if (style === 'openai' || style === 'gemini') return style
  return typeof modelId === 'string' && modelId.toLowerCase().startsWith('gemini-')
    ? 'gemini'
    : 'openai'
}

/** 哪些 HTTP 状态值得切换厂商（无状态码 / 0 = 网络层错误，恒为可切换） */
export function isFailoverableStatus(status) {
  if (!Number.isInteger(status) || status <= 0) return true
  if (status >= 500) return true
  // 401/403 key 失效、402 余额不足（OpenAI 兼容网关常用）、404 对方无此模型、408 请求超时、429 限流
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 408 || status === 429
}

/**
 * 解析并规范化 upstreams JSON 字符串
 * @returns {Array<{provider:string,model_id:string,style:string,extra_body?:object}>|null} 非法/空返回 null
 */
export function parseUpstreamsJson(str) {
  if (!str || typeof str !== 'string') return null
  try {
    const arr = JSON.parse(str)
    if (!Array.isArray(arr) || arr.length === 0) return null
    const out = []
    for (const e of arr) {
      if (!e || typeof e !== 'object') return null
      const provider = typeof e.provider === 'string' ? e.provider.trim() : ''
      const modelId = typeof e.model_id === 'string' ? e.model_id.trim() : ''
      if (!provider || !modelId) return null
      const entry = { provider, model_id: modelId, style: UPSTREAM_STYLES.includes(e.style) ? e.style : 'auto' }
      const extra = sanitizeExtraBody(e.extra_body)
      if (extra) entry.extra_body = extra
      out.push(entry)
    }
    return out
  } catch {
    return null
  }
}

// ============ extra_body（链项附加请求参数） ============
// 用途：某些模型支持附加参数（如 OpenAI 系 gpt-image 动图模型：
//   {"output_format":"gif","frame_count":9,"frame_duration_ms":200,"quality":"high"}）。
// 合并规则（callImageUpstream）：
//   - openai JSON 分支：浅合并进请求体 {model, prompt, size, ...extra_body}
//   - openai form-data 分支：逐项 append 到表单
//   - gemini 分支：忽略（Google 原生格式无对应概念，如需映射请配置新 style）

const EXTRA_BODY_KEY_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

/** 校验/规范化 extra_body：必须是 ≤10 键的扁平对象，值为 string/number/boolean；非法返回 null */
export function sanitizeExtraBody(raw) {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  const entries = Object.entries(raw)
  if (entries.length === 0 || entries.length > 10) return null
  const out = {}
  for (const [k, v] of entries) {
    if (!EXTRA_BODY_KEY_PATTERN.test(k)) return null
    const t = typeof v
    if (t !== 'string' && t !== 'number' && t !== 'boolean') return null
    if (t === 'string' && v.length > 200) return null
    out[k] = v
  }
  return out
}

/**
 * admin API 写入校验（POST/PUT tool_models.upstreams 用）
 * @param {*} raw 请求体里的 upstreams 字段（null=清除，数组=配置）
 * @param {D1Database} db 用于校验 provider 存在
 * @returns {Promise<{ok:true,value:Array|null}|{ok:false,error:string}>}
 */
export async function validateUpstreamsForSave(db, raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null }
  }
  if (!Array.isArray(raw)) return { ok: false, error: 'upstreams 必须是数组' }
  if (raw.length === 0) return { ok: true, value: null } // 空数组 = 清空 → 走 legacy 回退
  if (raw.length > 5) return { ok: false, error: 'upstreams 最多 5 项' }

  const normalized = []
  const slugs = new Set()
  for (const e of raw) {
    if (!e || typeof e !== 'object') return { ok: false, error: 'upstreams 每项必须是对象' }
    const provider = String(e.provider || '').trim()
    const modelId = String(e.model_id || '').trim()
    const style = e.style || 'auto'
    if (!provider) return { ok: false, error: 'provider 必填' }
    if (!UPSTREAM_MODEL_ID_PATTERN.test(modelId)) {
      return { ok: false, error: `model_id 格式非法: ${modelId}` }
    }
    if (!UPSTREAM_STYLES.includes(style)) {
      return { ok: false, error: `style 只能是 ${UPSTREAM_STYLES.join(' / ')}` }
    }
    // 附加请求参数（如 output_format=gif / frame_count / quality），可选
    let extra = null
    if (e.extra_body !== undefined && e.extra_body !== null) {
      extra = sanitizeExtraBody(e.extra_body)
      if (!extra) {
        return { ok: false, error: `第 ${normalized.length + 1} 项 extra_body 非法：需 ≤10 键的扁平对象，值为字符串/数字/布尔` }
      }
    }
    slugs.add(provider)
    normalized.push(extra ? { provider, model_id: modelId, style, extra_body: extra } : { provider, model_id: modelId, style })
  }

  // 批量校验 provider 存在且启用
  const ph = [...slugs].map(() => '?').join(',')
  let rows = []
  try {
    const res = await db
      .prepare(`SELECT slug FROM ai_providers WHERE status = 1 AND slug IN (${ph})`)
      .bind(...slugs)
      .all()
    rows = res.results || []
  } catch (err) {
    console.error('validateUpstreamsForSave 查询 ai_providers 失败:', err)
    return { ok: false, error: '校验厂商失败，请稍后重试' }
  }
  const valid = new Set(rows.map((r) => r.slug))
  for (const s of slugs) {
    if (!valid.has(s)) return { ok: false, error: `厂商不存在或已停用: ${s}` }
  }
  return { ok: true, value: normalized }
}

/**
 * 解析可执行的上游链
 * @param {D1Database} db
 * @param {string} toolUrl 如 '/ai-image-edit/'
 * @param {string} modelKey tool_models.model_key（legacy 回退时直接当 model_id 用）
 * @param {object} env CF env（读 BAFANG_API_KEY 兜底）
 * @param {{rawUpstreams?:string|null}} [preloaded] 调用方已在 tool_models 查过 upstreams 时透传，省一次查询
 * @returns {Promise<{chain:Array<{provider,baseUrl,apiKey,modelId,style}>,legacy:boolean,skipped:Array}>}
 *   chain 为空数组 = 完全没有可用上游（含 env key 缺失的 legacy 场景），调用方应报「服务未配置」
 */
export async function resolveUpstreamChain(db, toolUrl, modelKey, env, preloaded = {}) {
  // 1. 取链配置（优先用调用方透传的查询结果）
  let raw = preloaded?.rawUpstreams
  if (raw === undefined) {
    try {
      // model_key 允许在同工具下重复（migration 112）：这里是没有 preloaded 的兜底路径，
      // 调用方（ai-image-edit / ai-outfit）已按行 id 精确解析并透传 rawUpstreams；
      // 走到本查询时取 sort_order 最前的一行，保证确定性
      const row = await db
        .prepare(
          `SELECT upstreams FROM tool_models
           WHERE tool_url = ? AND model_key = ? AND is_enabled = 1
           ORDER BY sort_order ASC, id ASC LIMIT 1`,
        )
        .bind(toolUrl, modelKey)
        .first()
      raw = row?.upstreams || null
    } catch {
      raw = null
    }
  }

  const buildLegacy = () => {
    const envKey = env?.BAFANG_API_KEY || ''
    // env key 也没配 → 空链，让调用方走「服务未配置」（与改造前提前 500 的行为一致）
    if (!envKey) return { chain: [], legacy: true, skipped: [] }
    return {
      chain: [{
        provider: 'bafang',
        baseUrl: LEGACY_BAFANG_BASE_URL,
        apiKey: envKey,
        modelId: modelKey,
        style: 'auto',
      }],
      legacy: true,
      skipped: [],
    }
  }

  const entries = parseUpstreamsJson(raw)
  if (!entries) return buildLegacy()

  // 2. 按 slug 批量查启用厂商
  const slugs = [...new Set(entries.map((e) => e.provider))]
  const ph = slugs.map(() => '?').join(',')
  let providers = []
  try {
    const res = await db
      .prepare(`SELECT slug, base_url, api_key FROM ai_providers WHERE status = 1 AND slug IN (${ph})`)
      .bind(...slugs)
      .all()
    providers = res.results || []
  } catch {
    providers = []
  }
  const pmap = new Map(providers.map((p) => [p.slug, p]))

  // 3. 逐项校验拼链：厂商存在 + model_id 格式合法 + 有 key
  const chain = []
  const skipped = []
  for (const e of entries) {
    const p = pmap.get(e.provider)
    if (!p?.base_url) {
      skipped.push({ provider: e.provider, reason: '厂商不存在或已停用' })
      continue
    }
    if (!UPSTREAM_MODEL_ID_PATTERN.test(e.model_id)) {
      skipped.push({ provider: e.provider, reason: 'model_id 格式非法' })
      continue
    }
    // key 优先级：D1 厂商 key →（仅 bafang）env 兜底（迁移过渡期）
    const apiKey = (p.api_key || '').trim() || (e.provider === 'bafang' ? (env?.BAFANG_API_KEY || '') : '')
    if (!apiKey) {
      skipped.push({ provider: e.provider, reason: '未配置 API Key' })
      continue
    }
    chain.push({
      provider: e.provider,
      baseUrl: p.base_url.replace(/\/+$/, ''),
      apiKey,
      modelId: e.model_id,
      style: e.style,
      ...(e.extra_body ? { extraBody: e.extra_body } : {}),
    })
  }

  if (skipped.length) {
    console.warn('[image-upstream] 链上有项被跳过:', JSON.stringify(skipped))
  }

  // 全部被跳过 → legacy 回退保可用性（旧行为 = bafang + env key），skipped 信息保留供日志
  if (chain.length === 0) {
    const legacyResult = buildLegacy()
    if (legacyResult.chain.length) {
      console.warn('[image-upstream] 配置的链全部不可用，回退 legacy bafang')
    }
    return { ...legacyResult, skipped }
  }
  return { chain, legacy: false, skipped }
}

// ============ 请求构造 / 响应提取（原两个端点各自一份，现收拢） ============

/** 前端 size 字符串 → Gemini aspectRatio */
export function mapSizeToAspectRatio(size) {
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

/** 把 File 读成 base64 字符串（不带 data: 前缀） */
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
 * 构造 Gemini generateContent 请求体。
 * parts 顺序：[{ text: prompt }, ...imageFiles（按传入顺序，每张一段 inline_data）]
 * 固定 responseModalities: ['IMAGE']，imageSize 默认 '1K'（生成速度快、积分低）
 */
export async function buildGeminiRequestBody({ prompt, imageFiles = [], aspectRatio, imageSize = '1K' }) {
  const parts = [{ text: prompt }]
  for (const file of imageFiles) {
    const b64 = await fileToBase64(file)
    parts.push({
      inline_data: {
        mime_type: file.type || 'image/png',
        data: b64,
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

/**
 * 从 Gemini generateContent 响应里提取图片
 * 遍历 candidates[0].content.parts[]，找第一个有 inline_data 的部分
 */
export function extractImageFromGeminiResponse(data) {
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

/** base64 魔数嗅探真实图片格式（上游可能返回 gif/webp/jpeg，不能写死 png） */
export function sniffB64Mime(b64) {
  const s = String(b64 || '')
  if (s.startsWith('R0lGOD')) return 'image/gif'      // GIF8
  if (s.startsWith('UklGR')) return 'image/webp'     // RIFF
  if (s.startsWith('/9j/')) return 'image/jpeg'      // FF D8 FF
  if (s.startsWith('iVBOR')) return 'image/png'      // 89 50 4E 47
  return 'image/png'
}

/** 从 images/edits / images/generations 响应里提取图片 URL/dataURL */
export function extractImageFromEditsResponse(data) {
  if (data?.data?.[0]?.url) return data.data[0].url
  if (data?.data?.[0]?.b64_json) {
    return `data:${sniffB64Mime(data.data[0].b64_json)};base64,` + data.data[0].b64_json
  }
  if (data?.url) return data.url
  if (Array.isArray(data?.data) && data.data[0]?.url) return data.data[0].url
  return ''
}

/**
 * 调用单个上游（不感知 failover，只报告本次结果）
 * @param {{provider,baseUrl,apiKey,modelId,style}} entry
 * @param {{prompt:string,imageFiles:File[],size:string,signal?:AbortSignal}} opts
 * @param {typeof fetch} [fetchImpl] 可注入 fetch（单测用）
 * @returns {Promise<{ok:true,imageUrl:string,status:number,data:object}
 *   |{ok:false,failoverable:boolean,status:number,error:string,data?:object}>}
 */
export async function callImageUpstream(entry, opts = {}, fetchImpl = fetch) {
  const { prompt, imageFiles = [], size = '1024x1024', signal } = opts
  const style = resolveStyle(entry.style, entry.modelId)

  let path, init
  if (style === 'gemini') {
    // Gemini 走 Google 原生 API：POST /v1beta/models/{model}:generateContent
    const geminiBody = await buildGeminiRequestBody({
      prompt,
      imageFiles,
      aspectRatio: mapSizeToAspectRatio(size),
    })
    path = `/v1beta/models/${encodeURIComponent(entry.modelId)}:generateContent`
    init = {
      method: 'POST',
      headers: {
        'x-goog-api-key': entry.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiBody),
      signal,
    }
  } else if (imageFiles.length > 0) {
    // OpenAI 风格图生图：POST /v1/images/edits（form-data）
    // 多张图都按 'image' 字段提交，OpenAI 兼容端点按位置顺序处理；
    // extra_body 逐项并入表单（如 output_format / frame_count 等附加参数）
    const form = new FormData()
    form.append('model', entry.modelId)
    form.append('size', size)
    form.append('prompt', prompt)
    for (const [k, v] of Object.entries(entry.extraBody || {})) {
      form.append(k, String(v))
    }
    for (const file of imageFiles) {
      form.append('image', file)
    }
    path = '/v1/images/edits'
    init = {
      method: 'POST',
      headers: { Authorization: `Bearer ${entry.apiKey}` },
      body: form,
      signal,
    }
  } else {
    // OpenAI 风格文生图：POST /v1/images/generations（application/json）
    // extra_body 先展开、基础字段（model/prompt/size）后写入，附加参数无法覆盖基础语义
    path = '/v1/images/generations'
    init = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${entry.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...entry.extraBody, model: entry.modelId, prompt, size }),
      signal,
    }
  }

  let response
  const fullUrl = `${entry.baseUrl}${path}`
  try {
    response = await fetchImpl(fullUrl, init)
  } catch (err) {
    // 网络层失败（含 AbortError：整链共享预算超时 / 客户端断开）
    const isAbort = err?.name === 'AbortError' || /abort/i.test(err?.message || '')
    return {
      ok: false,
      failoverable: true,
      status: 0,
      url: fullUrl,
      error: isAbort ? '上游调用超时' : (err?.message || '网络错误'),
    }
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    return {
      ok: false,
      failoverable: isFailoverableStatus(response.status),
      status: response.status,
      url: fullUrl,
      error: `上游错误 ${response.status}: ${errText.slice(0, 300)}`,
    }
  }

  let data
  try {
    data = await response.json()
  } catch {
    return { ok: false, failoverable: true, status: response.status, url: fullUrl, error: '上游返回非 JSON 响应' }
  }

  const imageUrl = style === 'gemini'
    ? extractImageFromGeminiResponse(data)
    : extractImageFromEditsResponse(data)
  if (!imageUrl) {
    console.error('[image-upstream] 上游 200 但未找到图片数据:', JSON.stringify(data).slice(0, 500))
    return { ok: false, failoverable: true, status: response.status, url: fullUrl, error: '上游返回成功但未找到图片数据', data }
  }
  return { ok: true, imageUrl, status: response.status, url: fullUrl, data }
}

/**
 * 按链顺序调用上游，失败自动切换（只切「换厂商有意义」的错误）
 * @param {Array} chain resolveUpstreamChain 的产物
 * @param {object} opts { prompt, imageFiles, size, totalTimeoutMs, externalSignal, fetchImpl, onAttempt }
 * @returns {Promise<object>}
 *   成功：{ ok:true, imageUrl, data, status, used, attempts, totalDurationMs }
 *   失败：{ ok:false, reason:'client-aborted'|'timeout'|'exhausted'|'not-failoverable',
 *           status, error, attempts, totalDurationMs }
 */
export async function runWithFailover(chain, opts = {}) {
  const {
    prompt,
    imageFiles = [],
    size = '1024x1024',
    totalTimeoutMs = 600000,
    externalSignal = null,
    fetchImpl = fetch,
    onAttempt = null,
  } = opts

  const deadline = Date.now() + totalTimeoutMs
  const t0 = Date.now()
  const attempts = []

  for (const entry of chain) {
    if (externalSignal?.aborted) {
      return { ok: false, reason: 'client-aborted', status: 499, error: '客户端已断开连接', attempts, totalDurationMs: Date.now() - t0 }
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      console.warn('[image-upstream] failover 预算耗尽，停止尝试')
      return { ok: false, reason: 'timeout', status: 504, error: '上游调用超时，请稍后重试', attempts, totalDurationMs: Date.now() - t0 }
    }

    // 每次尝试独立的 controller：预算用剩余时间；客户端断开实时打断 in-flight fetch
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remaining)
    const onExternalAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

    const attemptT0 = Date.now()
    let result
    try {
      result = await callImageUpstream(
        entry,
        { prompt, imageFiles, size, signal: controller.signal },
        fetchImpl,
      )
    } catch (err) {
      // callImageUpstream 已兜网络错误；这里防未预期异常（如 fileToBase64 失败）
      result = { ok: false, failoverable: true, status: 0, error: err?.message || '调用异常' }
    } finally {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }

    const attempt = {
      provider: entry.provider,
      model_id: entry.modelId,
      style: resolveStyle(entry.style, entry.modelId),
      url: result.url || '',
      status: result.status ?? 0,
      durationMs: Date.now() - attemptT0,
    }
    if (!result.ok) attempt.error = String(result.error || '').slice(0, 300)
    attempts.push(attempt)
    onAttempt?.(attempt)

    if (result.ok) {
      return {
        ok: true,
        imageUrl: result.imageUrl,
        data: result.data,
        status: result.status,
        url: result.url,
        used: entry,
        attempts,
        totalDurationMs: Date.now() - t0,
      }
    }

    // 客户端断开优先判定（fetch 被 external abort 打断也会走到这）
    if (externalSignal?.aborted) {
      return { ok: false, reason: 'client-aborted', status: 499, error: '客户端已断开连接', attempts, totalDurationMs: Date.now() - t0 }
    }

    // 参数类错误：换厂商无意义，直接终止整链
    if (!result.failoverable) {
      console.warn(`[image-upstream] ${entry.provider} 返回不可切换错误(${result.status})，停止 failover`)
      return {
        ok: false,
        reason: 'not-failoverable',
        status: result.status || 400,
        error: result.error,
        attempts,
        totalDurationMs: Date.now() - t0,
      }
    }

    console.warn(`[image-upstream] ${entry.provider} 失败(${result.status || 'network'})，尝试下一上游`)
  }

  // 链上全部失败：状态码取最后一次的 HTTP 错误（如 429），否则 502
  const last = attempts[attempts.length - 1]
  return {
    ok: false,
    reason: 'exhausted',
    status: last?.status && last.status >= 400 ? last.status : 502,
    error: last?.error || '所有上游均调用失败',
    attempts,
    totalDurationMs: Date.now() - t0,
  }
}

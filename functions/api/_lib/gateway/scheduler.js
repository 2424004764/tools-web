// 统一 AI 网关 - 调度器
// 职责：
//   1. resolveGatewayChain：把「调度组 group / 直连模型」解析成有序候选链
//      （gateway_groups.candidates 按 priority 升序 → gateway_models → gateway_providers，
//        逐项校验：模型/厂商启用、能力匹配、协议支持、base_url 合法、已配 key）
//   2. runChainWithFailover：按链依序尝试，失败分类决定切换或终止
//      （语义与线上验证过的 image-upstream.js runWithFailover 一致，通用化到任意能力）
//   3. isolate 级内存熔断：429/5xx 的厂商短时冷却（60s），期间调度尽量绕开；
//      若所有候选都在冷却则忽略冷却照常尝试（保可用性优先）。
//      注意：Workers 各 isolate 不共享内存，冷却只在本 isolate 生效（跨实例熔断 P3 换 KV）。

import { normalizeBaseUrl, protocolSupports } from './adapters.js'

// ============ 冷却（内存熔断） ============

const cooldowns = new Map() // providerSlug → { until, reason }

export function markCooldown(slug, ms = 60000, reason = '') {
  if (!slug) return
  cooldowns.set(slug, { until: Date.now() + ms, reason })
}

export function cooldownRemaining(slug) {
  const c = cooldowns.get(slug)
  if (!c) return 0
  const left = c.until - Date.now()
  return left > 0 ? left : 0
}

function isCooling(slug) {
  return cooldownRemaining(slug) > 0
}

// ============ 失败分类 ============

/** 哪些 HTTP 状态值得切换厂商（无状态码 / 0 = 网络层错误，恒为可切换）——与 image-upstream.js 同语义 */
export function isFailoverableStatus(status) {
  if (!Number.isInteger(status) || status <= 0) return true
  if (status >= 500) return true
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 408 || status === 429
}

// ============ 链解析 ============

function parseJsonArray(str, fallback = []) {
  try {
    const v = JSON.parse(str)
    return Array.isArray(v) ? v : fallback
  } catch {
    return fallback
  }
}

/**
 * 解析候选链
 * @param {D1Database} db
 * @param {{groupKey?:string, modelId?:number|string, capability:string}} opts
 *   capability 运行时取值：'chat' | 'image_gen'（chat_stream 在入口归一化为 chat）
 * @returns {Promise<{chain:Array, skipped:Array, group:{key,name}|null}>}
 *   chain 项：{ modelRowId, modelId, modelName, providerSlug, protocol, baseUrl, apiKey }
 */
export async function resolveGatewayChain(db, { groupKey, modelId, capability }) {
  const skipped = []
  const wantIds = []
  let group = null

  if (modelId !== undefined && modelId !== null && modelId !== '') {
    const id = Number(modelId)
    if (!Number.isInteger(id) || id <= 0) {
      return { chain: [], skipped: [{ reason: 'model 参数非法（需为 gateway_models.id）' }], group: null }
    }
    wantIds.push(id)
  } else if (groupKey) {
    let g
    try {
      g = await db
        .prepare('SELECT id, group_key, name, candidates, status FROM gateway_groups WHERE group_key = ?')
        .bind(groupKey)
        .first()
    } catch {
      g = null
    }
    if (!g || g.status !== 1) {
      return { chain: [], skipped: [{ reason: `调度组不存在或已停用: ${groupKey}` }], group: null }
    }
    group = { key: g.group_key, name: g.name || g.group_key }
    const cands = parseJsonArray(g.candidates)
    if (cands.length === 0) {
      return { chain: [], skipped: [{ reason: '调度组未配置候选模型' }], group }
    }
    // priority 小者优先；同 priority 保持配置顺序
    const ordered = cands
      .map((c, i) => ({ model: Number(c?.model), priority: Number(c?.priority ?? 100), i }))
      .filter((c) => Number.isInteger(c.model) && c.model > 0)
      .sort((a, b) => a.priority - b.priority || a.i - b.i)
    if (!ordered.length) {
      return { chain: [], skipped: [{ reason: '调度组候选配置非法' }], group }
    }
    for (const c of ordered) wantIds.push(c.model)
  } else {
    return { chain: [], skipped: [{ reason: '缺少 group / model 参数' }], group: null }
  }

  // 批量取模型 + 厂商
  const mph = wantIds.map(() => '?').join(',')
  let modelRows = []
  try {
    const res = await db
      .prepare(`SELECT id, provider_id, model_id, name, capabilities, status FROM gateway_models WHERE id IN (${mph})`)
      .bind(...wantIds)
      .all()
    modelRows = res.results || []
  } catch {
    modelRows = []
  }
  const models = new Map(modelRows.map((m) => [m.id, m]))

  const pids = [...new Set(modelRows.map((m) => m.provider_id))]
  let providerRows = []
  if (pids.length) {
    try {
      const res = await db
        .prepare(
          `SELECT id, name, slug, protocol, base_url, api_key, status FROM gateway_providers WHERE id IN (${pids
            .map(() => '?')
            .join(',')})`,
        )
        .bind(...pids)
        .all()
      providerRows = res.results || []
    } catch {
      providerRows = []
    }
  }
  const providers = new Map(providerRows.map((p) => [p.id, p]))

  const chain = []
  for (const id of wantIds) {
    const m = models.get(id)
    if (!m) {
      skipped.push({ model: id, reason: '模型不存在' })
      continue
    }
    if (m.status !== 1) {
      skipped.push({ model: m.model_id, reason: '模型已停用' })
      continue
    }
    const caps = parseJsonArray(m.capabilities)
    if (!caps.includes(capability)) {
      skipped.push({ model: m.model_id, reason: `不支持 ${capability} 能力` })
      continue
    }
    const p = providers.get(m.provider_id)
    if (!p) {
      skipped.push({ model: m.model_id, reason: '所属厂商不存在' })
      continue
    }
    if (p.status !== 1) {
      skipped.push({ model: m.model_id, provider: p.slug, reason: '厂商已停用' })
      continue
    }
    if (!/^https?:\/\//i.test(p.base_url || '')) {
      skipped.push({ model: m.model_id, provider: p.slug, reason: 'base_url 非法' })
      continue
    }
    if (!protocolSupports(p.protocol, capability)) {
      skipped.push({ model: m.model_id, provider: p.slug, reason: `协议 ${p.protocol} 暂不支持 ${capability}` })
      continue
    }
    if (!(p.api_key || '').trim()) {
      skipped.push({ model: m.model_id, provider: p.slug, reason: '未配置 API Key' })
      continue
    }
    chain.push({
      modelRowId: m.id,
      modelId: m.model_id,
      modelName: m.name || m.model_id,
      providerSlug: p.slug,
      protocol: p.protocol,
      baseUrl: normalizeBaseUrl(p.base_url),
      apiKey: p.api_key.trim(),
    })
  }

  // 冷却过滤：还有非冷却候选时绕开冷却中的厂商
  const active = chain.filter((e) => !isCooling(e.providerSlug))
  const finalChain = active.length > 0 ? active : chain
  if (finalChain !== chain) {
    for (const e of chain) {
      if (!active.includes(e)) {
        skipped.push({ model: e.modelId, provider: e.providerSlug, reason: `熔断冷却中（约 ${Math.ceil(cooldownRemaining(e.providerSlug) / 1000)}s）` })
      }
    }
  }

  return { chain: finalChain, skipped, group }
}

// ============ 通用容灾执行器 ============

/**
 * 按链依序执行 attempt，失败自动切换
 * @param {Array} chain resolveGatewayChain 产物
 * @param {object} opts
 *   - attempt: async (entry, signal) => ({ ok:true, ...payload } | { ok:false, failoverable, status, error })
 *   - totalTimeoutMs: 整链共享总预算（默认 120s，防 failover 后总时长翻倍）
 *   - externalSignal: 客户端断开信号（request.signal）
 *   - onAttempt: 每次尝试回调（埋点用）
 * @returns 成功 { ok:true, result, used, attempts, totalDurationMs }
 *          失败 { ok:false, reason:'client-aborted'|'timeout'|'exhausted'|'not-failoverable', status, error, attempts, totalDurationMs }
 */
export async function runChainWithFailover(chain, opts = {}) {
  const {
    attempt,
    totalTimeoutMs = 120000,
    externalSignal = null,
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
      return { ok: false, reason: 'timeout', status: 504, error: '上游调用超时，请稍后重试', attempts, totalDurationMs: Date.now() - t0 }
    }

    // 每次尝试独立 controller：用剩余预算；客户端断开实时打断 in-flight fetch
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remaining)
    const onExternalAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

    const attemptT0 = Date.now()
    let result
    try {
      result = await attempt(entry, controller.signal)
    } catch (err) {
      const isAbort = err?.name === 'AbortError' || /abort/i.test(err?.message || '')
      result = { ok: false, failoverable: true, status: 0, error: isAbort ? '上游调用超时' : err?.message || '调用异常' }
    } finally {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }

    if (!result || typeof result !== 'object') {
      result = { ok: false, failoverable: true, status: 0, error: 'attempt 返回非法结果' }
    }

    const record = {
      provider: entry.providerSlug,
      model_id: entry.modelId,
      protocol: entry.protocol,
      status: result.status ?? 0,
      durationMs: Date.now() - attemptT0,
    }
    if (!result.ok) record.error = String(result.error || '').slice(0, 300)
    attempts.push(record)
    onAttempt?.(record)

    if (result.ok) {
      return { ok: true, result, used: entry, attempts, totalDurationMs: Date.now() - t0 }
    }

    if (externalSignal?.aborted) {
      return { ok: false, reason: 'client-aborted', status: 499, error: '客户端已断开连接', attempts, totalDurationMs: Date.now() - t0 }
    }

    // 参数类错误（400/422）：参数已在 adapter 归一化，换厂商无意义，终止整链
    if (!result.failoverable) {
      return { ok: false, reason: 'not-failoverable', status: result.status || 400, error: result.error, attempts, totalDurationMs: Date.now() - t0 }
    }

    // 429/5xx → 该厂商短时熔断冷却（本 isolate）
    if (result.status === 429 || (Number.isInteger(result.status) && result.status >= 500)) {
      markCooldown(entry.providerSlug)
    }

    console.warn(`[ai-gateway] ${entry.providerSlug}/${entry.modelId} 失败(${result.status || 'network'})，尝试下一候选`)
  }

  const last = attempts[attempts.length - 1]
  return {
    ok: false,
    reason: 'exhausted',
    status: last?.status && last.status >= 400 ? last.status : 502,
    error: last?.error || '所有候选上游均调用失败',
    attempts,
    totalDurationMs: Date.now() - t0,
  }
}

// ai-gateway 单测：协议 adapter 转换 / 链解析 / failover 切换 / 流式首事件提交
// 用法：node scripts/gateway.test.mjs
// 纯 mock：db.prepare 手工桩，fetch 注入桩（Node 18+ 全局 fetch/Response/ReadableStream）。
import {
  normalizeBaseUrl,
  parseDataUrl,
  normalizeFinishReason,
  protocolSupports,
  ADAPTERS,
} from '../functions/api/_lib/gateway/adapters.js'
import { isFailoverableStatus, resolveGatewayChain, runChainWithFailover, markCooldown } from '../functions/api/_lib/gateway/scheduler.js'
import {
  runGatewayChat,
  runGatewayImageGen,
  normalizeChatPayload,
  instrumentedEvents,
  sanitizeJsonForLog,
} from '../functions/api/_lib/gateway/index.js'

let passed = 0
let failed = 0
const t = (name, cond) => {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

const entry = (over = {}) => ({
  modelRowId: 1,
  modelId: 'gpt-4o-mini',
  modelName: 'gpt-4o-mini',
  providerSlug: 'test',
  protocol: 'openai',
  baseUrl: 'https://api.test.com',
  apiKey: 'sk-test',
  ...over,
})

// ---------- [1] 基础工具 ----------
console.log('\n[1] 基础工具')
t('normalizeBaseUrl 去尾部 / 与 /v1', normalizeBaseUrl('https://a.com/v1/') === 'https://a.com' && normalizeBaseUrl('https://a.com///') === 'https://a.com')
t('parseDataUrl 解析 data URL', (() => { const d = parseDataUrl('data:image/png;base64,abcd'); return d && d.mime === 'image/png' && d.b64 === 'abcd' })())
t('parseDataUrl 非 data URL → null', parseDataUrl('https://a.com/x.png') === null)
t('normalizeFinishReason 归一化', normalizeFinishReason('end_turn') === 'stop' && normalizeFinishReason('MAX_TOKENS') === 'length' && normalizeFinishReason('SAFETY') === 'content_filter' && normalizeFinishReason('whatever') === 'stop' && normalizeFinishReason(undefined) === null)

// ---------- [2] openai adapter ----------
console.log('\n[2] openai adapter')
{
  const built = ADAPTERS.openai.buildChat(entry(), { messages: [{ role: 'user', content: 'hi' }], max_tokens: 100 }, { stream: false })
  t('buildChat URL 与 Bearer', built.url === 'https://api.test.com/v1/chat/completions' && built.headers.Authorization === 'Bearer sk-test')
  t('buildChat 透传 messages/max_tokens', built.body.model === 'gpt-4o-mini' && built.body.max_tokens === 100 && !built.body.stream)
  const s = ADAPTERS.openai.buildChat(entry(), { messages: [{ role: 'user', content: 'hi' }] }, { stream: true })
  t('stream 时 body.stream + Accept', s.body.stream === true && s.headers.Accept === 'text/event-stream')

  const parsed = ADAPTERS.openai.parseChat({ choices: [{ message: { content: '你好' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 5 } })
  t('parseChat 提取 content/usage', parsed.content === '你好' && parsed.finish_reason === 'stop' && parsed.usage.input_tokens === 3 && parsed.usage.output_tokens === 5)

  const ev = ADAPTERS.openai.extractStreamEvent({ choices: [{ delta: { content: '字' } }] })
  t('extractStreamEvent delta', ev && ev.delta === '字')
  const rev = ADAPTERS.openai.extractStreamEvent({ choices: [{ delta: { reasoning_content: '想' } }] })
  t('extractStreamEvent reasoning_content → reasoning', rev && rev.reasoning === '想')
  t('extractStreamEvent role 首块 → null', ADAPTERS.openai.extractStreamEvent({ choices: [{ delta: { role: 'assistant' } }] }) === null)
}

// ---------- [3] anthropic adapter ----------
console.log('\n[3] anthropic adapter')
{
  const canonical = {
    messages: [
      { role: 'system', content: '你是助手' },
      { role: 'user', content: [{ type: 'text', text: '看图' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,xx' } }] },
    ],
  }
  const built = ADAPTERS.anthropic.buildChat(entry({ protocol: 'anthropic' }), canonical, { stream: false })
  t('URL /v1/messages + x-api-key + version', built.url === 'https://api.test.com/v1/messages' && built.headers['x-api-key'] === 'sk-test' && built.headers['anthropic-version'])
  t('system 提取到顶层', built.body.system === '你是助手' && built.body.messages.length === 1)
  t('max_tokens 默认 4096', built.body.max_tokens === 4096)
  t('图片 data URL → base64 source', JSON.stringify(built.body.messages[0].content[1]) === JSON.stringify({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'xx' } }))

  const parsed = ADAPTERS.anthropic.parseChat({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 2 } })
  t('parseChat 拼接 text blocks', parsed.content === 'ab' && parsed.finish_reason === 'stop' && parsed.usage.output_tokens === 2)

  const e1 = ADAPTERS.anthropic.extractStreamEvent({ type: 'content_block_delta', delta: { type: 'text_delta', text: '字' } })
  t('extractStreamEvent text_delta', e1 && e1.delta === '字')
  const e2 = ADAPTERS.anthropic.extractStreamEvent({ type: 'message_delta', delta: { stop_reason: 'max_tokens' }, usage: { output_tokens: 9 } })
  t('extractStreamEvent message_delta → finish+usage', e2 && e2.finish === 'length' && e2.usage.output_tokens === 9)
}

// ---------- [4] gemini adapter ----------
console.log('\n[4] gemini adapter')
{
  const canonical = {
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'again' },
    ],
  }
  const built = ADAPTERS.gemini.buildChat(entry({ protocol: 'gemini', modelId: 'gemini-2.5-flash' }), canonical, { stream: false })
  t('非流式 :generateContent', built.url.endsWith('/v1beta/models/gemini-2.5-flash:generateContent'))
  t('assistant → model 角色', built.body.contents[1].role === 'model' && built.body.contents[0].role === 'user')
  t('system → systemInstruction', built.body.systemInstruction.parts[0].text === 'sys')
  const sb = ADAPTERS.gemini.buildChat(entry({ protocol: 'gemini', modelId: 'gemini-2.5-flash' }), canonical, { stream: true })
  t('流式 :streamGenerateContent?alt=sse', sb.url.endsWith(':streamGenerateContent?alt=sse'))

  const parsed = ADAPTERS.gemini.parseChat({ candidates: [{ content: { parts: [{ text: 'x' }, { text: 'y' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 } })
  t('parseChat 拼接 parts', parsed.content === 'xy' && parsed.finish_reason === 'stop' && parsed.usage.input_tokens === 2)

  const ev = ADAPTERS.gemini.extractStreamEvent({ candidates: [{ content: { parts: [{ text: 'z' }, { text: 'w', thought: true }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } })
  t('extractStreamEvent text/thought 分流', ev && ev.delta === 'z' && ev.reasoning === 'w' && ev.usage.input_tokens === 1)
}

// ---------- [5] 能力矩阵 ----------
console.log('\n[5] protocolSupports')
t('openai 支持 chat/image_gen', protocolSupports('openai', 'chat') && protocolSupports('openai', 'chat_stream') && protocolSupports('openai', 'image_gen'))
t('anthropic 支持 chat 不支持 image_gen', protocolSupports('anthropic', 'chat') && !protocolSupports('anthropic', 'image_gen'))
t('gemini 支持 chat/image_gen', protocolSupports('gemini', 'chat') && protocolSupports('gemini', 'image_gen'))
t('未知协议全部不支持', !protocolSupports('xxx', 'chat') && !protocolSupports('openai', 'video'))

// ---------- [6] 失败分类 ----------
console.log('\n[6] isFailoverableStatus')
for (const s of [500, 502, 529, 429, 401, 402, 403, 404, 408]) t(`${s} 可切换`, isFailoverableStatus(s) === true)
for (const s of [400, 422, 413, 200]) t(`${s} 不切换`, isFailoverableStatus(s) === false)
t('无状态码可切换', isFailoverableStatus(0) === true && isFailoverableStatus(undefined) === true)

// ---------- [7] payload 归一化 ----------
console.log('\n[7] normalizeChatPayload')
t('合法 messages 通过', normalizeChatPayload({ messages: [{ role: 'user', content: 'hi' }] }).ok === true)
t('空 messages 拒绝', normalizeChatPayload({ messages: [] }).ok === false)
t('非法 role 拒绝', normalizeChatPayload({ messages: [{ role: 'tool', content: 'x' }] }).ok === false)
t('非法分块拒绝', normalizeChatPayload({ messages: [{ role: 'user', content: [{ type: 'audio', text: 'x' }] }] }).ok === false)
t('max_tokens 越界拒绝', normalizeChatPayload({ messages: [{ role: 'user', content: 'x' }], max_tokens: 0 }).ok === false)
t('stop 归一为数组', normalizeChatPayload({ messages: [{ role: 'user', content: 'x' }], stop: 'END' }).value.stop.length === 1)

// ---------- [8] 链解析 ----------
console.log('\n[8] resolveGatewayChain')
const makeDB = ({ groups = [], models = [], providers = [] } = {}) => ({
  prepare: (sql) => ({
    bind: (...args) => ({
      first: () => {
        if (sql.includes('FROM gateway_groups')) return groups.find((g) => g.group_key === args[0]) || null
        return null
      },
      all: () => {
        if (sql.includes('FROM gateway_models')) return { results: models.filter((m) => args.includes(m.id)) }
        if (sql.includes('FROM gateway_providers')) return { results: providers.filter((p) => args.includes(p.id)) }
        return { results: [] }
      },
      run: () => ({}),
    }),
  }),
})

{
  const db = makeDB({
    groups: [{ group_key: 'text', status: 1, candidates: JSON.stringify([{ model: 2, priority: 20 }, { model: 1, priority: 10 }]) }],
    models: [
      { id: 1, provider_id: 1, model_id: 'm-a', name: '', capabilities: '["chat"]', status: 1 },
      { id: 2, provider_id: 2, model_id: 'm-b', name: '', capabilities: '["image_gen"]', status: 1 },
    ],
    providers: [
      { id: 1, name: 'A', slug: 'pa', protocol: 'openai', base_url: 'https://a.com', api_key: 'k1', status: 1 },
      { id: 2, name: 'B', slug: 'pb', protocol: 'openai', base_url: 'https://b.com', api_key: '', status: 1 },
    ],
  })
  const r = await resolveGatewayChain(db, { groupKey: 'text', capability: 'chat' })
  t('按 priority 升序且能力过滤后剩 1', r.chain.length === 1 && r.chain[0].modelId === 'm-a')
  t('能力不匹配进 skipped', r.skipped.some((s) => s.reason.includes('不支持 chat')))

  const direct = await resolveGatewayChain(db, { modelId: 2, capability: 'image_gen' })
  t('直连 model=2 image_gen 可解析', direct.chain.length === 0 && direct.skipped.some((s) => s.reason.includes('API Key')))

  const none = await resolveGatewayChain(db, { groupKey: 'nope', capability: 'chat' })
  t('不存在的组 → 空链 + 原因', none.chain.length === 0 && none.skipped[0].reason.includes('不存在'))
}

// ---------- [9] failover 执行器 ----------
console.log('\n[9] runChainWithFailover')
const chain = [entry({ providerSlug: 'p1' }), entry({ providerSlug: 'p2' })]
{
  const r = await runChainWithFailover(chain, {
    attempt: async (e) => (e.providerSlug === 'p1' ? { ok: false, failoverable: true, status: 500, error: 'x' } : { ok: true, content: 'ok' }),
  })
  t('5xx 切换到下一候选', r.ok === true && r.used.providerSlug === 'p2' && r.attempts.length === 2)
}
{
  const r = await runChainWithFailover(chain, {
    attempt: async () => ({ ok: false, failoverable: false, status: 400, error: 'bad' }),
  })
  t('400 不切换直接终止', r.ok === false && r.reason === 'not-failoverable' && r.attempts.length === 1)
}
{
  const r = await runChainWithFailover(chain, {
    attempt: async () => ({ ok: false, failoverable: true, status: 0, error: 'net' }),
  })
  t('全失败 → exhausted', r.ok === false && r.reason === 'exhausted' && r.status === 502)
}
{
  // attempt 监听 abort signal（模拟真实 fetch 被预算 timer 打断）
  const slowAttempt = (e, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ ok: true }), 200)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('The operation was aborted'))
      })
    })
  const r = await runChainWithFailover(chain, { totalTimeoutMs: 50, attempt: slowAttempt })
  t('共享预算超时 → timeout', r.ok === false && r.reason === 'timeout')
}

// ---------- [10] chat 全链路（mock fetch） ----------
console.log('\n[10] runGatewayChat 非流式 failover')
const gwDB = makeDB({
  groups: [{ group_key: 'g', status: 1, candidates: JSON.stringify([{ model: 1, priority: 10 }, { model: 2, priority: 20 }]) }],
  models: [
    { id: 1, provider_id: 1, model_id: 'm-a', name: '', capabilities: '["chat","image_gen"]', status: 1 },
    { id: 2, provider_id: 2, model_id: 'm-b', name: '', capabilities: '["chat","image_gen"]', status: 1 },
  ],
  providers: [
    { id: 1, name: 'A', slug: 'pa', protocol: 'openai', base_url: 'https://a.com', api_key: 'ka', status: 1 },
    { id: 2, name: 'B', slug: 'pb', protocol: 'openai', base_url: 'https://b.com', api_key: 'kb', status: 1 },
  ],
})
const okJson = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
{
  const fetchMock = async (url) => {
    if (url.startsWith('https://a.com')) return new Response('{"error":"boom"}', { status: 500 })
    return okJson({ choices: [{ message: { content: 'B 家回复' }, finish_reason: 'stop' }] })
  }
  const r = await runGatewayChat(gwDB, { groupKey: 'g', payload: { messages: [{ role: 'user', content: 'hi' }] }, stream: false, fetchImpl: fetchMock })
  t('A 500 → 切 B 成功', r.ok === true && r.result.content === 'B 家回复' && r.used.providerSlug === 'pb')
}
{
  const fetchMock = async () => new Response('{"error":"bad request"}', { status: 400 })
  const r = await runGatewayChat(gwDB, { groupKey: 'g', payload: { messages: [{ role: 'user', content: 'hi' }] }, stream: false, fetchImpl: fetchMock })
  t('400 参数错误不切换', r.ok === false && r.reason === 'not-failoverable' && r.attempts.length === 1)
}
{
  const r = await runGatewayChat(gwDB, { groupKey: 'g', payload: { messages: [] }, stream: false })
  t('非法 payload → bad-request', r.ok === false && r.reason === 'bad-request')
}

// ---------- [11] chat 流式（首事件提交 + 容灾） ----------
console.log('\n[11] runGatewayChat 流式')
const sseResponse = (chunks, { delayMs = 0 } = {}) => {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    async start(controller) {
      for (const c of chunks) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
        controller.enqueue(encoder.encode(c))
      }
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}
{
  // A：200 但零事件（空流）→ 切 B 正常出流
  const fetchMock = async (url) => {
    if (url.startsWith('https://a.com')) return sseResponse([])
    return sseResponse(['data: {"choices":[{"delta":{"content":"你"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"好"}}]}\n\n', 'data: [DONE]\n\n'])
  }
  const r = await runGatewayChat(gwDB, { groupKey: 'g', payload: { messages: [{ role: 'user', content: 'hi' }] }, stream: true, fetchImpl: fetchMock })
  t('空流 → failover 到 B', r.ok === true && r.used.providerSlug === 'pb')
  let text = ''
  for await (const ev of r.result.events) if (ev.delta) text += ev.delta
  t('B 流事件拼接完整', text === '你好')
}
{
  // 已提交后中断：首个事件已送达，随后连接断开 → error 事件收尾（不换厂商）
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"前"}}]}\n\n'))
      // 异步再断：保证首个 chunk 先被读走（同步 error 会丢弃已入队 chunk）
      setTimeout(() => controller.error(new Error('upstream reset')), 10)
    },
  })
  const fetchMock = async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  const r = await runGatewayChat(gwDB, { groupKey: 'g', payload: { messages: [{ role: 'user', content: 'hi' }] }, stream: true, fetchImpl: fetchMock })
  t('首事件后提交成功', r.ok === true)
  const events = []
  for await (const ev of r.result.events) events.push(ev)
  if (!events.some((e) => e.delta === '前') || !events.some((e) => e.finish === 'error' && e.error)) {
    console.error('    [diag] events =', JSON.stringify(events), 'outcome =', r.ok, r.reason)
  }
  t('中断 → error 事件 + 已产出内容', events.some((e) => e.delta === '前') && events.some((e) => e.finish === 'error' && e.error))
}

// ---------- [12] 生图 ----------
console.log('\n[12] runGatewayImageGen')
{
  const fetchMock = async (url) => {
    if (url.startsWith('https://a.com')) return okJson({ data: [{}] }) // 200 无图
    return okJson({ data: [{ b64_json: 'iVBORw0KGgo=' }] })
  }
  const r = await runGatewayImageGen(gwDB, { groupKey: 'g', payload: { prompt: '猫' }, fetchImpl: fetchMock })
  t('200 无图 → failover，B b64 嗅探为 png', r.ok === true && r.result.image.startsWith('data:image/png;base64,'))
}
{
  const r = await runGatewayImageGen(gwDB, { groupKey: 'g', payload: { prompt: '' } })
  t('空 prompt 拒绝', r.ok === false && r.reason === 'bad-request')
}

// ---------- [13] 冷却 ----------
console.log('\n[13] 冷却过滤')
{
  markCooldown('pa', 60000, 'test')
  const r = await resolveGatewayChain(gwDB, { groupKey: 'g', capability: 'chat' })
  t('pa 冷却中 → 链只剩 pb', r.chain.length === 1 && r.chain[0].providerSlug === 'pb')
  const dbAllCooling = makeDB({
    groups: [{ group_key: 'g', status: 1, candidates: JSON.stringify([{ model: 1, priority: 10 }]) }],
    models: [{ id: 1, provider_id: 1, model_id: 'm-a', capabilities: '["chat"]', status: 1 }],
    providers: [{ id: 1, slug: 'pa', protocol: 'openai', base_url: 'https://a.com', api_key: 'ka', status: 1 }],
  })
  const r2 = await resolveGatewayChain(dbAllCooling, { groupKey: 'g', capability: 'chat' })
  t('全部冷却 → 忽略冷却保可用', r2.chain.length === 1)
}

// ---------- [14] sanitizeJsonForLog ----------
console.log('\n[14] sanitizeJsonForLog')
{
  const out = sanitizeJsonForLog({ prompt: '画猫', image: 'data:image/png;base64,' + 'A'.repeat(1000) })
  t('data URL 脱敏为占位', out.includes('<1022 chars>') && !out.includes('AAAA') && out.includes('画猫'))
  const big = sanitizeJsonForLog({ text: 'x'.repeat(20000) }, 1024)
  t('超长截断并标注长度', big.length < 1100 && big.includes('共 20011 字符'))
  const imgRes = sanitizeJsonForLog({ image_url: 'data:image/jpeg;base64,' + 'B'.repeat(500) })
  t('图片响应同样脱敏', imgRes.includes('data:image/jpeg;base64,<523 chars>') && !imgRes.includes('BBBB'))
  t('普通对象原样序列化', sanitizeJsonForLog({ a: 1, b: '中文' }) === '{"a":1,"b":"中文"}')
}

// ---------- [15] instrumentedEvents ----------
console.log('\n[15] instrumentedEvents（首字/token/全文统计）')
{
  const mkSource = async function* () {
    yield { delta: '你' }
    yield { reasoning: '想' }
    yield { delta: '好' }
    yield { usage: { input_tokens: 3 } }
    yield { usage: { output_tokens: 5 } }
    yield { finish: 'stop' }
  }
  let stats = null
  const t0 = Date.now() - 100 // 假装请求 100ms 前开始
  const wrapped = instrumentedEvents(mkSource(), t0, (s) => (stats = s))
  const seen = []
  for await (const ev of wrapped) seen.push(ev)
  t('事件原样透传', seen.length === 6 && seen[0].delta === '你' && seen[5].finish === 'stop')
  t('累计输出全文', stats && stats.text === '你好' && stats.reasoning === '想')
  t('usage 事件合并', stats && stats.usage && stats.usage.input_tokens === 3 && stats.usage.output_tokens === 5)
  t('finishReason 记录', stats && stats.finishReason === 'stop')
  t('ttft ≥ 100ms（首个 delta 相对 t0）', stats && stats.ttftMs >= 100)
  t('正常结束触发一次 onDone', stats !== null)
}
{
  // 中途 error 事件 → streamError 记录且 onDone 触发
  const mkSource = async function* () {
    yield { delta: '前' }
    yield { error: '流式响应中断: reset', finish: 'error' }
  }
  let stats = null
  for await (const ev of instrumentedEvents(mkSource(), Date.now(), (s) => (stats = s))) {
    void ev
  }
  t('error 事件计入 streamError', stats && stats.streamError.includes('中断') && stats.finishReason === 'error')
}
{
  // 消费方提前 break → return() 也触发 onDone（部分文本已产出）
  const mkSource = async function* () {
    yield { delta: 'a' }
    yield { delta: 'b' }
    yield { delta: 'c' }
  }
  let stats = null
  const it = instrumentedEvents(mkSource(), Date.now(), (s) => (stats = s))[Symbol.asyncIterator]()
  await it.next()
  await it.next()
  await it.return(undefined)
  t('提前 break 触发 onDone（部分文本）', stats && stats.text === 'ab')
}
{
  // 源是 { [Symbol.asyncIterator] } 对象（committedEventStream 产物，无 .next 方法）——
  // 回归防护：曾因直接调 events.next 抛 "next is not a function"
  const mkIterableOnly = (evs) => ({
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          return i < evs.length ? { value: evs[i++], done: false } : { done: true }
        },
      }
    },
  })
  let stats = null
  const out = []
  for await (const ev of instrumentedEvents(mkIterableOnly([{ delta: 'x' }, { delta: 'y' }, { finish: 'stop' }]), Date.now(), (s) => (stats = s))) {
    out.push(ev)
  }
  t('iterable-only 源（无 .next）正常透传', out.length === 3 && stats && stats.text === 'xy' && stats.finishReason === 'stop')
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)

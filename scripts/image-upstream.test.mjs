// image-upstream.js 单测：错误分类 / style 判断 / 链解析回退 / failover 切换
// 用法：node scripts/image-upstream.test.mjs
// 纯 mock（不依赖 node:sqlite）：db.prepare 手工桩，fetch 注入桩。
import {
  resolveStyle,
  isFailoverableStatus,
  parseUpstreamsJson,
  validateUpstreamsForSave,
  resolveUpstreamChain,
  callImageUpstream,
  runWithFailover,
  sanitizeExtraBody,
  sniffB64Mime,
} from '../functions/api/_lib/image-upstream.js'

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

// ---------- D1 风格 mock ----------
const makeMockDB = (toolModelsRows = [], providerRows = []) => ({
  prepare: (sql) => ({
    bind: (...args) => ({
      first: () => {
        if (sql.includes('FROM tool_models')) {
          // args: [toolUrl, modelKey]
          return toolModelsRows.find(
            (r) => r.tool_url === args[0] && r.model_key === args[1],
          ) || null
        }
        return null
      },
      all: () => {
        if (sql.includes('FROM ai_providers')) {
          const slugs = args
          return { results: providerRows.filter((p) => slugs.includes(p.slug)) }
        }
        return { results: [] }
      },
      run: () => ({}),
    }),
  }),
})

const jsonRes = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

console.log('\n[1] resolveStyle')
t('auto + gemini- 前缀 → gemini', resolveStyle('auto', 'gemini-3-pro-image-preview') === 'gemini')
t('auto + 普通模型 → openai', resolveStyle('auto', 'gpt-image-2-1k') === 'openai')
t('未传 style 按 auto 处理', resolveStyle(undefined, 'foo') === 'openai')
t('显式 openai 覆盖 gemini 前缀', resolveStyle('openai', 'gemini-xxx') === 'openai')
t('显式 gemini 覆盖普通前缀', resolveStyle('gemini', 'gpt-image-2') === 'gemini')

console.log('\n[2] isFailoverableStatus（仅"换厂商有意义"的错误才切换）')
for (const s of [500, 502, 503, 429, 401, 402, 403, 404, 408]) {
  t(`${s} 可切换`, isFailoverableStatus(s) === true)
}
for (const s of [400, 422, 413, 200]) {
  t(`${s} 不切换`, isFailoverableStatus(s) === false)
}
t('无状态码（网络/超时）可切换', isFailoverableStatus(0) === true && isFailoverableStatus(undefined) === true)

console.log('\n[3] parseUpstreamsJson')
t('合法链解析并补默认 style', JSON.stringify(parseUpstreamsJson('[{"provider":"bafang","model_id":"gpt-image-2-1k"}]'))
  === JSON.stringify([{ provider: 'bafang', model_id: 'gpt-image-2-1k', style: 'auto' }]))
t('null / 空串 / 空数组 → null', parseUpstreamsJson(null) === null && parseUpstreamsJson('') === null && parseUpstreamsJson('[]') === null)
t('非 JSON → null', parseUpstreamsJson('not-json') === null)
t('缺 model_id → null（整链视为非法回退 legacy）', parseUpstreamsJson('[{"provider":"bafang"}]') === null)
t('中文 model_id 合法（存量 gpt-image2-超分）',
  parseUpstreamsJson('[{"provider":"bafang","model_id":"gpt-image2-超分"}]') !== null)

console.log('\n[4] resolveUpstreamChain')
{
  // 4.1 未配置 → legacy（bafang + env key）
  const env = { BAFANG_API_KEY: 'env-key' }
  const r1 = await resolveUpstreamChain(makeMockDB(), '/ai-image-edit/', 'gpt-image-2-1k', env, { rawUpstreams: null })
  t('未配置回退 legacy', r1.legacy === true && r1.chain.length === 1)
  t('legacy 项 = bafang + env key + 原 model_key',
    r1.chain[0].provider === 'bafang' && r1.chain[0].apiKey === 'env-key' && r1.chain[0].modelId === 'gpt-image-2-1k')
  t('legacy baseUrl = https://bafang.me', r1.chain[0].baseUrl === 'https://bafang.me')

  // 4.2 env key 也没有 → 空链（调用方报"服务未配置"）
  const r2 = await resolveUpstreamChain(makeMockDB(), '/ai-image-edit/', 'x', {}, { rawUpstreams: null })
  t('未配置且无 env key → 空链', r2.chain.length === 0)

  // 4.3 配置了链：第一项 bafang（D1 key 空 → env 兜底）、第二项厂商不存在（跳过）、第三项带 D1 key
  const providers = [
    { slug: 'bafang', base_url: 'https://bafang.me/', api_key: '' },
    { slug: 'vendor-b', base_url: 'https://b.example.com/v1', api_key: 'd1-key-b' },
  ]
  const raw = JSON.stringify([
    { provider: 'bafang', model_id: 'gpt-image-2-1k', style: 'auto' },
    { provider: 'ghost', model_id: 'whatever', style: 'auto' },
    { provider: 'vendor-b', model_id: 'img-b', style: 'openai' },
  ])
  const r3 = await resolveUpstreamChain(makeMockDB([], providers), '/ai-image-edit/', 'gpt-image-2-1k', env, { rawUpstreams: raw })
  t('可用链长度 2（ghost 被跳过）', r3.chain.length === 2 && !r3.legacy)
  t('bafang 空 D1 key 用 env 兜底', r3.chain[0].apiKey === 'env-key')
  t('vendor-b 用 D1 key，baseUrl 去尾斜杠', r3.chain[1].apiKey === 'd1-key-b' && r3.chain[1].baseUrl === 'https://b.example.com/v1')
  t('skipped 记录被跳过的厂商', r3.skipped.length === 1 && r3.skipped[0].provider === 'ghost')

  // 4.4 非法 model_id 的项被跳过
  const rawBad = JSON.stringify([{ provider: 'bafang', model_id: '../evil?x', style: 'auto' }])
  const r4 = await resolveUpstreamChain(makeMockDB([], providers), '/ai-image-edit/', 'x', env, { rawUpstreams: rawBad })
  t('路径注入式 model_id 被跳过', r4.skipped.length === 1 && r4.chain.length === 1 && r4.legacy)

  // 4.5 不预加载时自动查 tool_models
  const dbRows = [{ tool_url: '/ai-image-edit/', model_key: 'm1', upstreams: raw }]
  const r5 = await resolveUpstreamChain(makeMockDB(dbRows, providers), '/ai-image-edit/', 'm1', env)
  t('未预加载时自动查库拼链', r5.chain.length === 2)
}

console.log('\n[5] callImageUpstream（URL / 鉴权 / 响应解析）')
{
  const geminiEntry = { provider: 'p', baseUrl: 'https://g.example.com', apiKey: 'gk', modelId: 'gemini-3-pro', style: 'auto' }
  let captured
  const capFetch = async (url, init) => { captured = { url, init }; return jsonRes(200, { candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'QUJD' } }] } }] }) }
  const r1 = await callImageUpstream(geminiEntry, { prompt: 'hi', imageFiles: [], size: '1024x1024' }, capFetch)
  t('gemini 路径正确', captured.url === 'https://g.example.com/v1beta/models/gemini-3-pro:generateContent')
  t('gemini 用 x-goog-api-key', captured.init.headers['x-goog-api-key'] === 'gk')
  t('gemini inline_data 提取为 dataURL', r1.ok && r1.imageUrl === 'data:image/png;base64,QUJD')

  const openaiEntry = { provider: 'p', baseUrl: 'https://o.example.com', apiKey: 'ok', modelId: 'gpt-image-2-1k', style: 'auto' }
  const r2 = await callImageUpstream(openaiEntry, { prompt: 'hi', imageFiles: [], size: '1024x1024' }, async (url, init) => {
    captured = { url, init }
    return jsonRes(200, { data: [{ url: 'https://cdn.example.com/x.png' }] })
  })
  t('openai 无图走 generations', captured.url === 'https://o.example.com/v1/images/generations')
  t('openai Bearer 鉴权', captured.init.headers['Authorization'] === 'Bearer ok')
  t('openai data[0].url 提取', r2.ok && r2.imageUrl === 'https://cdn.example.com/x.png')

  const r3 = await callImageUpstream(openaiEntry, { prompt: 'hi', imageFiles: [new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' })], size: '1024x1024' }, async (url, init) => {
    captured = { url, init }
    return jsonRes(200, { data: [{ b64_json: 'QUJD' }] })
  })
  t('openai 有图走 edits（FormData）', captured.url === 'https://o.example.com/v1/images/edits' && captured.init.body instanceof FormData)
  t('b64_json 提取为 dataURL', r3.ok && r3.imageUrl === 'data:image/png;base64,QUJD')

  const r4 = await callImageUpstream(openaiEntry, { prompt: 'hi', imageFiles: [], size: '1024x1024' }, async () => jsonRes(200, { foo: 1 }))
  t('200 但无图 → failoverable', !r4.ok && r4.failoverable === true)

  const r5 = await callImageUpstream(openaiEntry, { prompt: 'hi', imageFiles: [], size: '1024x1024' }, async () => jsonRes(400, { error: 'bad prompt' }))
  t('400 → 不可切换', !r5.ok && r5.failoverable === false && r5.status === 400)

  const r6 = await callImageUpstream(openaiEntry, { prompt: 'hi', imageFiles: [], size: '1024x1024' }, async () => { throw new Error('boom') })
  t('网络错误 → failoverable 且无状态码', !r6.ok && r6.failoverable === true && r6.status === 0)
}

console.log('\n[6] runWithFailover')
{
  const chain = [
    { provider: 'a', baseUrl: 'https://a.example.com', apiKey: 'ka', modelId: 'm-a', style: 'auto' },
    { provider: 'b', baseUrl: 'https://b.example.com', apiKey: 'kb', modelId: 'm-b', style: 'auto' },
  ]

  // 6.1 第一家 500 → 切换第二家成功
  const r1 = await runWithFailover(chain, {
    prompt: 'p',
    totalTimeoutMs: 5000,
    fetchImpl: async (url) => (url.includes('a.example.com')
      ? jsonRes(500, { error: 'down' })
      : jsonRes(200, { data: [{ url: 'https://cdn/b.png' }] })),
  })
  t('500 切换到第二家成功', r1.ok && r1.used.provider === 'b' && r1.imageUrl === 'https://cdn/b.png')
  t('attempts 记录两次', r1.attempts.length === 2 && r1.attempts[0].status === 500)
  t('attempts 带完整请求 URL', r1.attempts[0].url === 'https://a.example.com/v1/images/generations'
    && r1.attempts[1].url === 'https://b.example.com/v1/images/generations')

  // 6.2 400 不切换，直接终止
  let called = 0
  const r2 = await runWithFailover(chain, {
    prompt: 'p',
    totalTimeoutMs: 5000,
    fetchImpl: async () => { called++; return jsonRes(400, { error: 'bad' }) },
  })
  t('400 立即终止不切换', !r2.ok && r2.reason === 'not-failoverable' && called === 1 && r2.status === 400)

  // 6.3 全部失败 → exhausted
  const r3 = await runWithFailover(chain, {
    prompt: 'p',
    totalTimeoutMs: 5000,
    fetchImpl: async () => jsonRes(503, { error: 'down' }),
  })
  t('全部失败 exhausted + 取最后状态码', !r3.ok && r3.reason === 'exhausted' && r3.status === 503)

  // 6.4 超时预算共享：第一家耗尽预算 → 第二家不再尝试
  const r4 = await runWithFailover(chain, {
    prompt: 'p',
    totalTimeoutMs: 60,
    fetchImpl: (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () =>
        reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })))
    }),
  })
  t('整链共享预算 → 超时终止', !r4.ok && r4.reason === 'timeout' && r4.attempts.length === 1)

  // 6.5 客户端断开 → client-aborted（不打完整个链）
  const ctl = new AbortController()
  const r5 = await runWithFailover(chain, {
    prompt: 'p',
    totalTimeoutMs: 5000,
    externalSignal: ctl.signal,
    fetchImpl: (url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () =>
        reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })))
      setTimeout(() => ctl.abort(), 10)
    }),
  })
  t('客户端断开 → client-aborted', !r5.ok && r5.reason === 'client-aborted' && r5.attempts.length === 1)
}

console.log('\n[7] validateUpstreamsForSave')
{
  const db = makeMockDB([], [{ slug: 'bafang', base_url: 'https://bafang.me', api_key: 'k' }])
  t('null 通过（清除配置）', (await validateUpstreamsForSave(db, null)).value === null)
  t('合法数组通过并规范化', (await validateUpstreamsForSave(db, [{ provider: 'bafang', model_id: 'm1', style: 'auto' }])).ok)
  t('厂商不存在被拒', !(await validateUpstreamsForSave(db, [{ provider: 'nope', model_id: 'm1' }])).ok)
  t('超过 5 项被拒', !(await validateUpstreamsForSave(db, Array.from({ length: 6 }, (_, i) => ({ provider: 'bafang', model_id: 'm' + i })))).ok)
  t('非法 model_id 被拒', !(await validateUpstreamsForSave(db, [{ provider: 'bafang', model_id: '../x' }])).ok)
  t('非法 style 被拒', !(await validateUpstreamsForSave(db, [{ provider: 'bafang', model_id: 'm', style: 'weird' }])).ok)
}

console.log('\n[8] extra_body（附加请求参数，如 gif 动图选项）')
{
  // 8.1 sanitizeExtraBody
  t('合法扁平对象通过', JSON.stringify(sanitizeExtraBody({ output_format: 'gif', frame_count: 9, quality: 'high' }))
    === JSON.stringify({ output_format: 'gif', frame_count: 9, quality: 'high' }))
  t('null / 数组 / 嵌套对象被拒', sanitizeExtraBody(null) === null
    && sanitizeExtraBody([1, 2]) === null
    && sanitizeExtraBody({ a: { b: 1 } }) === null)
  t('非法 key 被拒（防注入）', sanitizeExtraBody({ 'bad key!': 1 }) === null && sanitizeExtraBody({ '../x': 1 }) === null)
  t('超过 10 键被拒', sanitizeExtraBody(Object.fromEntries(Array.from({ length: 11 }, (_, i) => ['k' + i, i]))) === null)

  // 8.2 parseUpstreamsJson 携带 extra_body
  const parsed = parseUpstreamsJson('[{"provider":"bafang","model_id":"m","extra_body":{"output_format":"gif","frame_count":9}}]')
  t('链解析保留 extra_body', parsed?.[0]?.extra_body?.output_format === 'gif' && parsed[0].extra_body.frame_count === 9)

  // 8.3 validateUpstreamsForSave 接受 extra_body、拒绝非法值
  const db = makeMockDB([], [{ slug: 'bafang', base_url: 'https://bafang.me', api_key: 'k' }])
  const okSave = await validateUpstreamsForSave(db, [{ provider: 'bafang', model_id: 'm', extra_body: { output_format: 'gif' } }])
  t('保存校验通过并保留 extra_body', okSave.ok && okSave.value[0].extra_body.output_format === 'gif')
  t('保存校验拒绝嵌套 extra_body', !(await validateUpstreamsForSave(db, [{ provider: 'bafang', model_id: 'm', extra_body: { x: { y: 1 } } }])).ok)

  // 8.4 callImageUpstream：JSON 分支合并 extra_body（且不可覆盖基础字段）
  let captured
  const entry = { provider: 'p', baseUrl: 'https://o.example.com', apiKey: 'k', modelId: 'gif-model', style: 'openai', extraBody: { output_format: 'gif', frame_count: 9, model: 'HACKED' } }
  await callImageUpstream(entry, { prompt: 'p', imageFiles: [], size: '1024x1024' }, async (url, init) => {
    captured = { url, body: JSON.parse(init.body) }
    return jsonRes(200, { data: [{ url: 'https://cdn/x.gif' }] })
  })
  t('JSON 分支合并附加参数', captured.body.output_format === 'gif' && captured.body.frame_count === 9)
  t('附加参数不能覆盖 model/prompt/size', captured.body.model === 'gif-model' && captured.body.prompt === 'p' && captured.body.size === '1024x1024')

  // 8.5 form-data 分支：附加参数并入表单
  const file = new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' })
  await callImageUpstream(entry, { prompt: 'p', imageFiles: [file], size: '1024x1024' }, async (url, init) => {
    captured = { url, form: init.body }
    return jsonRes(200, { data: [{ url: 'https://cdn/x.gif' }] })
  })
  t('form 分支附加参数并入表单', captured.url === 'https://o.example.com/v1/images/edits'
    && captured.form.get('output_format') === 'gif' && captured.form.get('frame_count') === '9')
}

console.log('\n[9] sniffB64Mime（b64 魔数嗅探，GIF 不能存成 png）')
{
  t('GIF → image/gif', sniffB64Mime('R0lGODlhAQABAAAAADs=') === 'image/gif')
  t('PNG → image/png', sniffB64Mime('iVBORw0KGgoAAAANSU') === 'image/png')
  t('JPEG → image/jpeg', sniffB64Mime('/9j/4AAQSkZJRg') === 'image/jpeg')
  t('WebP → image/webp', sniffB64Mime('UklGRhIAAABXRUJQVlA4TAY') === 'image/webp')
  t('未知前缀回退 png', sniffB64Mime('AAAA') === 'image/png')
}

console.log(`\n结果: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)

// 统一 AI 网关 - 协议适配层
// 职责：canonical（网关内部统一格式，OpenAI 风格）↔ 上游原生协议的双向转换。
// 纯函数、无 DB / 无 fetch，方便单测（scripts/gateway.test.mjs）。
//
// canonical chat payload（入口归一化后的形状）：
//   { messages: [{ role: 'system'|'user'|'assistant',
//                   content: string | [{type:'text',text} | {type:'image_url',image_url:{url}}] }],
//     max_tokens?, temperature?, top_p?, stop?: string[] }
//
// 三套协议覆盖市面绝大多数厂商：
//   openai    OpenAI 及一切兼容中转（DeepSeek / Kimi / GLM / 硅基流动 / OpenRouter / new-api 系…）
//   anthropic Claude 原生 /v1/messages（x-api-key + anthropic-version）
//   gemini    Google 原生 /v1beta/models/{model}:generateContent（x-goog-api-key）
//
// finish_reason 统一归一化到 OpenAI 词表：stop / length / content_filter / tool_calls。

export const PROTOCOLS = ['openai', 'anthropic', 'gemini']

// 注册表允许的模型能力（video 先注册、运行时 P2 支持）
export const MODEL_CAPABILITIES = ['chat', 'image_gen', 'image_edit', 'video']

// ============ 通用小工具 ============

/** base_url 归一化：去尾部斜杠、去尾部 /v1（兼容「带 /v1 的 OpenAI SDK 风格」配置） */
export function normalizeBaseUrl(baseUrl) {
  let s = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (/\/v1$/i.test(s)) s = s.replace(/\/v1$/i, '')
  return s
}

/** data:image/png;base64,xxx → { mime, b64 }；非 data URL 返回 null */
export function parseDataUrl(url) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(String(url || ''))
  return m ? { mime: m[1], b64: m[2] } : null
}

const FINISH_MAP = {
  end_turn: 'stop',
  stop_sequence: 'stop',
  max_tokens: 'length',
  STOP: 'stop',
  MAX_TOKENS: 'length',
  SAFETY: 'content_filter',
  RECITATION: 'content_filter',
  stop: 'stop',
  length: 'length',
  content_filter: 'content_filter',
  tool_calls: 'tool_calls',
}

/** 各家 finish 原因归一化到 OpenAI 词表 */
export function normalizeFinishReason(reason) {
  if (!reason) return null
  return FINISH_MAP[reason] || 'stop'
}

/** base64 魔数嗅探真实图片格式（上游可能返回 gif/webp/jpeg）——与 image-upstream.js 同实现 */
export function sniffB64Mime(b64) {
  const s = String(b64 || '')
  if (s.startsWith('R0lGOD')) return 'image/gif'
  if (s.startsWith('UklGR')) return 'image/webp'
  if (s.startsWith('/9j/')) return 'image/jpeg'
  if (s.startsWith('iVBOR')) return 'image/png'
  return 'image/png'
}

/** 前端 size 字符串 → Gemini aspectRatio —— 与 image-upstream.js 同实现 */
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

/** 提取 messages 里的 system 文本（转 anthropic system / gemini systemInstruction 用） */
function collectSystemText(messages) {
  const texts = []
  for (const m of messages) {
    if (m.role !== 'system') continue
    if (typeof m.content === 'string') {
      if (m.content) texts.push(m.content)
    } else if (Array.isArray(m.content)) {
      for (const p of m.content) {
        if (p?.type === 'text' && p.text) texts.push(p.text)
      }
    }
  }
  return texts.join('\n\n')
}

// ============ openai（含一切兼容中转） ============

const openaiAdapter = {
  buildChat(entry, canonical, { stream }) {
    const body = { model: entry.modelId, messages: canonical.messages }
    if (canonical.max_tokens != null) body.max_tokens = canonical.max_tokens
    if (canonical.temperature != null) body.temperature = canonical.temperature
    if (canonical.top_p != null) body.top_p = canonical.top_p
    if (canonical.stop) body.stop = canonical.stop
    if (stream) body.stream = true
    return {
      url: `${entry.baseUrl}/v1/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${entry.apiKey}`,
        ...(stream ? { Accept: 'text/event-stream' } : {}),
      },
      body,
    }
  },

  parseChat(json) {
    const choice = json?.choices?.[0]
    if (!choice) return null
    let content = choice.message?.content
    if (Array.isArray(content)) content = content.map((p) => p?.text || '').join('')
    return {
      content: typeof content === 'string' ? content : '',
      finish_reason: normalizeFinishReason(choice.finish_reason),
      usage: json.usage
        ? { input_tokens: json.usage.prompt_tokens, output_tokens: json.usage.completion_tokens }
        : null,
    }
  },

  extractStreamEvent(json) {
    const choice = json?.choices?.[0]
    if (!choice) return null
    const ev = {}
    const d = choice.delta || {}
    if (typeof d.content === 'string' && d.content) ev.delta = d.content
    // DeepSeek 系兼容中转的思维链字段
    if (typeof d.reasoning_content === 'string' && d.reasoning_content) ev.reasoning = d.reasoning_content
    if (choice.finish_reason) ev.finish = normalizeFinishReason(choice.finish_reason)
    if (json.usage) {
      ev.usage = { input_tokens: json.usage.prompt_tokens, output_tokens: json.usage.completion_tokens }
    }
    return Object.keys(ev).length ? ev : null
  },

  buildImageGen(entry, payload) {
    return {
      url: `${entry.baseUrl}/v1/images/generations`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${entry.apiKey}`,
      },
      body: { model: entry.modelId, prompt: payload.prompt, size: payload.size || '1024x1024' },
    }
  },

  parseImageGen(json) {
    const d = json?.data?.[0]
    if (d?.url) return d.url
    if (d?.b64_json) return `data:${sniffB64Mime(d.b64_json)};base64,${d.b64_json}`
    if (json?.url) return json.url
    return ''
  },
}

// ============ anthropic（Claude 原生） ============

/** canonical content → anthropic content blocks */
function toAnthropicContent(content) {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  const blocks = []
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string') {
      blocks.push({ type: 'text', text: part.text })
    } else if (part?.type === 'image_url') {
      const url = part.image_url?.url || ''
      const d = parseDataUrl(url)
      if (d) {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: d.mime, data: d.b64 } })
      } else if (/^https?:\/\//i.test(url)) {
        blocks.push({ type: 'image', source: { type: 'url', url } })
      }
    }
  }
  return blocks
}

const anthropicAdapter = {
  buildChat(entry, canonical, { stream }) {
    const system = collectSystemText(canonical.messages)
    const messages = []
    for (const m of canonical.messages) {
      if (m.role === 'system') continue
      messages.push({ role: m.role, content: toAnthropicContent(m.content) })
    }
    const body = {
      model: entry.modelId,
      // anthropic 的 max_tokens 必填
      max_tokens: canonical.max_tokens ?? 4096,
      messages,
    }
    if (system) body.system = system
    if (canonical.temperature != null) body.temperature = Math.min(1, Math.max(0, canonical.temperature))
    if (canonical.top_p != null) body.top_p = canonical.top_p
    if (canonical.stop) body.stop_sequences = canonical.stop
    if (stream) body.stream = true
    return {
      url: `${entry.baseUrl}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': entry.apiKey,
        'anthropic-version': '2023-06-01',
        ...(stream ? { Accept: 'text/event-stream' } : {}),
      },
      body,
    }
  },

  parseChat(json) {
    if (!json || !Array.isArray(json.content)) return null
    const content = json.content
      .filter((b) => b?.type === 'text')
      .map((b) => b.text || '')
      .join('')
    return {
      content,
      finish_reason: normalizeFinishReason(json.stop_reason),
      usage: json.usage
        ? { input_tokens: json.usage.input_tokens, output_tokens: json.usage.output_tokens }
        : null,
    }
  },

  extractStreamEvent(json) {
    // anthropic SSE：message_start → content_block_delta* → message_delta
    if (json?.type === 'message_start') {
      return { usage: { input_tokens: json.message?.usage?.input_tokens } }
    }
    if (json?.type === 'content_block_delta') {
      if (json.delta?.type === 'text_delta') return { delta: json.delta.text || '' }
      if (json.delta?.type === 'thinking_delta') return { reasoning: json.delta.thinking || '' }
      return null
    }
    if (json?.type === 'message_delta') {
      return {
        finish: normalizeFinishReason(json.delta?.stop_reason),
        usage: { output_tokens: json.usage?.output_tokens },
      }
    }
    return null
  },
}

// ============ gemini（Google 原生） ============

/** canonical content → gemini parts（http 外链图不支持，仅 data URL） */
function toGeminiParts(content) {
  if (typeof content === 'string') return [{ text: content }]
  const parts = []
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string') {
      parts.push({ text: part.text })
    } else if (part?.type === 'image_url') {
      const d = parseDataUrl(part.image_url?.url || '')
      if (d) parts.push({ inline_data: { mime_type: d.mime, data: d.b64 } })
    }
  }
  return parts.length ? parts : [{ text: '' }]
}

/** gemini chunk / response → { text, think }（thought=true 的 part 归思维链） */
function geminiExtractText(json) {
  const parts = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return { text: '', think: '' }
  let text = ''
  let think = ''
  for (const p of parts) {
    if (typeof p?.text !== 'string') continue
    if (p.thought) think += p.text
    else text += p.text
  }
  return { text, think }
}

const geminiAdapter = {
  buildChat(entry, canonical, { stream }) {
    const system = collectSystemText(canonical.messages)
    const contents = []
    for (const m of canonical.messages) {
      if (m.role === 'system') continue
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: toGeminiParts(m.content),
      })
    }
    const body = { contents }
    if (system) body.systemInstruction = { parts: [{ text: system }] }
    const gc = {}
    if (canonical.max_tokens != null) gc.maxOutputTokens = canonical.max_tokens
    if (canonical.temperature != null) gc.temperature = canonical.temperature
    if (canonical.top_p != null) gc.topP = canonical.top_p
    if (canonical.stop) gc.stopSequences = canonical.stop
    if (Object.keys(gc).length) body.generationConfig = gc
    const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
    return {
      url: `${entry.baseUrl}/v1beta/models/${encodeURIComponent(entry.modelId)}:${method}`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': entry.apiKey,
      },
      body,
    }
  },

  parseChat(json) {
    const cand = json?.candidates?.[0]
    if (!cand) return null
    const { text } = geminiExtractText(json)
    return {
      content: text,
      finish_reason: normalizeFinishReason(cand.finishReason),
      usage: json.usageMetadata
        ? {
            input_tokens: json.usageMetadata.promptTokenCount,
            output_tokens: json.usageMetadata.candidatesTokenCount,
          }
        : null,
    }
  },

  extractStreamEvent(json) {
    if (!json || !Array.isArray(json.candidates)) return null
    const ev = {}
    const { text, think } = geminiExtractText(json)
    if (text) ev.delta = text
    if (think) ev.reasoning = think
    const fr = json.candidates[0]?.finishReason
    if (fr) ev.finish = normalizeFinishReason(fr)
    if (json.usageMetadata) {
      ev.usage = {
        input_tokens: json.usageMetadata.promptTokenCount,
        output_tokens: json.usageMetadata.candidatesTokenCount,
      }
    }
    return Object.keys(ev).length ? ev : null
  },

  buildImageGen(entry, payload) {
    // 与线上验证过的 image-upstream.js 生图请求体保持一致
    return {
      url: `${entry.baseUrl}/v1beta/models/${encodeURIComponent(entry.modelId)}:generateContent`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': entry.apiKey,
      },
      body: {
        contents: [{ role: 'user', parts: [{ text: payload.prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: mapSizeToAspectRatio(payload.size) },
        },
      },
    }
  },

  parseImageGen(json) {
    const parts = json?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) return ''
    for (const part of parts) {
      if (part?.inline_data?.data) {
        const mime = part.inline_data.mime_type || 'image/png'
        return `data:${mime};base64,${part.inline_data.data}`
      }
    }
    return ''
  },
}

// ============ 注册表 ============

export const ADAPTERS = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
}

/**
 * 某协议当前是否支持某能力（运行时能力，随 adapter 扩充自动放开）
 *   chat / chat_stream → buildChat
 *   image_gen          → buildImageGen
 */
export function protocolSupports(protocol, capability) {
  const a = ADAPTERS[protocol]
  if (!a) return false
  if (capability === 'chat' || capability === 'chat_stream') return typeof a.buildChat === 'function'
  if (capability === 'image_gen') return typeof a.buildImageGen === 'function'
  return false
}

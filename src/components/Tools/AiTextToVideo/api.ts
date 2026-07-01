// AI 文生视频 API 服务层（数据驱动版）
// 全部走 /api/ai-proxy 通用代理，后端根据 model_key 从数据库读配置

export interface ChatParams {
  messages: Array<{ role: string; content: any }>
  temperature?: number
}

export interface ImageParams {
  prompt: string
  width: number
  height: number
  n?: number
}

export interface VideoSubmitParams {
  prompt: string
  frames: number
  width: number
  height: number
  images?: string[]
}

export interface VideoPollParams {
  videoId: string
}

// ============ 兼容垫片（旧 API 调用方）============

/** 兼容：把模型 ID 转为 modelKey。若已是 modelKey 格式（含/）则原样返回 */
function toModelKey(modelId: string): string {
  if (!modelId) return ''
  if (modelId.includes('/')) return modelId
  // 默认按 agnes 厂商映射
  return `agnes/${modelId}`
}

/**
 * 简化的流式对话（兼容旧版 API）
 * @param apiKey 用户 API Key（用于私有厂商覆盖）
 * @param message 用户消息
 * @param model 模型 ID
 * @param onChunk 增量回调
 */
export async function sendChatMessageStream(
  _apiKey: string,
  message: string,
  model: string = 'agnes-2.0-flash',
  onChunk: (content: string) => void
): Promise<string> {
  return chatStream(toModelKey(model), [{ role: 'user', content: message }], undefined, onChunk)
}

/**
 * 支持图片的对话（兼容旧版 API）
 */
export async function sendChatMessageWithImageStream(
  _apiKey: string,
  textMessage: string,
  imageBase64: string,
  model: string = 'agnes-2.0-flash',
  onChunk: (content: string) => void
): Promise<string> {
  const response = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capability: 'chat_stream',
      model_key: toModelKey(model),
      params: {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageBase64 } },
              { type: 'text', text: textMessage },
            ],
          },
        ],
      },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || err.error || `调用失败: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法获取响应流')

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(line => line.trim())

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.delta
        if (delta) {
          fullContent += delta
          onChunk?.(fullContent)
        }
      } catch {}
    }
  }

  return fullContent
}

/**
 * 简化的图生图接口（兼容旧版 API）
 */
export async function generateImageToImage(
  _apiKey: string,
  sourceImage: string,
  prompt: string,
  _strength: number = 0.7
): Promise<{ images: string[] }> {
  const urls = await editImage('agnes/agnes-image-2.1-flash', sourceImage, prompt)
  return { images: urls }
}

/**
 * 从 modelKey 提取 provider slug
 * 例如 'agnes/agnes-2.0-flash' → 'agnes'
 */
function getProviderSlug(modelKey: string): string {
  const slash = modelKey.indexOf('/')
  return slash > 0 ? modelKey.slice(0, slash) : modelKey
}

/**
 * 从 localStorage 读用户自定义 API Key（按 provider slug 分组）
 * 游客必填；登录用户可选（用来覆盖系统 key）
 */
function getUserApiKey(modelKey: string): string {
  try {
    const raw = localStorage.getItem('ai_user_api_keys_by_provider')
    if (!raw) return ''
    const map = JSON.parse(raw) as Record<string, string>
    const slug = getProviderSlug(modelKey)
    return map[slug] || map['*'] || ''
  } catch {
    return ''
  }
}

/**
 * 通用 AI 调用（非流式）
 */
async function callProxy(
  capability: string,
  modelKey: string,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<any> {
  const user_api_key = getUserApiKey(modelKey)
  const response = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capability, model_key: modelKey, params, user_api_key }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `调用失败: ${response.status}`)
  }

  const result = await response.json()
  if (!result.ok) {
    throw new Error(result.error || '调用失败')
  }
  return result.data
}

/**
 * 流式聊天
 * @param modelKey 业务唯一键，如 'agnes/agnes-2.0-flash'
 * @param messages OpenAI 格式消息数组
 * @param signal 中止信号
 * @param onChunk 增量回调（每次收到新内容）
 * @returns 完整内容
 */
export async function chatStream(
  modelKey: string,
  messages: Array<{ role: string; content: any }>,
  signal?: AbortSignal,
  onChunk?: (content: string) => void
): Promise<string> {
  const user_api_key = getUserApiKey(modelKey)
  const response = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capability: 'chat_stream',
      model_key: modelKey,
      params: { messages },
      user_api_key,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `调用失败: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法获取响应流')

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    if (signal?.aborted) {
      try { reader.cancel() } catch {}
      throw new DOMException('用户中止了请求', 'AbortError')
    }
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue

      try {
        const json = JSON.parse(data)
        const delta = json.delta
        if (delta) {
          fullContent += delta
          onChunk?.(fullContent)
        }
      } catch {
        // 忽略
      }
    }
  }

  return fullContent
}

/**
 * 非流式对话
 */
export async function chat(
  modelKey: string,
  messages: Array<{ role: string; content: any }>,
  signal?: AbortSignal
): Promise<string> {
  const data = await callProxy('chat', modelKey, { messages }, signal)
  return data.content || ''
}

/**
 * 生成图片
 */
export async function generateImage(
  modelKey: string,
  prompt: string,
  opts: { width: number; height: number; n?: number }
): Promise<string[]> {
  const data = await callProxy('image_generation', modelKey, {
    prompt,
    width: opts.width,
    height: opts.height,
    n: opts.n || 1,
  })
  return data.url ? [data.url] : []
}

/**
 * 图生图
 */
export async function editImage(
  modelKey: string,
  sourceImage: string,
  prompt: string,
  width?: number,
  height?: number
): Promise<string[]> {
  const data = await callProxy('image_edit', modelKey, {
    prompt,
    source_image: sourceImage,
    ...(Number.isFinite(width) ? { width } : {}),
    ...(Number.isFinite(height) ? { height } : {}),
  })
  return data.url ? [data.url] : []
}

/**
 * 提交视频任务
 */
export async function submitVideoTask(
  modelKey: string,
  prompt: string,
  opts: VideoSubmitParams
): Promise<string> {
  const data = await callProxy('video_submit', modelKey, {
    prompt,
    frames: opts.frames,
    width: opts.width,
    height: opts.height,
    images: opts.images || [],
  })
  return data.video_id
}

/**
 * 轮询视频状态
 */
export async function pollVideoStatus(
  modelKey: string,
  videoId: string,
  onProgress?: (status: string) => void
): Promise<string> {
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 5000))

    const data = await callProxy('video_poll', modelKey, { video_id: videoId })
    const status = data.status

    if (onProgress) onProgress(status)

    if (status === 'completed') {
      return data.remix_id || data.url
    } else if (status === 'failed') {
      throw new Error('视频生成失败')
    }
    // 其他状态继续轮询
  }
}

/**
 * 生成优化后的提示词（用 chat 能力）
 */
export async function generateOptimizedPrompt(
  modelKey: string,
  topic: string
): Promise<string> {
  const prompt = `请将以下主题扩展为专业的视频生成提示词（英文），要求：
1. 详细描述主体、动作、场景细节
2. 包含镜头运动描述（tracking shot, close-up, wide angle 等）
3. 包含光照描述（golden hour, soft lighting, dramatic 等）
4. 包含视觉风格（cinematic, realistic, dreamy 等）
5. 只输出英文提示词，不要其他内容

主题：${topic}`

  return chat(modelKey, [{ role: 'user', content: prompt }])
}
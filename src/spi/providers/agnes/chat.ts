import { ChatMessage, ChatOptions, ChatResponse } from '../../common/interfaces'

/**
 * Agnes 免费对话（走 /api/ai-proxy 通用代理）
 * 支持流式与非流式，非流式即非流式版。
 * 流式：透传 SSE，按 output_paths 抽取 delta 内容。
 */
export async function chat(
  this: any,
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<ChatResponse> {
  // model 可能是 'agnes-2.5-flash' 或 'agnes/agnes-2.5-flash'，统一补全前缀
  const raw = options?.model || this.defaultModel || 'agnes-2.5-flash'
  const modelKey = raw.includes('/') ? raw : `agnes/${raw}`

  try {
    if (options?.stream && options?.onChunk) {
      // ----- 流式 -----
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capability: 'chat_stream',
          model_key: modelKey,
          params: { messages },
        }),
        signal: options.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `调用失败: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      try {
        while (true) {
          if (options.signal?.aborted) {
            throw new DOMException('流式请求被终止', 'AbortError')
          }
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (!data || data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.delta
              if (delta) {
                fullContent += delta
                options.onChunk!(delta)
              }
            } catch {
              // 忽略无法解析的块
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      return {
        content: fullContent || '抱歉，我没有理解您的问题，请重新描述一下。',
        model: modelKey,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }
    } else {
      // ----- 非流式 -----
      const data = await callAgnesProxy('chat', modelKey, { messages }, options?.signal)
      return {
        content: data.content || '抱歉，我没有理解您的问题，请重新描述一下。',
        model: modelKey,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      }
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as any).name === 'AbortError'
    ) {
      throw error
    }
    console.error('Agnes API 调用失败:', error)
    throw new Error('AI服务暂时不可用，请稍后重试')
  }
}

// 通用代理调用（复用 ai-proxy 约定）
async function callAgnesProxy(
  capability: string,
  modelKey: string,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<any> {
  const response = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capability, model_key: modelKey, params }),
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
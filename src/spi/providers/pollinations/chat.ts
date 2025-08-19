import { ChatMessage, ChatOptions, ChatResponse } from '../../common/interfaces'
import axios from 'axios'

export async function chat(
  this: any,
  messages: ChatMessage[], 
  options?: ChatOptions
): Promise<ChatResponse> {
  if (!this.apiKey || !this.proxyUrl || !this.textUrl) {
    throw new Error('API配置不完整')
  }

  // 构建 OpenAI 兼容的请求体
  const requestBody = {
    model: options?.model || 'gpt-3.5-turbo',
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    temperature: options?.temperature || 0.7,
    max_tokens: options?.maxTokens || 2000,
    stream: false
  }

  // 通过代理发送 POST 请求
  const response = await axios.post(
    `${this.proxyUrl}?path=openai&target=${this.textUrl}&params=_t=${Date.now()}`,
    requestBody,
    { 
      headers: { 
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  )

  // 处理 OpenAI 兼容的响应格式
  let content = ''
  if (response.data && response.data.choices && response.data.choices.length > 0) {
    content = response.data.choices[0].message?.content || ''
  } else if (typeof response.data === 'string') {
    content = response.data
  } else {
    content = String(response.data)
  }

  // 清理AI回复中的多余内容
  const cleanResponse = content
    .replace(/^回答：/, '')
    .replace(/^AI助手：/, '')
    .trim()

  return {
    content: cleanResponse || '抱歉，我没有理解您的问题，请重新描述一下。',
    model: requestBody.model,
    usage: {
      promptTokens: response.data?.usage?.prompt_tokens || 0,
      completionTokens: response.data?.usage?.completion_tokens || 0,
      totalTokens: response.data?.usage?.total_tokens || 0
    }
  }
}


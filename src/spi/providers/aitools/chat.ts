import { ChatMessage, ChatOptions, ChatResponse } from '../../common/interfaces'
import axios from 'axios'

export async function chat(
  this: any,
  messages: ChatMessage[], 
  options?: ChatOptions
): Promise<ChatResponse> {
  if (!this.apiKey || !this.baseUrl) {
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

  try {
    // 直接调用 AiTools API
    const response = await axios.post(
      `${this.baseUrl}/v1/chat/completions`,
      requestBody,
      { 
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
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

    return {
      content: content.trim(),
      model: requestBody.model,
      usage: {
        promptTokens: response.data?.usage?.prompt_tokens || 0,
        completionTokens: response.data?.usage?.completion_tokens || 0,
        totalTokens: response.data?.usage?.total_tokens || 0
      }
    }
  } catch (error) {
    console.error('AiTools API 调用失败:', error)
    throw new Error('AI服务暂时不可用，请稍后重试')
  }
}

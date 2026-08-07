import { AIProvider } from '../../common/interfaces'
import { chat } from './chat'

/**
 * Agnes 免费 AI 提供者。
 * 走站内 /api/ai-proxy 通用代理，无需前端 API Key。
 */
export class AgnesProvider implements AIProvider {
  name = 'agnes'
  version = '1.0.0'
  capabilities = ['chat', 'chat_stream']

  public defaultModel: string

  constructor(config?: { defaultModel?: string }) {
    this.defaultModel = config?.defaultModel || 'agnes-2.5-flash'
  }

  chat = chat.bind(this)
}

// 工厂函数
export function createAgnesProvider(config?: { defaultModel?: string }) {
  return new AgnesProvider(config)
}
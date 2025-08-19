import { AIProvider } from '../../common/interfaces'
import { chat } from './chat'

export class AiToolsProvider implements AIProvider {
  name = 'AiTools'
  version = '1.0.0'
  capabilities = ['chat', 'text-processing']
  
  public apiKey: string
  public baseUrl: string
  
  constructor(config: {
    apiKey: string
    baseUrl?: string
  }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.aitools.com'
  }
  
  // 绑定 chat 方法
  chat = chat.bind(this)
}

export function createAiToolsProvider(config: {
  apiKey: string
  baseUrl?: string
}) {
  return new AiToolsProvider(config)
}


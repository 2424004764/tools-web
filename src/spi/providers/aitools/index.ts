import { AIProvider } from '../../common/interfaces'
import { chat } from './chat'

export class AiToolsProvider implements AIProvider {
  name = 'AiTools'
  version = '1.0.0'
  capabilities = ['chat', 'text-processing']
  
  public apiKey: string
  public baseUrl: string
  public proxyUrl: string // 新增代理URL
  
  constructor(config: {
    apiKey: string
    baseUrl?: string
    proxyUrl: string // 新增代理URL参数
  }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://platform.aitools.cfd'
    this.proxyUrl = config.proxyUrl
  }
  
  // 绑定 chat 方法
  chat = chat.bind(this)
}

export function createAiToolsProvider(config: {
  apiKey: string
  baseUrl?: string
  proxyUrl: string // 新增代理URL参数
}) {
  return new AiToolsProvider(config)
}


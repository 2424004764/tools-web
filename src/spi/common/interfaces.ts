// 通用AI提供者接口
export interface AIProvider {
  name: string
  version: string
  capabilities: string[]
  
  // 对话功能
  chat?: (messages: ChatMessage[], options?: ChatOptions) => Promise<ChatResponse>
  
  // 图像生成
  generateImage?: (prompt: string, options?: ImageOptions) => Promise<ImageResponse>
  
  // 文本处理
  // processText?: (text: string, options?: TextOptions) => Promise<TextResponse>
}

// 通用消息类型
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

// 通用选项类型
export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  onChunk?: (chunk: string) => void // 流式输出回调函数
  signal?: AbortSignal // 新增：终止信号
}

export interface ImageOptions {
  model?: string
  width?: number
  height?: number
  quality?: string
  style?: string
}

// 通用响应类型
export interface ChatResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface ImageResponse {
  url: string
  model: string
  metadata?: Record<string, any>
}

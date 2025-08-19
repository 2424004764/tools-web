import { AIProvider } from './common/interfaces'

// AI提供者管理器
export class AIProviderManager {
  private providers: Map<string, AIProvider> = new Map()
  
  // 注册提供者
  registerProvider(name: string, provider: AIProvider) {
    this.providers.set(name, provider)
  }
  
  // 获取提供者
  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name)
  }
  
  // 获取所有提供者
  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values())
  }
  
  // 根据能力获取提供者
  getProvidersByCapability(capability: string): AIProvider[] {
    return this.getAllProviders().filter(p => 
      p.capabilities.includes(capability)
    )
  }
  
  // 检查提供者是否已注册
  hasProvider(name: string): boolean {
    return this.providers.has(name)
  }
}

// 创建默认管理器实例
export const aiManager = new AIProviderManager()

// 导出类型
export * from './common/interfaces'
export * from './providers/pollinations'
export * from './providers/aitools'

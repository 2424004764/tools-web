import { aiManager } from './index'
import { createAgnesProvider } from './providers/agnes'

// 初始化AI提供者
export function initializeAIProviders() {
  // 注册 Agnes（免费，走站内代理，默认启用）
  aiManager.registerProvider(
    'agnes',
    createAgnesProvider({ defaultModel: 'agnes-2.5-flash' })
  )
  console.log('Agnes AI提供者已注册')

  // 打印已注册的提供者
  const providers = aiManager.getAllProviders()
  console.log('已注册的提供者:', providers.map(p => p.name))
}

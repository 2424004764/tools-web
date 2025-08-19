import { aiManager } from './index'
import { createPollinationsProvider } from './providers/pollinations'
import { createAiToolsProvider } from './providers/aitools'

// 初始化AI提供者
export function initializeAIProviders() {
  // 注册Pollinations
  if (import.meta.env.VITE_POLLINATIONS_API_KEY) {
    const pollinations = createPollinationsProvider({
      apiKey: import.meta.env.VITE_POLLINATIONS_API_KEY,
      proxyUrl: import.meta.env.VITE_POLLINATIONS_PROXY_URL || '',
      textUrl: import.meta.env.VITE_POLLINATIONS_TEXT_URL || '',
      imageUrl: import.meta.env.VITE_POLLINATIONS_URL || ''
    })
    aiManager.registerProvider('pollinations', pollinations)
    console.log('Pollinations AI提供者已注册')
  } else {
    console.warn('Pollinations API密钥未配置')
  }
  
  // 注册AiTools
  if (import.meta.env.VITE_AITOOLS_API_KEY) {
    const aitools = createAiToolsProvider({
      apiKey: import.meta.env.VITE_AITOOLS_API_KEY,
      proxyUrl: import.meta.env.VITE_POLLINATIONS_PROXY_URL || '' // 使用与Pollinations相同的代理
    })
    aiManager.registerProvider('aitools', aitools)
    console.log('AiTools AI提供者已注册')
  } else {
    console.warn('AiTools API密钥未配置')
  }
  
  // 打印已注册的提供者
  const providers = aiManager.getAllProviders()
  console.log('已注册的AI提供者:', providers.map(p => p.name))
}

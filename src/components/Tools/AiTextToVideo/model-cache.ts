// AI 模型配置缓存
// 5 分钟 TTL，避免每次调用都请求数据库
// 监听 ai-model-config-changed 事件自动失效

export interface ModelConfig {
  id: number
  uid: string
  provider_id: number
  name: string
  model_key: string
  model_id: string
  capabilities: string[]
  endpoints: Record<string, { path: string; method?: string; query?: string }>
  input_template: Record<string, any>
  output_paths: Record<string, any>
  description?: string
  icon?: string
  sort_order?: number
  status?: number
  provider_slug?: string
  provider_name?: string
  provider_public?: number
}

const CACHE_TTL = 5 * 60_000
const cache = new Map<string, { value: ModelConfig; expires: number }>()
let inflight: Map<string, Promise<ModelConfig | null>> = new Map()

/**
 * 获取模型配置（带缓存）
 */
export async function getCachedModel(modelKey: string): Promise<ModelConfig | null> {
  if (!modelKey) return null

  // 1. 命中缓存
  const hit = cache.get(modelKey)
  if (hit && hit.expires > Date.now()) {
    return hit.value
  }

  // 2. 避免并发请求同一 key
  if (inflight.has(modelKey)) {
    return inflight.get(modelKey)!
  }

  // 3. 发起请求
  const promise = fetch(`/api/ai-models?model_key=${encodeURIComponent(modelKey)}`)
    .then(res => res.json())
    .then(json => {
      if (json.success && json.data) {
        // 解析 JSON 字段
        const model: ModelConfig = {
          ...json.data,
          capabilities: safeParseArr(json.data.capabilities),
          endpoints: safeParseObj(json.data.endpoints),
          input_template: safeParseObj(json.data.input_template),
          output_paths: safeParseObj(json.data.output_paths),
        }
        cache.set(modelKey, { value: model, expires: Date.now() + CACHE_TTL })
        return model
      }
      return null
    })
    .catch(err => {
      console.error('getCachedModel error:', err)
      return null
    })
    .finally(() => {
      inflight.delete(modelKey)
    })

  inflight.set(modelKey, promise)
  return promise
}

/**
 * 失效缓存（指定 key 或全部）
 */
export function invalidateModelCache(modelKey?: string) {
  if (modelKey) {
    cache.delete(modelKey)
  } else {
    cache.clear()
  }
}

/**
 * 通知缓存失效（跨组件）
 */
export function notifyModelConfigChanged(modelKey?: string) {
  invalidateModelCache(modelKey)
  window.dispatchEvent(
    new CustomEvent('ai-model-config-changed', { detail: { modelKey } })
  )
}

// 监听跨组件失效事件
if (typeof window !== 'undefined') {
  window.addEventListener('ai-model-config-changed', (e: any) => {
    invalidateModelCache(e.detail?.modelKey)
  })
}

function safeParseArr(s: any): string[] {
  if (Array.isArray(s)) return s
  if (typeof s === 'string') {
    try { return JSON.parse(s) } catch { return [] }
  }
  return []
}

function safeParseObj(s: any): Record<string, any> {
  if (s && typeof s === 'object' && !Array.isArray(s)) return s
  if (typeof s === 'string') {
    try { return JSON.parse(s) } catch { return {} }
  }
  return {}
}
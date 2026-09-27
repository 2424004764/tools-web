import { functionsRequest } from '@/utils/functionsRequest'

export type CommentSystemType = 'giscus' | 'custom'

export interface GiscusConfig {
  /** owner/repo；为空时前端回退到 VITE_GIT_URL 解析 */
  repo: string
  repo_id: string
  category: string
  category_id: string
  mapping: string
}

export interface SiteConfig {
  comment_system: CommentSystemType
  giscus: GiscusConfig
}

/** 模块级缓存：评论配置全站只需要拉一次 */
let cachedConfig: SiteConfig | null = null
let configPromise: Promise<SiteConfig> | null = null

/** 获取站点配置（评论系统相关），带模块级缓存 */
export async function fetchSiteConfig(force = false): Promise<SiteConfig> {
  if (!force && cachedConfig) return cachedConfig
  if (!force && configPromise) return configPromise

  configPromise = functionsRequest
    .get('/api/site-config')
    .then((res) => {
      cachedConfig = res.data.data as SiteConfig
      return cachedConfig
    })
    .catch((err) => {
      // 拉取失败时回退到 giscus（保持原有行为），不阻塞页面
      console.warn('[site-config] 拉取失败，回退到 giscus', err)
      return {
        comment_system: 'giscus',
        giscus: { repo: '', repo_id: '', category: '', category_id: '', mapping: 'title' },
      } as SiteConfig
    })
    .finally(() => {
      configPromise = null
    })

  return configPromise
}

/** 供设置保存成功后刷新缓存 */
export function clearSiteConfigCache() {
  cachedConfig = null
}

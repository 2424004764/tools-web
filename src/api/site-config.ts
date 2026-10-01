import { functionsRequest } from '@/utils/functionsRequest'

export type CommentSystemType = 'giscus' | 'custom' | 'disabled'

export interface GiscusConfig {
  /** owner/repo；为空时前端回退到 VITE_GIT_URL 解析 */
  repo: string
  repo_id: string
  category: string
  category_id: string
  mapping: string
}

const EMPTY_GISCUS: GiscusConfig = {
  repo: '',
  repo_id: '',
  category: '',
  category_id: '',
  mapping: 'title',
}

// 模块级缓存：配置全站只需拉一次（后台保存后由 clearSiteConfigCache 失效）
let cachedSystem: CommentSystemType | null = null
let systemPromise: Promise<CommentSystemType> | null = null
let cachedGiscus: GiscusConfig | null = null
let giscusPromise: Promise<GiscusConfig> | null = null

/**
 * 拉取评论系统类型（GET /api/site-config?config_key=comment_system），带模块级缓存。
 * 失败时回退 giscus（保持原有行为），不阻塞页面。
 */
export async function fetchCommentSystem(force = false): Promise<CommentSystemType> {
  if (!force && cachedSystem) return cachedSystem
  if (!force && systemPromise) return systemPromise

  systemPromise = functionsRequest
    .get('/api/site-config?config_key=comment_system')
    .then((res) => {
      cachedSystem = res.data.data.comment_system as CommentSystemType
      return cachedSystem
    })
    .catch((err) => {
      console.warn('[site-config] 评论系统类型拉取失败，回退到 giscus', err)
      return 'giscus' as CommentSystemType
    })
    .finally(() => {
      systemPromise = null
    })

  return systemPromise
}

/**
 * 拉取 giscus 配置（GET /api/site-config?config_key=giscus），带模块级缓存。
 * 仅在评论系统类型为 giscus 时调用。
 */
export async function fetchGiscusConfig(force = false): Promise<GiscusConfig> {
  if (!force && cachedGiscus) return cachedGiscus
  if (!force && giscusPromise) return giscusPromise

  giscusPromise = functionsRequest
    .get('/api/site-config?config_key=giscus')
    .then((res) => {
      cachedGiscus = res.data.data as GiscusConfig
      return cachedGiscus
    })
    .catch((err) => {
      console.warn('[site-config] giscus 配置拉取失败，使用空配置', err)
      return EMPTY_GISCUS
    })
    .finally(() => {
      giscusPromise = null
    })

  return giscusPromise
}

/** 供设置保存成功后刷新缓存 */
export function clearSiteConfigCache() {
  cachedSystem = null
  systemPromise = null
  cachedGiscus = null
  giscusPromise = null
}

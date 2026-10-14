import { functionsRequest } from '@/utils/functionsRequest'
import { DEFAULT_PRODUCTS, type ProductInfo } from '@/components/Layout/Header/products'

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
let cachedProducts: ProductInfo[] | null = null
let productsPromise: Promise<ProductInfo[]> | null = null

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

/**
 * 拉取「更多产品」矩阵（GET /api/site-config?config_key=products），带模块级缓存。
 * 后端只返回 enabled 的产品：null = 后台未配置（回退内置默认），[] = 全部隐藏（前台不展示入口）。
 * 请求失败时同样回退内置默认，保持原有行为。
 */
export async function fetchProductsConfig(force = false): Promise<ProductInfo[]> {
  if (!force && cachedProducts) return cachedProducts
  if (!force && productsPromise) return productsPromise

  productsPromise = functionsRequest
    .get('/api/site-config?config_key=products')
    .then((res) => {
      const list = res.data.data.products
      cachedProducts = Array.isArray(list) ? normalizeProducts(list) : DEFAULT_PRODUCTS
      return cachedProducts
    })
    .catch((err) => {
      console.warn('[site-config] 更多产品配置拉取失败，使用内置默认', err)
      return DEFAULT_PRODUCTS
    })
    .finally(() => {
      productsPromise = null
    })

  return productsPromise
}

// 防御性归一化：脏数据字段兜底为空串，缺关键字段的条目直接丢弃
function normalizeProducts(list: unknown[]): ProductInfo[] {
  return list
    .filter(
      (p): p is Record<string, unknown> =>
        !!p && typeof p === 'object' && typeof (p as any).key === 'string' &&
        !!(p as any).name && !!(p as any).url,
    )
    .map((p) => ({
      key: String(p.key),
      name: String(p.name),
      desc: String((p as any).desc ?? ''),
      url: String(p.url),
      logo: String((p as any).logo ?? ''),
    }))
}

/** 供设置保存成功后刷新缓存 */
export function clearSiteConfigCache() {
  cachedSystem = null
  systemPromise = null
  cachedGiscus = null
  giscusPromise = null
  cachedProducts = null
  productsPromise = null
}

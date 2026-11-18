import { functionsRequest } from '@/utils/functionsRequest'
import { DEFAULT_PRODUCTS, type ProductInfo } from '@/components/Layout/Header/products'

export type CommentSystemType = 'giscus' | 'custom' | 'disabled'

/** 充值页展示方式：faka = 发卡网在线充值，contact = 联系站长充值 */
export type RechargeMode = 'faka' | 'contact'

/** 充值套餐（发卡网商品），price 单位为元 */
export interface RechargePackageInfo {
  id: string
  name: string
  price: number
  credits: number
  url: string
  tag?: string
}

/** 内置默认套餐（后台未配置时的兜底，与历史硬编码保持一致） */
export const DEFAULT_RECHARGE_PACKAGES: RechargePackageInfo[] = [
  {
    id: 'pkg-1yuan',
    name: '基础体验包',
    price: 1,
    credits: 100,
    url: 'https://9wa.br3.cn/vw',
    tag: '入门',
  },
]

/** 充值页配置（/api/site-config?config_key=recharge 的归一化结果） */
export interface RechargeConfig {
  mode: RechargeMode
  /** 仅 contact 模式返回，其余为空串 */
  qq: string
  /** 仅 faka 模式返回；未配置/脏数据回退内置默认 */
  packages: RechargePackageInfo[]
}

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
let cachedRecharge: RechargeConfig | null = null
let rechargePromise: Promise<RechargeConfig> | null = null

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

/**
 * 拉取充值页配置（GET /api/site-config?config_key=recharge），带模块级缓存。
 * faka 模式下套餐未配置/脏数据回退内置默认；请求失败回退默认发卡网模式，不阻塞页面。
 */
export async function fetchRechargeConfig(force = false): Promise<RechargeConfig> {
  if (!force && cachedRecharge) return cachedRecharge
  if (!force && rechargePromise) return rechargePromise

  rechargePromise = functionsRequest
    .get('/api/site-config?config_key=recharge')
    .then((res) => {
      const data = res.data.data || {}
      const mode: RechargeMode = data.mode === 'contact' ? 'contact' : 'faka'
      cachedRecharge = {
        mode,
        qq: mode === 'contact' ? String(data.qq || '') : '',
        packages:
          mode === 'faka' && Array.isArray(data.packages)
            ? normalizeRechargePackages(data.packages)
            : DEFAULT_RECHARGE_PACKAGES,
      }
      return cachedRecharge
    })
    .catch((err) => {
      console.warn('[site-config] 充值配置拉取失败，使用内置默认', err)
      return { mode: 'faka' as RechargeMode, qq: '', packages: [...DEFAULT_RECHARGE_PACKAGES] }
    })
    .finally(() => {
      rechargePromise = null
    })

  return rechargePromise
}

// 防御性归一化：脏数据字段兜底，缺关键字段的条目直接丢弃；全空回退内置默认
function normalizeRechargePackages(list: unknown[]): RechargePackageInfo[] {
  const normalized = list
    .filter(
      (p): p is Record<string, unknown> =>
        !!p && typeof p === 'object' && typeof (p as any).name === 'string' && !!(p as any).name &&
        typeof (p as any).url === 'string' && /^https?:\/\//i.test((p as any).url) &&
        Number((p as any).price) > 0 && Number.isSafeInteger(Number((p as any).credits)) && Number((p as any).credits) > 0,
    )
    .map((p) => ({
      id: String(p.id ?? p.url),
      name: String(p.name),
      price: Number(p.price),
      credits: Number(p.credits),
      url: String(p.url),
      ...(typeof p.tag === 'string' && p.tag ? { tag: p.tag } : {}),
    }))
  return normalized.length ? normalized : [...DEFAULT_RECHARGE_PACKAGES]
}

/** 供设置保存成功后刷新缓存 */
export function clearSiteConfigCache() {
  cachedSystem = null
  systemPromise = null
  cachedGiscus = null
  giscusPromise = null
  cachedProducts = null
  productsPromise = null
  cachedRecharge = null
  rechargePromise = null
}

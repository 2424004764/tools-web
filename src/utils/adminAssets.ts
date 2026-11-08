/**
 * Admin 静态资源票据保障
 *
 * admin 页面 chunk（js/<releaseId>-AdminXxx-<hash>.js）由边缘网关按 HttpOnly
 * cookie（adm_assets，见 functions/utils/asset-ticket.js）鉴权下发，而浏览器
 * dynamic import 的请求无法携带 Authorization 头。因此进入 /admin 前必须先
 * 调用 /api/admin/asset-ticket 拿到票据 cookie，否则 chunk 加载会被 403。
 *
 * 单飞封装：每次页面加载首次进入后台时请求一次；票据 TTL 1 小时且每次 admin
 * API 调用都会由后端滑动续期，SPA 会话内无需反复请求。请求失败时清空缓存并
 * 抛错，由路由守卫决定是否放行（chunk 加载失败有 router.onError 兜底硬刷）。
 */
import { functionsRequest } from './functionsRequest'

let ticketPromise: Promise<void> | null = null

export function ensureAdminAssetTicket(): Promise<void> {
  ticketPromise ||= functionsRequest
    .get('/api/admin/asset-ticket')
    .then(() => undefined)
    .catch((error) => {
      ticketPromise = null
      throw error
    })
  return ticketPromise
}

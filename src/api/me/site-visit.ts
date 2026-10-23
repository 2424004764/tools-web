// 用户端网站访问记录 API 封装（站点级 PV）
import { functionsRequest } from '@/utils/functionsRequest'

/**
 * 上报一次页面访问。
 * 后端对无效请求静默 noop；前端失败也仅 console.warn（见 utils/site-visit.ts 兜底）。
 * @param path 页面 SPA 路由（如 '/' / '/img-puzzle/'）
 * @param source 推广来源（utm_source 优先 → referer 指纹 → 'direct'）
 */
export async function postSiteVisit(path: string, source: string): Promise<void> {
  await functionsRequest.post('/api/me/site-visit', {
    path,
    source,
  })
}

// 网站访问埋点（站点级 PV）
//
// 与 utils/tool-usage.ts（工具使用打点）的关键区别：
//   1. 不去重：每次路由成功导航都记一条（重复刷新也算一次），观测全站真实访问量
//   2. 不限工具页：首页 / 博客 / 活动页等任意页面都记录
//   3. 不要求登录：未登录也上报（后端 uid 留空），登录用户带 uid

import { detectSource } from './source'

/** 上报一次页面访问。fire-and-forget：失败仅 console.warn，绝不抛错、不 await */
export function recordSiteVisit(path: string): void {
  try {
    // 推广来源解析（utm_source 优先 → referer 指纹 → direct）；
    // detectSource 内部锁定到 sessionStorage，同一会话共享同一来源
    const source = detectSource()

    // 动态 import 避免循环依赖；fire-and-forget
    void import('@/api/me/site-visit')
      .then(({ postSiteVisit }) => postSiteVisit(path, source))
      .catch((err) => {
        console.warn('[site-visit] record failed:', err?.message || err)
      })
  } catch (err) {
    console.warn('[site-visit] record failed:', (err as Error)?.message || err)
  }
}

/**
 * 路由 afterEach 用的守卫：判断该路径是否需要打站点 PV。
 * 排除：
 *   - /admin（后台自己刷自己会污染数据）
 *   - /login（登录回调/跳转页，噪音大）
 *   - /api 前缀（正常不会成为 SPA 路由，防御性兜底）
 */
export function shouldTrackSiteVisit(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.startsWith('/api/')) return false
  if (path.startsWith('/admin')) return false
  if (path === '/login') return false
  return true
}

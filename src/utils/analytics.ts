/**
 * Cloudflare Web Analytics 注入器
 *
 * 历史背景：原 index.html 硬编码了作者自己的 beacon token，
 * 项目开源后 fork 用户部署时会把所有访问数据打到作者账号。
 *
 * 现改为读取环境变量 VITE_CF_ANALYTICS_TOKEN：
 *   - 已配置 → 注入 beacon.min.js 上报到对应 token 的 CF 后台
 *   - 未配置 → 不注入，零配置也能跑
 *
 * 开发者注意：Vite 仅会以 `VITE_` 开头的环境变量暴露给客户端。
 */

/** 注入标记，避免 HMR / 路由切换时重复注入 */
const SCRIPT_FLAG = 'script[data-cf-analytics-injected]'

/**
 * 动态注入 Cloudflare Web Analytics 脚本
 * 仅在生产环境（import.meta.env.PROD === true）下由 main.ts 调用
 */
export function injectCloudflareAnalytics(): void {
  const token = import.meta.env.VITE_CF_ANALYTICS_TOKEN

  // 未配置或空字符串 → 跳过（开源 fork 用户零配置即可关闭统计）
  if (!token || typeof token !== 'string') return

  // 防止重复注入（HMR、严格模式下 main.ts 被多次执行等）
  if (document.querySelector(SCRIPT_FLAG)) return

  const s = document.createElement('script')
  s.defer = true
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  // 用 dataset 标记 + data-cf-beacon 二者配合，方便人工排查
  s.setAttribute(SCRIPT_FLAG, '')
  s.dataset.cfBeacon = JSON.stringify({ token })
  document.head.appendChild(s)
}

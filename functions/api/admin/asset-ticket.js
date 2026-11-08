/**
 * Admin 静态资源票据签发端点
 *
 * 前端路由守卫在进入 /admin 前调用（见 src/utils/adminAssets.ts 的单飞封装），
 * 拿到 adm_assets HttpOnly cookie 后，浏览器才能通过 dynamic import 下载
 * admin chunk（functions/_middleware.js 按 cookie 验签放行）。
 *
 * 本文件位于 functions/api/admin/ 下，自动被同目录 _middleware.js 覆盖：
 * 走到这里说明请求已通过 Bearer JWT + D1 is_admin 校验，data.adminUid 可用。
 */

import { mintAssetTicket, assetTicketCookie, ASSET_TICKET_COOKIE } from '../../utils/asset-ticket.js'

export async function onRequest(context) {
  const { data, env } = context
  const uid = data && data.adminUid
  if (!uid) {
    return new Response(JSON.stringify({ success: false, error: '请先登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  const secret = env && env.JWT_SECRET
  if (!secret) {
    return new Response(JSON.stringify({ success: false, error: '服务未配置' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  const ticket = await mintAssetTicket(uid, secret)
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': assetTicketCookie(ticket),
      'Cache-Control': 'no-store',
      // 响应头里回显 cookie 名，便于前端调试确认（不含票据值）
      'X-Asset-Ticket': ASSET_TICKET_COOKIE,
    },
  })
}

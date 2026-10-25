// /cron/* 定时任务端点鉴权（2026-10 安全加固）
//
// 背景：/cron/clean-chat 由 GitHub Actions 每日调用（.github/workflows/clean-chat.yml），
// /cron/test 是联调用端点。此前两者都无鉴权，任何人都能直接触发。
//
// 用法：调度方必须带请求头 X-Cron-Secret，值等于 Pages 环境变量 CRON_SECRET。
// CRON_SECRET 未配置时一律拒绝（fail-closed）——宁可定时任务失败告警，
// 也不能在忘配密钥的情况下裸奔上线。
//
// 部署前置条件（两处值必须一致）：
//   1. Cloudflare Pages 项目 Settings → Environment variables 添加 CRON_SECRET
//   2. GitHub 仓库 Settings → Secrets and variables → Actions 添加 CRON_SECRET

import { secureCompare } from './secure-compare.js'

export function isCronAuthorized(request, env) {
  const expected = env && env.CRON_SECRET
  if (!expected) return false
  const provided = request.headers.get('X-Cron-Secret')
  // 恒时比较：cron 端点无限流，=== 的短路差异理论上可被计时侧信道逐字节探测
  return !!provided && secureCompare(provided, expected)
}

export function cronUnauthorized() {
  return new Response(JSON.stringify({ success: false, error: '未授权的定时任务调用' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

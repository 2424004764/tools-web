// 认证接口限流 / 锁定 —— 基于 KV 固定窗口计数
//
// 背景：安全审计发现「验证码发送、验证码登录、密码登录」无频率限制与锁定，
// 存在邮件轰炸、验证码爆破、密码撞库风险。本模块提供两类原语：
//   1. hitLimit            —— 固定窗口计数限流（窗口内最多 N 次）
//   2. recordAuthFail 等   —— 连续失败 N 次后临时锁定（密码登录防爆破）
//
// 存储：复用 VERIFICATION_CODES KV（键统一 rl: 前缀，与 vcode: 不冲突）。
// 如需隔离可单独建 RATE_LIMIT 命名空间，仅需替换调用方的 env 取值。
//
// 已知限制（取舍）：
//   - KV 是最终一致存储，跨节点可见性有最长约 60s 延迟，分布式低频攻击下
//     计数可能偏低；对单点高频滥用（本次审计场景）足够。
//   - 读-改-写非原子，同 key 并发请求可能少计 1~2 次，可接受。
//   - KV expirationTtl 下限为 60s，因此窗口必须 ≥ 60s。
//   - KV 不可用 / 读写异常时一律放行（fail-open），不因限流故障拖垮登录。

// 客户端真实 IP：Pages 环境下 CF-Connecting-IP 由平台注入，不可伪造。
// 本地 dev / 无该头时返回 null，调用方应跳过 IP 维度限制（邮箱维度仍生效）。
export function getClientIp(request) {
  const ip = (request.headers.get('CF-Connecting-IP') || '').trim()
  return ip || null
}

// 把剩余秒数格式化为用户可读的等待时长（用于 429 文案）
export function fmtWaitSec(sec) {
  if (sec >= 5400) return `${Math.ceil(sec / 3600)} 小时`
  if (sec >= 90) return `${Math.ceil(sec / 60)} 分钟`
  return `${sec} 秒`
}

// 固定窗口限流：通过则计数 +1 并返回 { allowed: true }；超限不计数，
// 返回 { allowed: false, retryAfterSec }。窗口首次出现时重置计数。
export async function hitLimit(kv, key, limit, windowSec) {
  if (!kv) return { allowed: true }
  const now = Date.now()

  let v = null
  try {
    v = await kv.get(key, { type: 'json' })
  } catch (e) {
    return { allowed: true } // 读故障：放行
  }

  // 窗口过期或键首次出现：重开窗口。TTL 多留 5s 缓冲，
  // 避免边界处键先于 resetAt 消失导致窗口被拉长
  if (!v || typeof v.c !== 'number' || v.r <= now) {
    try {
      await kv.put(key, JSON.stringify({ c: 1, r: now + windowSec * 1000 }), { expirationTtl: windowSec + 5 })
    } catch (e) { /* 写失败按已通过处理 */ }
    return { allowed: true }
  }

  if (v.c >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((v.r - now) / 1000)) }
  }

  try {
    await kv.put(
      key,
      JSON.stringify({ c: v.c + 1, r: v.r }),
      { expirationTtl: Math.max(60, Math.ceil((v.r - now) / 1000) + 5) }
    )
  } catch (e) { /* 写失败按已通过处理 */ }
  return { allowed: true }
}

// ============ 密码登录失败锁定（存 { fails, until }）============

// 是否处于锁定期：是则返回剩余秒数，否则返回 0
export async function getLockRemaining(kv, key) {
  if (!kv) return 0
  try {
    const v = await kv.get(key, { type: 'json' })
    if (v && typeof v.until === 'number' && v.until > Date.now()) {
      return Math.max(1, Math.ceil((v.until - Date.now()) / 1000))
    }
  } catch (e) { /* fail-open */ }
  return 0
}

// 记一次失败；累计 maxFails 次后锁定 lockSec 秒。
// 返回当前锁定剩余秒数（0 = 未锁定）。锁定期内调用方应先被 getLockRemaining 拦下，
// 不会走到这里，因此锁定窗口不会被持续攻击无限顺延（避免攻击者永久锁死账号）。
export async function recordAuthFail(kv, key, maxFails, lockSec) {
  if (!kv) return 0
  const now = Date.now()

  let v = null
  try {
    v = await kv.get(key, { type: 'json' })
  } catch (e) {
    return 0
  }

  const fails = ((v && typeof v.fails === 'number') ? v.fails : 0) + 1
  // 计数键 TTL 与锁定窗口对齐：锁定期结束后计数自然清零，重新累计。
  // 锁定已过期但键仍在 TTL 缓冲窗口内（lockSec + 60）时，旧计数必须归零，
  // 否则缓冲窗口内的一次失败会以旧计数直接顶到阈值，攻击者只需周期性
  // 失败一次即可把锁定永久续期（账号 DoS）。
  const lockExpired = v && typeof v.until === 'number' && v.until <= now
  const effectiveFails = lockExpired ? 1 : fails
  if (effectiveFails >= maxFails) {
    const until = now + lockSec * 1000
    try {
      await kv.put(key, JSON.stringify({ fails: effectiveFails, until }), { expirationTtl: lockSec + 60 })
    } catch (e) { /* 写失败按未锁定处理 */ }
    return lockSec
  }
  try {
    await kv.put(key, JSON.stringify({ fails: effectiveFails }), { expirationTtl: lockSec + 60 })
  } catch (e) { /* 写失败按未锁定处理 */ }
  return 0
}

// 登录成功后清空失败计数
export async function clearAuthFails(kv, key) {
  if (!kv) return
  try {
    await kv.delete(key)
  } catch (e) { /* 清理失败无碍 */ }
}

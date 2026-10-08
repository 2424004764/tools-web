// IP 封禁判定 —— 全局 middleware 热路径使用
//
// 存储模型：ip_bans 表（D1，见 migrations/090_create_ip_bans.sql）
//   ip 列存「封禁键」：IPv4 存完整地址；IPv6 存 /64 前缀 ——
//   住宅 IPv6 地址在 /64 网段内不断轮换，封单个地址基本无效，统一按网段封。
//
// 性能：每个请求都要判定，而封禁键集合很小 —— 这里用模块级缓存
// （同一 isolate 内所有请求共享）+ 15s TTL 整表刷新，避免每请求一次 D1 读。
// 代价：封禁/解封最迟 15 秒内在各节点生效。
//
// 容错：加载失败一律 fail-open（视为无封禁），绝不能因封禁系统故障拖垮整站。

const BAN_CACHE_TTL_MS = 15_000

let banCache = { loadedAt: 0, keys: new Set() }

// ============ IP → 封禁键规范化 ============

// 展开 IPv6 为 8 组 4 位十六进制；非法返回 null。
// 处理 :: 缩写、内嵌 IPv4 尾巴（::ffff:1.2.3.4）、方括号与 zone id（fe80::1%eth0）
function expandIpv6Groups(raw) {
  let addr = String(raw || '').trim().toLowerCase()
  if (!addr.includes(':')) return null
  addr = addr.replace(/^\[/, '').replace(/\]$/, '').split('%')[0]

  const v4 = addr.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4) {
    const parts = v4[2].split('.').map(Number)
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
    addr = `${v4[1]}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`
  }

  const halves = addr.split('::')
  if (halves.length > 2) return null
  let groups
  if (halves.length === 2) {
    const head = halves[0] ? halves[0].split(':') : []
    const tail = halves[1] ? halves[1].split(':') : []
    // :: 至少压缩了一个 0 组，head+tail 必须 ≤ 7
    if (head.length + tail.length > 7) return null
    groups = [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail]
  } else {
    groups = addr.split(':')
    if (groups.length !== 8) return null
  }
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => g.padStart(4, '0'))
}

// 任意 IP → 封禁键：IPv4 原样（去前导零）；IPv6 → /64 前缀 'xxxx:xxxx:xxxx:xxxx::/64'。
// 非法输入返回 null。封禁入库与请求判定共用本函数，保证两侧键一致。
export function normalizeBanKey(ip) {
  const raw = String(ip || '').trim()
  if (!raw) return null
  if (raw.includes(':')) {
    const groups = expandIpv6Groups(raw)
    return groups ? `${groups.slice(0, 4).join(':')}::/64` : null
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(raw)
  if (!m) return null
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (parts.some((n) => n > 255)) return null
  return parts.join('.')
}

// ============ 生效中的封禁键集合（isolate 级缓存） ============

export async function getActiveBanKeys(db) {
  const now = Date.now()
  if (now - banCache.loadedAt < BAN_CACHE_TTL_MS) return banCache.keys
  if (!db) return banCache.keys

  try {
    const rows = await db
      .prepare(`SELECT ip FROM ip_bans WHERE expires_at IS NULL OR expires_at > datetime('now')`)
      .all()
    banCache = { loadedAt: now, keys: new Set((rows.results || []).map((r) => r.ip)) }
  } catch (e) {
    // 表未迁移 / D1 抖动：沿用旧缓存（从未加载过则视为无封禁），
    // 并同样推迟 15s 再试，避免 D1 故障时每个请求都打库
    console.error('[ip-ban] load ip_bans failed:', e?.message || e)
    banCache = { loadedAt: now, keys: banCache.keys }
  }
  return banCache.keys
}

export async function isIpBanned(db, ip) {
  const key = normalizeBanKey(ip)
  if (!key) return false
  const keys = await getActiveBanKeys(db)
  return keys.has(key)
}

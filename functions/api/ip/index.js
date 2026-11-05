// IP 查询 API
// GET /api/ip          → 访客自己的 IP + 归属地（Cloudflare request.cf，免费且准确）
// GET /api/ip?ip=x.x.x.x → 查询指定 IP（走 ipwho.is，HTTPS 免费无密钥）
//
// 背景：原 Ip.vue 走 fork 上游的 /v1/openapi/ip（request.ts 体系），本站从未部署
// 该后端，页面一直查不到数据。此端点为本站自建替代。
//
// 注意：新端点必须同步登记 functions/_routes.json 的 include，否则不执行。

import { ApiResponse } from '../../utils/db.js'

// 常见国家/地区代码 → 中文名（未命中回退原文，避免长映射表）
const COUNTRY_NAMES = {
  CN: '中国', HK: '中国香港', TW: '中国台湾', MO: '中国澳门',
  US: '美国', JP: '日本', KR: '韩国', SG: '新加坡', MY: '马来西亚',
  TH: '泰国', VN: '越南', PH: '菲律宾', ID: '印度尼西亚', IN: '印度',
  GB: '英国', DE: '德国', FR: '法国', NL: '荷兰', RU: '俄罗斯',
  CA: '加拿大', AU: '澳大利亚', BR: '巴西',
}

function countryName(code) {
  if (!code) return ''
  return COUNTRY_NAMES[String(code).toUpperCase()] || code
}

// 简单格式校验：IPv4 点分十进制或 IPv6 冒号十六进制；精确校验交给 ipwho.is
function looksLikeIp(s) {
  return /^[0-9a-fA-F.:]+$/.test(s) && s.length >= 3 && s.length <= 45
}

// 查询指定 IP：双源 fallback。
// ipwho.is 会对 Cloudflare Workers 出口 IP 段限流（本机直连正常、Functions 侧被 429），
// 备用 ip-api.com（HTTP 免费、无需密钥，返回 {status, country, country_code, regionName, city, isp, timezone}）。
// 任一源成功即返回；全部失败才报错。
async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function lookupExternal(ip, origin) {
  // 主源：ipwho.is
  try {
    const j = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`)
    if (j && j.success !== false && j.ip) {
      return ApiResponse.success(
        {
          ip: j.ip,
          isp: j.connection?.isp || j.connection?.org || '',
          country: countryName(j.country_code || j.country),
          region: j.region || '',
          city: j.city || '',
          timezone: j.timezone?.id || '',
          colo: '',
        },
        origin,
      )
    }
    // 业务性失败（IP 不存在等）无必要再试备用源
    if (j && j.success === false && typeof j.message === 'string' && !/rate|limit/i.test(j.message)) {
      return ApiResponse.error(j.message, origin, 400)
    }
  } catch (e) {
    console.error('[api/ip] ipwho.is failed:', e?.message || e)
  }

  // 备用源：ip-api.com
  try {
    const j = await fetchJson(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,isp,org,timezone,query`)
    if (j && j.status === 'success') {
      return ApiResponse.success(
        {
          ip: j.query || ip,
          isp: j.isp || j.org || '',
          country: countryName(j.countryCode) || j.country || '',
          region: j.regionName || '',
          city: j.city || '',
          timezone: j.timezone || '',
          colo: '',
        },
        origin,
      )
    }
    if (j && j.status === 'fail' && j.message && j.message !== 'reserved range') {
      return ApiResponse.error(j.message, origin, 400)
    }
  } catch (e) {
    console.error('[api/ip] ip-api.com failed:', e?.message || e)
  }

  return ApiResponse.error('归属地查询服务暂不可用，请稍后重试', origin, 502)
}

export async function onRequestGet(context) {
  const { request } = context
  const origin = request.headers.get('Origin')

  const queryIp = (new URL(request.url).searchParams.get('ip') || '').trim()
  if (queryIp) {
    if (!looksLikeIp(queryIp)) {
      return ApiResponse.error('IP 格式不正确', origin, 400)
    }
    return lookupExternal(queryIp, origin)
  }

  // 访客自己：request.cf 由 CF 边缘注入，含地理与 ASN 组织（运营商）
  const clientIp = (request.headers.get('CF-Connecting-IP') || '').trim()
  const cf = request.cf || {}
  return ApiResponse.success(
    {
      ip: clientIp,
      isp: typeof cf.asOrganization === 'string' ? cf.asOrganization : '',
      country: countryName(cf.country),
      region: typeof cf.region === 'string' ? cf.region : '',
      city: typeof cf.city === 'string' ? cf.city : '',
      timezone: typeof cf.timezone === 'string' ? cf.timezone : '',
      colo: typeof cf.colo === 'string' ? cf.colo : '',
    },
    origin,
  )
}

// 阿里云 STS 临时凭证签发
// POST /api/oss-sts
// body: { config_id, session_name? }
// 调用阿里云 STS AssumeRole，返回 SecurityToken + 临时 AK/SK
import { AuthMiddleware } from '../middlewares/auth.js'
import { OssService } from '../services/ossService.js'

const corsHeaders = {

  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// RFC 3986 编码（与 URLSearchParams 类似但更严格）
function percentEncode(s) {
  return encodeURIComponent(s)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
}

/**
 * 构造规范化查询字符串（参数按字典序排序）
 */
function canonicalize(params) {
  const sortedKeys = Object.keys(params).sort()
  return sortedKeys
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&')
}

/**
 * 阿里云 API v1 HMAC-SHA1 签名
 */
async function signV1(params, accessKeySecret) {
  const canonicalized = canonicalize(params)
  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalized)}`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(accessKeySecret + '&'),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(stringToSign))
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/**
 * 调用阿里云 STS AssumeRole
 */
async function assumeRole({ accessKeyId, accessKeySecret, roleArn, roleSessionName, durationSeconds, policy }) {
  const params = {
    Format: 'JSON',
    Version: '2015-04-01',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: Math.random().toString(36).slice(2) + Date.now(),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    Action: 'AssumeRole',
    RoleArn: roleArn,
    RoleSessionName: roleSessionName || `oss-web-${Date.now()}`,
    DurationSeconds: String(durationSeconds || 3600)
  }
  if (policy) params.Policy = policy

  const signature = await signV1(params, accessKeySecret)
  params.Signature = signature

  const qs = canonicalize(params)
  const url = `https://sts.aliyuncs.com/?${qs}`

  const resp = await fetch(url, { method: 'GET' })
  const text = await resp.text()
  let json
  try {
    json = JSON.parse(text)
  } catch (e) {
    throw new Error('STS 返回非 JSON：' + text.slice(0, 200))
  }
  return json
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const db = env.DB
  if (!db) {
    return new Response(JSON.stringify({ success: false, error: '数据库未配置' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  const authResult = await AuthMiddleware.extractUserFromRequest(request, env)
  if (!authResult.success) {
    return AuthMiddleware.createAuthErrorResponse(authResult.error, '*', 401)
  }
  const uid = authResult.user.id

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: '仅支持 POST' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { config_id, session_name } = body
    if (!config_id) {
      return new Response(JSON.stringify({ success: false, error: '缺少 config_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    const service = new OssService(db, env.JWT_SECRET)
    const raw = await service.getRawById(config_id, uid)
    if (!raw.success) {
      return new Response(JSON.stringify(raw), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }
    const cfg = raw.data

    // 模式选择：
    // - 有 roleArn：调用 STS AssumeRole 签发临时凭证
    // - 无 roleArn：直接用 AK/SK 访问 OSS（要求 AK 本身有 OSS 权限）
    //   - 此时 expiration 给一个远的未来，让 Provider 不要反复刷新
    if (!cfg.roleArn) {
      // 直接 AccessKey 模式
      return new Response(JSON.stringify({
        success: true,
        mode: 'direct',
        data: {
          accessKeyId: cfg.accessKeyId,
          accessKeySecret: cfg.accessKeySecret,
          securityToken: '',
          // 永久凭证：设置为 24 小时后过期，足够覆盖单次会话
          expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          requestId: 'direct-ak-' + Date.now(),
          assumedRoleId: '',
          // 同时返回给前端用于显示的配置信息
          config: {
            id: cfg.id,
            name: cfg.name,
            region: cfg.region,
            bucket: cfg.bucket,
            endpoint: cfg.endpoint
          }
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // 限制 session_name 字符（仅字母数字-_）
    const safeSession = (session_name || `oss-${uid.slice(0, 8)}-${Date.now()}`)
      .replace(/[^A-Za-z0\-_]/g, '')
      .slice(0, 32) || `oss-${Date.now()}`

    const stsResp = await assumeRole({
      accessKeyId: cfg.accessKeyId,
      accessKeySecret: cfg.accessKeySecret,
      roleArn: cfg.roleArn,
      roleSessionName: safeSession,
      durationSeconds: cfg.durationSeconds,
      policy: cfg.policy
    })

    if (stsResp.Code || stsResp.code) {
      const errCode = stsResp.Code || stsResp.code
      const errMsg = stsResp.Message || stsResp.message || 'STS 调用失败'
      return new Response(JSON.stringify({
        success: false,
        error: `STS ${errCode}: ${errMsg}`,
        details: stsResp
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // STS 响应字段（部分 SDK 兼容性）
    const credentials = stsResp.Credentials || stsResp.credentials
    if (!credentials) {
      return new Response(JSON.stringify({
        success: false,
        error: 'STS 未返回 Credentials',
        details: stsResp
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    const assumedRoleUser = stsResp.AssumedRoleUser || stsResp.assumedRoleUser || {}

    return new Response(JSON.stringify({
      success: true,
      mode: 'sts',
      data: {
        // 兼容字段命名
        accessKeyId: credentials.AccessKeyId || credentials.accessKeyId,
        accessKeySecret: credentials.AccessKeySecret || credentials.accessKeySecret,
        securityToken: credentials.SecurityToken || credentials.securityToken,
        expiration: credentials.Expiration || credentials.expiration,
        requestId: stsResp.RequestId || stsResp.requestId,
        assumedRoleId: assumedRoleUser.AssumedRoleId || assumedRoleUser.assumedRoleId,
        // 同时返回给前端用于显示的配置信息
        config: {
          id: cfg.id,
          name: cfg.name,
          region: cfg.region,
          bucket: cfg.bucket,
          endpoint: cfg.endpoint
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  } catch (e) {
    console.error('oss-sts 错误:', e)
    return new Response(JSON.stringify({ success: false, error: e.message || '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}
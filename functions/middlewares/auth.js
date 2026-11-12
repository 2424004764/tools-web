import { ApiResponse } from '../utils/db.js'
import { verifyDpopBinding } from '../utils/dpop.js'

// 服务端实时校验用户状态：token_version（撤销）+ is_disabled（封禁）。
// 一次主键查询；查询失败按失效处理（fail-closed），避免 DB 故障期间旧 token 复活。
// 同时供 api/_lib/model-resolver.js 的 extractUidFromRequest（admin 鉴权链）复用
export async function checkUserTokenState(env, payload) {
  if (!env.DB) return { ok: false, error: '服务器配置错误' }
  try {
    const row = await env.DB.prepare(
      'SELECT token_version, is_disabled FROM user WHERE id = ?'
    ).bind(payload.uid).first()
    if (!row) return { ok: false, error: '用户不存在' }
    if (row.is_disabled) return { ok: false, error: '账号已被禁用' }
    const tokenVer = typeof payload.ver === 'number' ? payload.ver : 0
    if ((row.token_version || 0) !== tokenVer) {
      return { ok: false, error: '登录状态已失效，请重新登录' }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: '用户状态校验失败' }
  }
}

export class AuthMiddleware {
  // 验证JWT Token
  static async verifyToken(token, secret) {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }

      const [headerB64, payloadB64, signatureB64] = parts

      // 解析 header 并锁定算法：本系统只签发 HS256，
      // 显式拒绝其他 alg，防将来引入其他密钥用途时被算法混淆绕过
      const b64decodeUtf8 = (str) => {
        str = str.replace(/-/g, '+').replace(/_/g, '/')
        while (str.length % 4) str += '='
        const binaryString = atob(str)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return new TextDecoder('utf-8').decode(bytes)
      }
      const header = JSON.parse(b64decodeUtf8(headerB64))
      if (!header || header.alg !== 'HS256') {
        throw new Error('Invalid algorithm')
      }

      // 验证签名
      const data = `${headerB64}.${payloadB64}`
      const enc = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )

      // 将base64url转换为ArrayBuffer
      const base64url2buf = (str) => {
        str = str.replace(/-/g, '+').replace(/_/g, '/')
        while (str.length % 4) str += '='
        const binaryString = atob(str)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes.buffer
      }

      const signature = base64url2buf(signatureB64)
      const isValid = await crypto.subtle.verify('HMAC', key, signature, enc.encode(data))

      if (!isValid) {
        throw new Error('Invalid signature')
      }

      // 解析payload
      const decodedString = b64decodeUtf8(payloadB64)
      const payload = JSON.parse(decodedString)

      // exp 必须存在且未过期：无 exp 的 token 永久有效属于安全反模式，
      // 所有签发方都写入 exp，缺失一律拒绝
      const currentTime = Math.floor(Date.now() / 1000)
      if (typeof payload.exp !== 'number' || payload.exp <= currentTime) {
        throw new Error('Token expired')
      }

      return { success: true, payload }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // 从请求中提取用户信息
  static async extractUserFromRequest(request, env) {
    try {
      // 从Authorization header中提取token
      const authHeader = request.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { success: false, error: '缺少认证token' }
      }

      const token = authHeader.substring(7) // 移除 "Bearer " 前缀
      
      if (!env.JWT_SECRET) {
        return { success: false, error: '服务器配置错误' }
      }

      // 验证token
      const verifyResult = await this.verifyToken(token, env.JWT_SECRET)
      if (!verifyResult.success) {
        // 细节只进服务端日志；对外与 token_version 失效统一口径，
        // 避免暴露 JWT 校验阶段与实现（渗透测试发现 #6）
        console.warn(`[auth] token verify failed: ${verifyResult.error}`)
        return { success: false, error: '登录状态已失效，请重新登录' }
      }

      // 实时校验 token_version 与封禁状态：改密/重置/封禁后旧 token 立即失效。
      // 历史签发的 token 无 ver claim，按 0 处理，与列默认值一致
      const liveCheck = await checkUserTokenState(env, verifyResult.payload)
      if (!liveCheck.ok) {
        return { success: false, error: liveCheck.error }
      }

      // DPoP 发送方约束（RFC 9449）：token 绑定了公钥指纹（cnf.jkt）时，
      // 请求必须携带有效 proof 且公钥指纹一致，截获的 token 单独无法使用；
      // 未绑定的存量/新签 token 过渡期放行（见 utils/dpop.js 的 DPOP_ENFORCE）
      const dpopCheck = await verifyDpopBinding(request, env, verifyResult.payload)
      if (!dpopCheck.ok) {
        return { success: false, error: dpopCheck.error }
      }

      // 返回用户信息
      return {
        success: true,
        user: {
          id: verifyResult.payload.uid,
          email: verifyResult.payload.email,
          avatar: verifyResult.payload.avatar,
          username: verifyResult.payload.username
        }
      }
    } catch (error) {
      console.warn(`[auth] extractUserFromRequest error: ${error.message}`)
      return { success: false, error: '登录状态已失效，请重新登录' }
    }
  }

  // 从请求中提取用户信息（可选，不强制要求认证）
  static async extractUserFromRequestOptional(request, env) {
    try {
      const authHeader = request.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { success: true, user: null } // 未登录但允许继续
      }

      const token = authHeader.substring(7)

      if (!env.JWT_SECRET) {
        return { success: true, user: null }
      }

      const verifyResult = await this.verifyToken(token, env.JWT_SECRET)
      if (!verifyResult.success) {
        return { success: true, user: null }
      }

      const liveCheck = await checkUserTokenState(env, verifyResult.payload)
      if (!liveCheck.ok) {
        return { success: true, user: null }
      }

      // DPoP 校验失败（未带 proof / proof 无效 / 指纹不符）按未登录处理，
      // 与可选认证语义一致：不阻断公开接口，只是不识别该 token
      const dpopCheck = await verifyDpopBinding(request, env, verifyResult.payload)
      if (!dpopCheck.ok) {
        return { success: true, user: null }
      }

      return {
        success: true,
        user: {
          id: verifyResult.payload.uid,
          email: verifyResult.payload.email,
          avatar: verifyResult.payload.avatar,
          username: verifyResult.payload.username
        }
      }
    } catch (error) {
      return { success: true, user: null }
    }
  }

  // 创建认证失败响应
  static createAuthErrorResponse(message, origin, status = 401) {
    return ApiResponse.error(message, origin, status)
  }

  // 认证中间件装饰器
  static withAuth(handler) {
    return async (request, env, ...args) => {
      const authResult = await this.extractUserFromRequest(request, env)
      if (!authResult.success) {
        return this.createAuthErrorResponse(authResult.error)
      }
      
      // 将用户信息添加到参数中
      return await handler(request, env, authResult.user, ...args)
    }
  }
}
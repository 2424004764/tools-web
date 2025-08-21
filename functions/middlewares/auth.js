import { ApiResponse } from '../utils/db.js'

export class AuthMiddleware {
  // 验证JWT Token
  static async verifyToken(token, secret) {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }

      const [headerB64, payloadB64, signatureB64] = parts
      
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
      let base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
      while (base64.length % 4) base64 += '='
      
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const decodedString = new TextDecoder('utf-8').decode(bytes)
      const payload = JSON.parse(decodedString)

      // 检查token是否过期
      const currentTime = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < currentTime) {
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
        return { success: false, error: `Token验证失败: ${verifyResult.error}` }
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
      return { success: false, error: `认证失败: ${error.message}` }
    }
  }

  // 创建认证失败响应
  static createAuthErrorResponse(message, status = 401) {
    return ApiResponse.error(message, status)
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
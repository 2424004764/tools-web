// POST /api/auth/dpop-bind —— 把当前 Bearer JWT 升级为 DPoP 绑定 token（RFC 9449）
//
// 请求需携带：
//   Authorization: Bearer <现有token>
//   DPoP: <proof>（htm=POST，htu=本端点，用客户端本机 ES256 私钥现签）
//
// 行为：
// - token 未绑定（无 cnf.jkt）：完整鉴权（验签 + token_version/封禁实时校验）+
//   proof 校验通过后，保留原 payload（含 ver/exp）重签，仅新增 cnf.jkt 并刷新 iat。
// - token 已绑定（有 cnf.jkt）：proof 公钥指纹与 cnf 一致（同设备）时幂等返回原
//   token，不会改绑到其他公钥——换设备必须重新登录。
//
// 实现说明：不走 AuthMiddleware.extractUserFromRequest，而是在本端点内按需组合
// 鉴权链。原因：中间件对已绑定 token 会先验一次 proof，本端点又要取 jkt 判断
// 幂等/改绑，两次 validateDpopProof 会被 jti 防重放拒绝（同一 proof 只能消费一次）。
//
// 防滥用：bind 需要先持有完整有效 Bearer token，与直接使用该 token 等权，
// 不引入新的攻击面；另按 IP 轻限流防止 KV 重放记录被刷。

import { ApiResponse } from '../../utils/db.js'
import { AuthMiddleware, checkUserTokenState } from '../../middlewares/auth.js'
import { signMainJWT } from '../../utils/jwt.js'
import { validateDpopProof } from '../../utils/dpop.js'
import { getClientIp, hitLimit } from '../../utils/rate-limit.js'

const BIND_IP_LIMIT = 30
const BIND_WINDOW_SEC = 600

export async function onRequest(context) {
  const { request, env } = context

  if (request.method !== 'POST') {
    return ApiResponse.error('仅支持 POST 请求', request.headers.get('Origin'), 405)
  }

  try {
    // 1. JWT 验签（payload 一并取得，免二次解码）
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error('缺少认证token', request.headers.get('Origin'), 401)
    }
    const token = authHeader.substring(7)
    if (!env.JWT_SECRET) {
      return ApiResponse.error('服务器配置错误', request.headers.get('Origin'), 500)
    }
    const verifyResult = await AuthMiddleware.verifyToken(token, env.JWT_SECRET)
    if (!verifyResult.success) {
      console.warn(`[dpop-bind] token verify failed: ${verifyResult.error}`)
      return ApiResponse.error('登录状态已失效，请重新登录', request.headers.get('Origin'), 401)
    }
    const payload = verifyResult.payload

    // 2. 实时校验 token_version 与封禁状态（与常规鉴权链一致）
    const liveCheck = await checkUserTokenState(env, payload)
    if (!liveCheck.ok) {
      return ApiResponse.error(liveCheck.error, request.headers.get('Origin'), 401)
    }

    // 3. DPoP proof 校验（本端点内唯一一次，jti 消费一次）
    const proof = await validateDpopProof(request, env)
    if (!proof.ok) {
      console.warn(`[dpop-bind] proof rejected: ${proof.error}`)
      return ApiResponse.error('登录状态已失效，请重新登录', request.headers.get('Origin'), 401)
    }

    // 4. 绑定判定
    const boundJkt = payload.cnf?.jkt
    if (boundJkt === proof.jkt) {
      // 同设备重放 bind：幂等返回原 token（不重签、不续期）
      return ApiResponse.success({ token }, request.headers.get('Origin'))
    }
    if (boundJkt) {
      // token 已绑定到其他公钥：拒绝改绑（换设备需重新登录）
      console.warn('[dpop-bind] refuse rebind to different key')
      return ApiResponse.error('登录状态已失效，请重新登录', request.headers.get('Origin'), 401)
    }

    // 5. 轻限流（防 KV 重放记录被刷）
    const ip = getClientIp(request)
    if (ip) {
      const r = await hitLimit(env.VERIFICATION_CODES, `rl:dpopbind:${ip}`, BIND_IP_LIMIT, BIND_WINDOW_SEC)
      if (!r.allowed) {
        return ApiResponse.error('请求过于频繁，请稍后再试', request.headers.get('Origin'), 429, null, {
          'Retry-After': String(r.retryAfterSec)
        })
      }
    }

    // 6. 重签：保留原 payload（uid/ver/exp 等），仅新增 cnf.jkt 并刷新 iat。
    //    exp 原样保留——bind 不延长有效期，避免被盗 token 借 bind 续命
    const newToken = await signMainJWT(
      {
        ...payload,
        cnf: { jkt: proof.jkt },
        iat: Math.floor(Date.now() / 1000)
      },
      env.JWT_SECRET
    )

    return ApiResponse.success({ token: newToken }, request.headers.get('Origin'))
  } catch (error) {
    console.error('dpop-bind error:', error)
    return ApiResponse.error('绑定失败', request.headers.get('Origin'), 500)
  }
}

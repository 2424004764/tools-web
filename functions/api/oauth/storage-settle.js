// 已废弃的自报存储结算端点：上传用量只由 R2 事件队列确认。
import { oauthError, openCorsPreflight } from './_lib.js'

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return openCorsPreflight()
  return oauthError('unsupported_endpoint', '该结算端点已停用，请使用统一上传凭证流程', 410)
}

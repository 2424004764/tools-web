import { functionsRequest } from '@/utils/functionsRequest'

export interface OAuthClientInfo {
  client_id: string
  name: string
  description: string
  logo_url: string
}

export interface OAuthUserBrief {
  id: string
  username: string
  email: string
  avatar: string
}

export interface AuthorizeCheckResult {
  client: OAuthClientInfo
  redirect_uri: string
  state: string
  scope: string
  scope_descriptions: Record<string, string>
  user: OAuthUserBrief | null
  need_login: boolean
  need_consent: boolean
  /** 已授权过的应用会直接签发授权码（SSO 静默跳转） */
  code?: string
  redirect_to?: string
}

export interface AuthorizeSubmitResult {
  code?: string
  state?: string
  redirect_to: string
}

export interface AuthorizeParams {
  client_id: string
  redirect_uri: string
  state?: string
  scope?: string
}

/** 检查授权请求：参数校验 + 登录态 + 历史授权（可能直接返回授权码） */
export async function checkAuthorize(params: AuthorizeParams): Promise<AuthorizeCheckResult> {
  const res = await functionsRequest.get('/api/oauth/authorize', { params })
  return res.data.data
}

/** 提交授权（同意/拒绝），返回子站回调地址 */
export async function submitAuthorize(
  payload: AuthorizeParams & { deny?: boolean },
): Promise<AuthorizeSubmitResult> {
  const res = await functionsRequest.post('/api/oauth/authorize', payload)
  return res.data.data
}

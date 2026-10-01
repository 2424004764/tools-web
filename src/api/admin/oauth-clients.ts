import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination } from '@/types/admin'

export interface OAuthClient {
  client_id: string
  name: string
  description: string
  logo_url: string
  redirect_uris: string
  is_disabled: number
  created_at: string
  updated_at: string
  granted_users?: number
}

export interface OAuthClientListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export async function fetchOAuthClients(
  params: OAuthClientListParams = {},
): Promise<{ list: OAuthClient[]; pagination: AdminPagination }> {
  const res = await functionsRequest.get('/api/admin/oauth-clients', { params })
  return res.data.data
}

export async function createOAuthClient(payload: {
  name: string
  description?: string
  logo_url?: string
  redirect_uris: string
}): Promise<{ client_id: string; client_secret: string; name: string }> {
  const res = await functionsRequest.post('/api/admin/oauth-clients', payload)
  return res.data.data
}

export async function updateOAuthClient(
  id: string,
  payload: Partial<{
    name: string
    description: string
    logo_url: string
    redirect_uris: string
    is_disabled: boolean
  }>,
): Promise<OAuthClient> {
  const res = await functionsRequest.put(`/api/admin/oauth-clients/${encodeURIComponent(id)}`, payload)
  return res.data.data
}

export async function deleteOAuthClient(id: string): Promise<{ client_id: string; deleted: boolean }> {
  const res = await functionsRequest.delete(`/api/admin/oauth-clients/${encodeURIComponent(id)}`)
  return res.data.data
}

export async function resetOAuthClientSecret(
  id: string,
): Promise<{ client_id: string; client_secret: string }> {
  const res = await functionsRequest.post(`/api/admin/oauth-clients/${encodeURIComponent(id)}/reset-secret`)
  return res.data.data
}

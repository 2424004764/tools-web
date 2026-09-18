import { functionsRequest } from '@/utils/functionsRequest'

export interface PublicFriendLink {
  id: string
  name: string
  url: string
  description: string
}

export interface SubmitFriendLinkPayload {
  name: string
  url: string
  description?: string
  contact?: string
}

export async function fetchApprovedFriendLinks(): Promise<PublicFriendLink[]> {
  const res = await functionsRequest.get('/api/friend-links')
  const data = res.data?.data
  return Array.isArray(data) ? data : []
}

export async function submitFriendLink(
  payload: SubmitFriendLinkPayload,
): Promise<{ id: string; status: string; message?: string }> {
  const res = await functionsRequest.post('/api/friend-links', payload)
  return {
    ...(res.data?.data || {}),
    message: res.data?.message,
  }
}

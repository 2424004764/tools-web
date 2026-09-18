import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination } from '@/types/admin'

export type FriendLinkStatus = 'pending' | 'approved' | 'rejected'

export interface FriendLink {
  id: string
  name: string
  url: string
  description: string | null
  contact: string | null
  status: FriendLinkStatus
  sort_order: number
  submit_ip: string | null
  reject_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface FriendLinkCounts {
  pending: number
  approved: number
  rejected: number
  total: number
}

export interface FriendLinkListParams {
  page?: number
  pageSize?: number
  status?: FriendLinkStatus | ''
  keyword?: string
}

export async function fetchAdminFriendLinks(
  params: FriendLinkListParams = {},
): Promise<{ list: FriendLink[]; pagination: AdminPagination; counts: FriendLinkCounts }> {
  const res = await functionsRequest.get('/api/admin/friend-links', { params })
  return res.data.data
}

export async function updateAdminFriendLink(
  id: string,
  payload: Partial<{
    status: FriendLinkStatus
    reject_reason: string
    sort_order: number
    name: string
    description: string
  }>,
): Promise<FriendLink> {
  const res = await functionsRequest.put(`/api/admin/friend-links/${encodeURIComponent(id)}`, payload)
  return res.data.data
}

export async function deleteAdminFriendLink(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await functionsRequest.delete(`/api/admin/friend-links/${encodeURIComponent(id)}`)
  return res.data.data
}

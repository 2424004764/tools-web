import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination } from '@/types/admin'
import type { FeedbackType } from '@/api/feedback'

export type FeedbackStatus = 'pending' | 'resolved' | 'closed'

export interface FeedbackItem {
  id: string
  uid: string | null
  email: string
  username: string
  type: FeedbackType
  content: string
  contact: string
  page_url: string
  user_agent: string
  submit_ip: string | null
  status: FeedbackStatus
  admin_note: string
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackCounts {
  pending: number
  resolved: number
  closed: number
  total: number
}

export interface FeedbackListParams {
  page?: number
  pageSize?: number
  status?: FeedbackStatus | ''
  type?: FeedbackType | ''
  keyword?: string
}

export async function fetchAdminFeedback(
  params: FeedbackListParams = {},
): Promise<{ list: FeedbackItem[]; pagination: AdminPagination; counts: FeedbackCounts }> {
  const res = await functionsRequest.get('/api/admin/feedback', { params })
  return res.data.data
}

export async function updateAdminFeedback(
  id: string,
  payload: Partial<{
    status: FeedbackStatus
    admin_note: string
  }>,
): Promise<FeedbackItem> {
  const res = await functionsRequest.put(`/api/admin/feedback/${encodeURIComponent(id)}`, payload)
  return res.data.data
}

export async function deleteAdminFeedback(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await functionsRequest.delete(`/api/admin/feedback/${encodeURIComponent(id)}`)
  return res.data.data
}

import { functionsRequest } from '@/utils/functionsRequest'

export type FeedbackType = 'suggestion' | 'bug' | 'other'

export interface SubmitFeedbackPayload {
  type: FeedbackType
  content: string
  contact?: string
  /** 提交时所在页面路径（仅收站内 / 开头路径） */
  page_url?: string
}

export interface SubmitFeedbackResult {
  id: string
  message?: string
}

export async function submitFeedback(payload: SubmitFeedbackPayload): Promise<SubmitFeedbackResult> {
  const res = await functionsRequest.post('/api/feedback', payload)
  return {
    ...(res.data?.data || {}),
    message: res.data?.message,
  }
}

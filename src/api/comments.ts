import { functionsRequest } from '@/utils/functionsRequest'

/** 站长回复（后台回复，公开可见） */
export interface SiteCommentReply {
  id: string
  nickname: string
  avatar: string
  content: string
  /** 'YYYY-MM-DD HH:MM:SS'（UTC） */
  created_at: string
  is_admin: boolean
}

/** 评论项（前台公开视图，仅已审核通过的） */
export interface SiteComment {
  id: string
  nickname: string
  avatar: string
  content: string
  /** 'YYYY-MM-DD HH:MM:SS'（UTC） */
  created_at: string
  /** 仅提交接口返回；本会话内展示「审核中」用 */
  status?: string
  /** 站长回复，嵌套展示（列表接口返回） */
  replies?: SiteCommentReply[]
}

export interface SiteCommentPagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SiteCommentSubmitPayload {
  /** 评论所属页面路径，如 /md5 */
  path: string
  content: string
  /** 游客必填；登录用户后端忽略这两个字段 */
  nickname?: string
  email?: string
  page_title?: string
}

/** 获取某页面的已审核评论（分页） */
export async function fetchSiteComments(
  path: string,
  page = 1,
  pageSize = 10,
): Promise<{ list: SiteComment[]; pagination: SiteCommentPagination }> {
  const res = await functionsRequest.get('/api/comments', {
    params: { path, page, pageSize },
  })
  return res.data.data
}

/** 提交评论：游客需带昵称+邮箱，登录用户自动带 token。所有评论需审核后展示 */
export async function submitSiteComment(
  payload: SiteCommentSubmitPayload,
): Promise<{ comment: SiteComment; message: string }> {
  const res = await functionsRequest.post('/api/comments', payload)
  return { comment: res.data.data, message: res.data.message || '评论已提交，审核通过后将会展示' }
}

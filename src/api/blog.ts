import { functionsRequest } from '@/utils/functionsRequest'

/** 文章作者类型：admin = 站长，user = 用户投稿 */
export type BlogAuthorType = 'admin' | 'user'

/** 文章项（列表页公开视图，不含正文） */
export interface BlogPostItem {
  id: string
  slug: string
  title: string
  summary: string
  cover: string
  tags: string
  author_name: string
  author_avatar: string
  author_type: BlogAuthorType
  views: number
  /** 'YYYY-MM-DD HH:MM:SS'（UTC） */
  published_at: string | null
}

/** 文章详情（公开视图，仅已发布的） */
export interface BlogPost extends BlogPostItem {
  content: string
  related_tools: string
  updated_at: string | null
}

export interface BlogPagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface BlogHotTag {
  tag: string
  count: number
}

export interface BlogListParams {
  page?: number
  pageSize?: number
  /** 标签筛选 */
  tag?: string
  /** 关键词搜索（标题/摘要） */
  keyword?: string
}

/** 文章列表（分页 + 热门标签） */
export async function fetchBlogPosts(
  params: BlogListParams = {},
): Promise<{ list: BlogPostItem[]; hotTags: BlogHotTag[]; pagination: BlogPagination }> {
  const res = await functionsRequest.get('/api/blog/posts', { params })
  return res.data.data
}

/** 文章详情（按 slug，仅已发布） */
export async function fetchBlogPost(slug: string): Promise<BlogPost> {
  const res = await functionsRequest.get(`/api/blog/posts/${encodeURIComponent(slug)}`)
  return res.data.data.post
}

export interface BlogSubmitPayload {
  title: string
  content: string
  summary?: string
  cover?: string
  tags?: string
  related_tools?: string
  /** 自定义链接标识（可选，小写字母/数字/连字符） */
  slug?: string
}

/** 投稿：必须登录，提交后进入待审核，审核通过才会展示 */
export async function submitBlogPost(
  payload: BlogSubmitPayload,
): Promise<{ post: { id: string; slug: string; title: string; status: string }; message: string }> {
  const res = await functionsRequest.post('/api/blog/posts', payload)
  return { post: res.data.data, message: res.data.message || '投稿已提交，审核通过后将会展示' }
}

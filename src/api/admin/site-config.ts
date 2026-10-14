import { functionsRequest } from '@/utils/functionsRequest'
import type { CommentSystemType } from '@/api/site-config'

/** 站点配置值（管理视图） */
export interface AdminSiteConfig {
  comment_system: CommentSystemType | ''
  giscus_repo: string
  giscus_repo_id: string
  giscus_category: string
  giscus_category_id: string
  giscus_mapping: string
  /** 「更多产品」矩阵 JSON 串；'' = 未配置（前台用内置默认） */
  products_matrix: string
  /** 仪表盘卡片顺序，JSON 串（卡片 id 数组）；'' = 使用内置默认顺序 */
  admin_dashboard_layout: string
}

/** GET/PUT 返回：values 为配置值，remarks 为各项含义说明（代码元数据，随保存同步写库） */
export interface AdminSiteConfigData {
  values: AdminSiteConfig
  remarks: Record<string, string>
}

export async function fetchAdminSiteConfig(): Promise<AdminSiteConfigData> {
  const res = await functionsRequest.get('/api/admin/site-config')
  return res.data.data
}

export async function updateAdminSiteConfig(
  payload: Partial<AdminSiteConfig>,
): Promise<AdminSiteConfigData> {
  const res = await functionsRequest.put('/api/admin/site-config', payload)
  return res.data.data
}

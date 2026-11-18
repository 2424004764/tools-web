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
  /** 新注册用户赠送存储，保存为字节；设置页输入/显示 MiB */
  registration_storage_bytes: string
  /** 新注册用户赠送积分 */
  registration_credits: string
  /** 每积分可兑换存储空间，保存为字节；设置页输入/显示 MiB */
  storage_bytes_per_credit: string
  /** 充值页展示方式：faka = 发卡网，contact = 联系站长 */
  recharge_mode: RechargeMode | ''
  /** 联系站长充值的 QQ 号（contact 模式展示） */
  recharge_contact_qq: string
  /** 发卡网充值套餐 JSON 串；'' = 未配置（前台用内置默认） */
  recharge_packages: string
}

/** 充值页展示方式 */
export type RechargeMode = 'faka' | 'contact'

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

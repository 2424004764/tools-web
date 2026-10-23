// Admin 仪表盘 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminDashboard } from '@/types/admin'

export type AdminDashboardPanel =
  | 'overview'
  | 'storage'
  | 'userTrend'
  | 'usage'
  | 'siteVisit'
  | 'topTools'
  | 'slowlog'
  | 'pending'
  | 'transactions'

/** 聚合拉取全部面板（兼容旧调用；前端各卡片独立拉取用 fetchAdminDashboardPanel） */
export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const res = await functionsRequest.get('/api/admin/dashboard')
  return res.data.data
}

/** 单面板拉取：某个面板慢/失败不影响其他面板渲染；params 附加查询参数（趋势窗口大小等） */
export async function fetchAdminDashboardPanel(
  panel: AdminDashboardPanel,
  params?: Record<string, number>,
): Promise<Partial<AdminDashboard>> {
  const res = await functionsRequest.get(`/api/admin/dashboard/${panel}`, { params })
  return res.data.data
}
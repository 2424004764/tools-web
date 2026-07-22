// Admin 仪表盘 API 封装
import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminDashboard } from '@/types/admin'

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const res = await functionsRequest.get('/api/admin/dashboard')
  return res.data.data
}
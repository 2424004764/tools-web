// Admin 数据表统计 API
import { functionsRequest } from '@/utils/functionsRequest'

export interface DbTableStat {
  /** 表名 */
  name: string
  /** 中文说明（未登记表为「未登记表」） */
  comment: string
  /** 是否有行创建时间列（决定能否统计增量与趋势） */
  tracked: boolean
  total: number
  today: number
  last7: number
  last30: number
}

export interface DbStatsResponse {
  tables: DbTableStat[]
  generatedAt: string
}

export interface DbTrendPoint {
  /** 'YYYY-MM-DD' */
  date: string
  count: number
}

/** 获取所有表的行数统计（调用方需为管理员登录态） */
export async function fetchDbStats(): Promise<DbStatsResponse> {
  const res = await functionsRequest.get('/api/admin/db-stats')
  return {
    tables: res.data?.data?.tables || [],
    generatedAt: res.data?.data?.generatedAt || '',
  }
}

/** 获取单表近 30 天每日新增行数（仅 tracked 表支持） */
export async function fetchDbTableTrend(table: string): Promise<DbTrendPoint[]> {
  const res = await functionsRequest.get('/api/admin/db-stats', {
    params: { table },
  })
  return res.data?.data?.points || []
}

import functionsRequest from '@/utils/functionsRequest'
import type { WeightMember, WeightRecord, WeightStatistics, ChartDataPoint } from './types'

const API_BASE = '/api/weight'

// 成员相关 API
export const weightApi = {
  // 获取所有成员
  async getMembers(): Promise<WeightMember[]> {
    const res = await functionsRequest.get<WeightMember[]>(`${API_BASE}/members`)
    return res.data || []
  },

  // 获取成员详情
  async getMember(id: string): Promise<WeightMember> {
    const res = await functionsRequest.get<WeightMember>(`${API_BASE}/members/${id}`)
    return res.data
  },

  // 创建成员（如果成员已存在则更新）
  async createMember(data: Partial<WeightMember>): Promise<{ id: string; updated: boolean }> {
    const res = await functionsRequest.post<{ id: string; message: string; updated?: boolean }>(`${API_BASE}/members`, data)
    return { id: res.data.id, updated: res.data.updated || false }
  },

  // 更新成员
  async updateMember(id: string, data: Partial<WeightMember>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/members/${id}`, data)
  },

  // 删除成员
  async deleteMember(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/members/${id}`)
  },

  // 获取体重记录列表
  async getRecords(params?: { memberId?: string; startDate?: string; endDate?: string; limit?: number }): Promise<WeightRecord[]> {
    const res = await functionsRequest.get<WeightRecord[]>(`${API_BASE}/records`, { params })
    return res.data || []
  },

  // 获取体重记录详情
  async getRecord(id: string): Promise<WeightRecord> {
    const res = await functionsRequest.get<WeightRecord>(`${API_BASE}/records/${id}`)
    return res.data
  },

  // 创建体重记录
  async createRecord(data: Partial<WeightRecord>): Promise<{ id: string }> {
    const res = await functionsRequest.post<{ id: string; message: string }>(`${API_BASE}/records`, data)
    return { id: res.data.id }
  },

  // 更新体重记录
  async updateRecord(id: string, data: Partial<WeightRecord>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/records/${id}`, data)
  },

  // 删除体重记录
  async deleteRecord(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/records/${id}`)
  },

  // 获取统计数据
  async getStatistics(memberId?: string): Promise<WeightStatistics> {
    const res = await functionsRequest.get<WeightStatistics>(`${API_BASE}/statistics`, { params: { memberId } })
    return res.data
  },

  // 获取图表数据
  async getChartData(memberId?: string, days: number = 30): Promise<ChartDataPoint[]> {
    const res = await functionsRequest.get<ChartDataPoint[]>(`${API_BASE}/chart`, { params: { memberId, days } })
    return res.data || []
  },

  // 导出数据
  async exportData(): Promise<Blob> {
    const res = await functionsRequest.get(`${API_BASE}/export`, { responseType: 'blob' })
    return res.data
  }
}

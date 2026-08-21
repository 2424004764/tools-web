import functionsRequest from '@/utils/functionsRequest'
import type { SalaryRecord, SalaryMember, SalaryStatistics, ChartDataPoint } from './types'

const API_BASE = '/api/salary'

export const salaryApi = {
  // ===== 成员 =====
  async getMembers(): Promise<SalaryMember[]> {
    const res = await functionsRequest.get<SalaryMember[]>(`${API_BASE}/members`)
    return res.data || []
  },

  async createMember(data: { name: string; avatarColor?: string; avatarEmoji?: string; isDefault?: boolean }): Promise<{ id: string; updated: boolean; message: string }> {
    const res = await functionsRequest.post<{ id: string; updated: boolean; message: string }>(`${API_BASE}/members`, data)
    return res.data
  },

  async updateMember(id: string, data: Partial<SalaryMember>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/members/${id}`, data)
  },

  async deleteMember(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/members/${id}`)
  },

  // ===== 记录 =====
  async getRecords(params?: { memberId?: string; startDate?: string; endDate?: string; limit?: number }): Promise<SalaryRecord[]> {
    const res = await functionsRequest.get<SalaryRecord[]>(`${API_BASE}/records`, { params })
    return res.data || []
  },

  async getRecord(id: string): Promise<SalaryRecord> {
    const res = await functionsRequest.get<SalaryRecord>(`${API_BASE}/records/${id}`)
    return res.data
  },

  async createRecord(data: Partial<SalaryRecord>): Promise<{ id: string }> {
    const res = await functionsRequest.post<{ id: string; message: string }>(`${API_BASE}/records`, data)
    return { id: res.data.id }
  },

  async updateRecord(id: string, data: Partial<SalaryRecord>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/records/${id}`, data)
  },

  async deleteRecord(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/records/${id}`)
  },

  // ===== 统计 / 图表 / 导出 =====
  async getStatistics(params?: { memberId?: string }): Promise<SalaryStatistics> {
    const res = await functionsRequest.get<SalaryStatistics>(`${API_BASE}/statistics`, { params })
    return res.data
  },

  async getChartData(params?: { memberId?: string }): Promise<ChartDataPoint[]> {
    const res = await functionsRequest.get<ChartDataPoint[]>(`${API_BASE}/chart`, { params })
    return res.data || []
  },

  async exportData(): Promise<Blob> {
    const res = await functionsRequest.get(`${API_BASE}/export`, { responseType: 'blob' })
    return res.data
  }
}
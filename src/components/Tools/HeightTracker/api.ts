import functionsRequest from '@/utils/functionsRequest'
import type { HeightMember, HeightRecord, HeightStatistics, ChartDataPoint } from './types'

const API_BASE = '/api/height'

export const heightApi = {
  // 成员相关
  async getMembers(): Promise<HeightMember[]> {
    const res = await functionsRequest.get<HeightMember[]>(`${API_BASE}/members`)
    return res.data || []
  },

  async getMember(id: string): Promise<HeightMember> {
    const res = await functionsRequest.get<HeightMember>(`${API_BASE}/members/${id}`)
    return res.data
  },

  async createMember(data: Partial<HeightMember>): Promise<{ id: string; updated: boolean }> {
    const res = await functionsRequest.post<{ id: string; message: string; updated?: boolean }>(`${API_BASE}/members`, data)
    return { id: res.data.id, updated: res.data.updated || false }
  },

  async updateMember(id: string, data: Partial<HeightMember>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/members/${id}`, data)
  },

  async deleteMember(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/members/${id}`)
  },

  // 身高记录
  async getRecords(params?: { memberId?: string; startDate?: string; endDate?: string; limit?: number }): Promise<HeightRecord[]> {
    const res = await functionsRequest.get<HeightRecord[]>(`${API_BASE}/records`, { params })
    return res.data || []
  },

  async getRecord(id: string): Promise<HeightRecord> {
    const res = await functionsRequest.get<HeightRecord>(`${API_BASE}/records/${id}`)
    return res.data
  },

  async createRecord(data: Partial<HeightRecord>): Promise<{ id: string }> {
    const res = await functionsRequest.post<{ id: string; message: string }>(`${API_BASE}/records`, data)
    return { id: res.data.id }
  },

  async updateRecord(id: string, data: Partial<HeightRecord>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/records/${id}`, data)
  },

  async deleteRecord(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/records/${id}`)
  },

  // 统计 / 图表
  async getStatistics(memberId?: string): Promise<HeightStatistics> {
    const res = await functionsRequest.get<HeightStatistics>(`${API_BASE}/statistics`, { params: { memberId } })
    return res.data
  },

  async getChartData(memberId?: string, days: number = 30): Promise<ChartDataPoint[]> {
    const res = await functionsRequest.get<ChartDataPoint[]>(`${API_BASE}/chart`, { params: { memberId, days } })
    return res.data || []
  },

  async exportData(): Promise<Blob> {
    const res = await functionsRequest.get(`${API_BASE}/export`, { responseType: 'blob' })
    return res.data
  }
}
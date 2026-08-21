import functionsRequest from '@/utils/functionsRequest'
import type { FixedExpense, FixedExpenseStatistics } from './types'

const API_BASE = '/api/fixed-expenses'

export const fixedExpenseApi = {
  async getList(params?: { isActive?: boolean; category?: string }): Promise<FixedExpense[]> {
    const res = await functionsRequest.get<FixedExpense[]>(API_BASE, { params })
    return res.data || []
  },

  async getStatistics(): Promise<FixedExpenseStatistics> {
    const res = await functionsRequest.get<FixedExpenseStatistics>(`${API_BASE}/statistics`)
    return res.data
  },

  async create(data: Partial<FixedExpense>): Promise<{ id: string }> {
    const res = await functionsRequest.post<{ id: string; message: string }>(API_BASE, data)
    return { id: res.data.id }
  },

  async update(id: string, data: Partial<FixedExpense>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/${id}`, data)
  },

  async delete(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/${id}`)
  },

  async exportData(): Promise<Blob> {
    const res = await functionsRequest.get(`${API_BASE}/export`, { responseType: 'blob' })
    return res.data
  }
}

import functionsRequest from '@/utils/functionsRequest'
import type { PriceItem, PriceEntry, PriceStatistics } from './types'

const API_BASE = '/api/price-comparison'

export const priceComparisonApi = {
  // ===== 物品 =====
  async getItems(params?: { status?: number | string; category?: string; keyword?: string }): Promise<PriceItem[]> {
    const res = await functionsRequest.get<PriceItem[]>(`${API_BASE}/items`, { params })
    return res.data || []
  },

  async getItem(id: string): Promise<PriceItem> {
    const res = await functionsRequest.get<PriceItem>(`${API_BASE}/items/${id}`)
    return res.data
  },

  async createItem(data: Partial<PriceItem>): Promise<{ id: string; message: string }> {
    const res = await functionsRequest.post<{ id: string; message: string }>(`${API_BASE}/items`, data)
    return res.data
  },

  async updateItem(id: string, data: Partial<PriceItem>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/items/${id}`, data)
  },

  async deleteItem(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/items/${id}`)
  },

  // ===== 条目 =====
  async getEntries(params?: { itemId?: string }): Promise<PriceEntry[]> {
    const res = await functionsRequest.get<PriceEntry[]>(`${API_BASE}/entries`, { params })
    return res.data || []
  },

  async createEntry(data: Partial<PriceEntry>): Promise<{ id: string; message: string }> {
    const res = await functionsRequest.post<{ id: string; message: string }>(`${API_BASE}/entries`, data)
    return res.data
  },

  async updateEntry(id: string, data: Partial<PriceEntry>): Promise<void> {
    await functionsRequest.put(`${API_BASE}/entries/${id}`, data)
  },

  async deleteEntry(id: string): Promise<void> {
    await functionsRequest.delete(`${API_BASE}/entries/${id}`)
  },

  // ===== 统计 =====
  async getStatistics(): Promise<PriceStatistics> {
    const res = await functionsRequest.get<PriceStatistics>(`${API_BASE}/statistics`)
    return res.data
  }
}
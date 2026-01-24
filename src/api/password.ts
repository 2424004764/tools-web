import functionsRequest from '@/utils/functionsRequest'
import { ElMessage } from 'element-plus'

// 密码条目接口
export interface PasswordEntry {
  id: string
  uid: string
  title: string
  username: string
  password: string
  url: string
  groupId: string | null
  notes: string
  createTime: string
  updateTime: string
}

// 分组接口
export interface PasswordGroup {
  id: string
  uid: string
  name: string
  color: string
  count?: number // 分组下的密码数量
  createTime: string
  updateTime: string
}

// API 响应接口
interface ApiResponse<T = any> {
  data?: T
  error?: string
}

// 分页响应接口
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// API 基础配置
const API_BASE_URL = '/api/passwords'

// ===== 分组 API =====

// 获取所有分组
export async function getAllGroups(): Promise<PasswordGroup[]> {
  try {
    const response = await functionsRequest.get<any>(`${API_BASE_URL}/groups`)
    console.log('getAllGroups 完整响应:', response)
    console.log('getAllGroups response.data:', response.data)
    console.log('getAllGroups response.status:', response.status)
    console.log('getAllGroups response.headers:', response.headers)

    // 尝试不同的数据路径
    const data = response.data?.data || response.data || []
    console.log('解析后的 groups:', data)
    return data
  } catch (error: any) {
    console.error('获取分组失败:', error)
    ElMessage.error(error.response?.data?.error || '获取分组失败')
    return []
  }
}

// 根据ID获取分组
export async function getGroupById(id: string): Promise<PasswordGroup | null> {
  try {
    const response = await functionsRequest.get<ApiResponse<PasswordGroup>>(`${API_BASE_URL}/groups/${id}`)
    return response.data.data || null
  } catch (error: any) {
    console.error('获取分组失败:', error)
    ElMessage.error(error.response?.data?.error || '获取分组失败')
    return null
  }
}

// 创建分组
export async function createGroup(data: { name: string; color: string }): Promise<{ id: string; message: string }> {
  try {
    const response = await functionsRequest.post<{ id: string; message: string }>(`${API_BASE_URL}/groups`, data)
    return response.data
  } catch (error: any) {
    console.error('创建分组失败:', error)
    ElMessage.error(error.response?.data?.error || '创建分组失败')
    throw error
  }
}

// 更新分组
export async function updateGroup(id: string, data: { name?: string; color?: string }): Promise<any> {
  try {
    const response = await functionsRequest.put(`${API_BASE_URL}/groups/${id}`, data)
    return response.data
  } catch (error: any) {
    console.error('更新分组失败:', error)
    ElMessage.error(error.response?.data?.error || '更新分组失败')
    throw error
  }
}

// 删除分组
export async function deleteGroup(id: string): Promise<any> {
  try {
    const response = await functionsRequest.delete(`${API_BASE_URL}/groups/${id}`)
    return response.data
  } catch (error: any) {
    console.error('删除分组失败:', error)
    ElMessage.error(error.response?.data?.error || '删除分组失败')
    throw error
  }
}

// ===== 密码条目 API =====

// 获取所有密码条目
export async function getAllEntries(options?: { groupId?: string; page?: number; pageSize?: number; search?: string }): Promise<PaginatedResponse<PasswordEntry>> {
  try {
    const params: Record<string, string> = {}
    if (options?.groupId !== undefined && options.groupId !== 'all') {
      params.groupId = options.groupId
    }
    if (options?.page !== undefined) {
      params.page = options.page.toString()
    }
    if (options?.pageSize !== undefined) {
      params.pageSize = options.pageSize.toString()
    }
    if (options?.search !== undefined) {
      params.search = options.search
    }

    const queryString = new URLSearchParams(params).toString()
    const url = queryString ? `${API_BASE_URL}/entries?${queryString}` : `${API_BASE_URL}/entries`

    const response = await functionsRequest.get<ApiResponse<PaginatedResponse<PasswordEntry>>>(url)
    console.log('getAllEntries response:', response.data)

    const data = response.data?.data as PaginatedResponse<PasswordEntry> | undefined
    const result: PaginatedResponse<PasswordEntry> = {
      list: data?.list || [],
      total: data?.total || 0,
      page: data?.page || 1,
      pageSize: data?.pageSize || 20,
      totalPages: data?.totalPages || 0
    }
    console.log('Parsed paginated entries:', result)
    return result
  } catch (error: any) {
    console.error('获取密码条目失败:', error)
    ElMessage.error(error.response?.data?.error || '获取密码条目失败')
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0
    }
  }
}

// 根据ID获取密码条目
export async function getEntryById(id: string): Promise<PasswordEntry | null> {
  try {
    const response = await functionsRequest.get<ApiResponse<PasswordEntry>>(`${API_BASE_URL}/entries/${id}`)
    return response.data.data || null
  } catch (error: any) {
    console.error('获取密码条目失败:', error)
    ElMessage.error(error.response?.data?.error || '获取密码条目失败')
    return null
  }
}

// 创建密码条目
export async function createEntry(data: {
  title: string
  username?: string
  password: string
  url?: string
  groupId?: string | null
  notes?: string
}): Promise<{ id: string; message: string }> {
  try {
    const response = await functionsRequest.post<{ id: string; message: string }>(`${API_BASE_URL}/entries`, data)
    return response.data
  } catch (error: any) {
    console.error('创建密码条目失败:', error)
    ElMessage.error(error.response?.data?.error || '创建密码条目失败')
    throw error
  }
}

// 更新密码条目
export async function updateEntry(id: string, data: {
  title?: string
  username?: string
  password?: string
  url?: string
  groupId?: string | null
  notes?: string
}): Promise<any> {
  try {
    const response = await functionsRequest.put(`${API_BASE_URL}/entries/${id}`, data)
    return response.data
  } catch (error: any) {
    console.error('更新密码条目失败:', error)
    ElMessage.error(error.response?.data?.error || '更新密码条目失败')
    throw error
  }
}

// 删除密码条目
export async function deleteEntry(id: string): Promise<any> {
  try {
    const response = await functionsRequest.delete(`${API_BASE_URL}/entries/${id}`)
    return response.data
  } catch (error: any) {
    console.error('删除密码条目失败:', error)
    ElMessage.error(error.response?.data?.error || '删除密码条目失败')
    throw error
  }
}

// ===== 导入导出 API =====

// 导出密码（加密的 JSON 格式）
export async function exportPasswords(): Promise<Blob> {
  try {
    const response = await functionsRequest.get(`${API_BASE_URL}/export`, {
      responseType: 'blob'
    })
    return response.data
  } catch (error: any) {
    console.error('导出密码失败:', error)
    ElMessage.error(error.response?.data?.error || '导出密码失败')
    throw error
  }
}

// 导入密码
export async function importPasswords(file: File): Promise<{ success: number; failed: number }> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await functionsRequest.post(`${API_BASE_URL}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  } catch (error: any) {
    console.error('导入密码失败:', error)
    ElMessage.error(error.response?.data?.error || '导入密码失败')
    throw error
  }
}

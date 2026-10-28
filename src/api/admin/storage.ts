// Admin 存储空间使用明细 API 封装
// 后端：
//   GET /api/admin/storage          全站汇总 + 按用户用量列表（分页 / 搜索，按已用降序）
//   GET /api/admin/storage/detail   单用户明细（来源拆解 + 最近文件 + 子站上传记录）
import { functionsRequest } from '@/utils/functionsRequest'
import type { AdminPagination } from '@/types/admin'

/** 一个来源的聚合：文件数 + 占用字节 */
export interface StorageSourceStat {
  count: number
  bytes: number
}

export interface StorageSummary {
  quotaBytes: number
  usedBytes: number
  pendingBytes: number
  availableBytes: number
  /** 有额度记录的用户数（= 产生过上传的用户） */
  users: number
  sources: {
    music: StorageSourceStat
    aiCreation: StorageSourceStat
    subsite: StorageSourceStat
  }
}

export interface StorageUsageRow {
  uid: string
  email: string | null
  username: string | null
  avatar: string | null
  isAdmin: boolean
  quotaBytes: number
  usedBytes: number
  /** 有效上传预留（预扣）字节数与笔数；>0 且长期不消说明结算链路异常 */
  pendingBytes: number
  pendingCount: number
  availableBytes: number
  updatedAt: string | null
  sources: {
    music: StorageSourceStat
    aiCreation: StorageSourceStat
    subsite: StorageSourceStat
    /** 已用减去可归集来源的差额（生成图持久化、购物清单图片等） */
    other: StorageSourceStat
  }
}

export interface StorageUsageListResult {
  summary: StorageSummary
  list: StorageUsageRow[]
  pagination: AdminPagination
}

export interface StorageUsageListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

export async function fetchStorageUsage(params: StorageUsageListParams = {}): Promise<StorageUsageListResult> {
  const res = await functionsRequest.get('/api/admin/storage', { params })
  return res.data.data
}

export type StorageUploadStatus = 'pending' | 'settled' | 'rejected' | 'expired'

/** 子站上传记录（队列实扣流水） */
export interface SubsiteUploadRecord {
  id: string
  clientId: string
  clientName: string | null
  filename: string
  contentType: string
  declaredBytes: number
  actualBytes: number | null
  status: StorageUploadStatus
  createdAt: string
  settledAt: string | null
}

/** 「其他」占用的逐文件明细（R2 实时按前缀归集，不落文件表的两类占用） */
export interface StorageOtherFile {
  source: 'generated_image' | 'shopping_list'
  /** 生成图对应的来源工具名（如 AI 图片编辑）；购物清单图片为 null */
  tool: string | null
  /** R2 对象完整 key */
  key: string
  bytes: number
  uploadedAt: string | null
}

export interface StorageUserDetail {
  user: {
    uid: string
    email: string | null
    username: string | null
    avatar: string | null
    isAdmin: boolean
  }
  quota: {
    quotaBytes: number
    usedBytes: number
    pendingBytes: number
    availableBytes: number
    updatedAt: string | null
    /** false = 该用户从未产生过存储上传（无额度行） */
    exists: boolean
  }
  sources: {
    music: StorageSourceStat
    aiCreation: StorageSourceStat
    subsite: StorageSourceStat
    other: StorageSourceStat
  }
  /** 最近文件（音乐 + AI 创作图合并，最新 20 条） */
  files: Array<{
    type: 'music' | 'ai_creation'
    name: string
    bytes: number
    createdAt: string
  }>
  /** 有效上传预留明细（最新 20 条）；>0 且长期不消说明结算链路异常 */
  reservations: Array<{
    id: string
    bytes: number
    createdAt: string
  }>
  /** 最近子站上传记录（最新 20 条） */
  uploads: SubsiteUploadRecord[]
  /** 「其他」占用逐文件明细（R2 实时归集，最新 200 条） */
  otherFiles: StorageOtherFile[]
  /** 超出展示上限或 R2 分页未读完 */
  otherFilesTruncated: boolean
  /** R2 归集合计；与 sources.other.bytes（账目残差）的差额即历史漂移 */
  otherBytesFromR2: number
  /** R2 归集失败原因（失败时其他数据仍返回） */
  otherFilesError: string | null
}

export async function fetchStorageUserDetail(uid: string): Promise<StorageUserDetail> {
  const res = await functionsRequest.get('/api/admin/storage/detail', {
    params: { uid },
  })
  return res.data.data
}

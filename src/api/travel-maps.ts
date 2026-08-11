import { functionsRequest } from '@/utils/functionsRequest'
import type {
  TravelMapMeta,
  TravelMapDetail,
  SharedMapDetail,
  PlazaMapItem,
  SaveMapPayload,
  Pagination,
} from '@/components/Tools/TravelMap/types'

// 后端分页统一返回 { data, pagination }（functions/utils/db.js 的 Pager.createResult）
interface PagedResponse<T> {
  data: T[]
  pagination: Pagination
}

const EMPTY_PAGINATION: Pagination = {
  total: 0, page: 1, pageSize: 20, totalPages: 0, hasNext: false, hasPrev: false,
}

/** 我的地图列表（需登录） */
export async function fetchMyMaps(page = 1, pageSize = 20) {
  const res = await functionsRequest.get('/api/travel-maps', { params: { page, pageSize } })
  const body = res.data as PagedResponse<TravelMapMeta>
  return {
    list: body?.data ?? [],
    pagination: body?.pagination ?? { ...EMPTY_PAGINATION, pageSize },
  }
}

/** 新建地图（需登录） */
export async function createMap(payload: Partial<SaveMapPayload>): Promise<TravelMapDetail> {
  const res = await functionsRequest.post('/api/travel-maps', payload)
  return res.data as TravelMapDetail
}

/** 我的地图详情（需登录，含点位与路线） */
export async function fetchMap(id: string): Promise<TravelMapDetail> {
  const res = await functionsRequest.get(`/api/travel-maps/${id}`)
  return res.data as TravelMapDetail
}

/** 全量保存（需登录） */
export async function saveMap(id: string, payload: SaveMapPayload): Promise<TravelMapDetail> {
  const res = await functionsRequest.put(`/api/travel-maps/${id}`, payload)
  return res.data as TravelMapDetail
}

/** 删除地图（需登录，级联删点位与路线） */
export async function deleteMap(id: string): Promise<void> {
  await functionsRequest.delete(`/api/travel-maps/${id}`)
}

/** 地图广场（公开） */
export async function fetchPlaza(page = 1, pageSize = 12) {
  const res = await functionsRequest.get('/api/travel-map-plaza', { params: { page, pageSize } })
  const body = res.data as PagedResponse<PlazaMapItem>
  return {
    list: body?.data ?? [],
    pagination: body?.pagination ?? { ...EMPTY_PAGINATION, pageSize },
  }
}

/** 分享页详情（公开，仅 is_public 的地图可读） */
export type SharedMapResult =
  | { ok: true; data: SharedMapDetail }
  | { ok: false; reason: 'not-found' | 'error'; message: string }

export async function fetchSharedMap(slug: string): Promise<SharedMapResult> {
  // 这里刻意不走 functionsRequest：它的全局拦截器会把 404 弹成「接口不存在」，
  // 而分享页的 404 是「地图不存在或已取消分享」这一正常业务状态。
  // 该接口本身也不需要登录态。同 LetterView.vue 的做法。
  try {
    const res = await fetch(`/api/travel-map/${encodeURIComponent(slug)}`)
    if (res.status === 404) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, reason: 'not-found', message: body?.error || '地图不存在或已取消分享' }
    }
    if (!res.ok) {
      return { ok: false, reason: 'error', message: '加载失败，请稍后重试' }
    }
    return { ok: true, data: (await res.json()) as SharedMapDetail }
  } catch {
    return { ok: false, reason: 'error', message: '网络连接失败，请稍后重试' }
  }
}

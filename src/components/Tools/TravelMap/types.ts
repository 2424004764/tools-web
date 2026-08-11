// 旅游地图 —— 前后端共享的数据结构
// 字段与 functions/services/travelMapsService.js 的出参一一对应

export type PointCategory =
  | 'camp'
  | 'shop'
  | 'water'
  | 'food'
  | 'toilet'
  | 'parking'
  | 'viewpoint'
  | 'lodging'
  | 'danger'
  | 'other'

export type BaseLayer = 'vec' | 'img' | 'ter'

/** OSRM 出行方式，与 src/utils/osrm.ts 的 OsrmProfile 保持一致 */
export type RouteProfile = 'foot' | 'cycling' | 'driving'

export interface LngLat {
  lng: number
  lat: number
}

export interface MapPoint {
  id: string
  name: string
  category: PointCategory
  lng: number
  lat: number
  /** 海拔（米），手动填写，可留空 */
  elevation: number | null
  note: string
}

export interface MapRoute {
  id: string
  name: string
  color: string
  /** 折线节点：[[lng, lat], ...] */
  path: [number, number][]
  /** 总里程（米），前端 haversine 算好后提交 */
  distance: number
  note: string
  /**
   * 路线类型：
   *   'straight' = 用户手点直线路线（mode === 'route'）
   *   'road'     = 沿道路画路线（mode === 'route-osrm'，用 OSRM 算的真实道路）
   * 老数据没这个字段时默认为 'straight'（见 travelMapsService.routeFromRow）。
   */
  kind?: 'straight' | 'road'
}

/** 地图元信息（不含点位与路线） */
export interface TravelMapMeta {
  id: string
  slug: string
  title: string
  description: string
  center: LngLat
  zoom: number
  baseLayer: BaseLayer
  isPublic: boolean
  viewCount: number
  pointCount: number
  routeCount: number
  totalDistance: number
  createdAt: string
  updatedAt: string
}

/** 地图完整内容（我的地图详情） */
export interface TravelMapDetail extends TravelMapMeta {
  points: MapPoint[]
  routes: MapRoute[]
}

export interface MapAuthor {
  name: string
  avatar: string
}

/** 地图广场列表项：只暴露 slug，不含内部 id */
export interface PlazaMapItem {
  slug: string
  title: string
  description: string
  baseLayer: BaseLayer
  center: LngLat
  zoom: number
  viewCount: number
  pointCount: number
  routeCount: number
  totalDistance: number
  updatedAt: string
  author: MapAuthor
}

/** 公开分享页详情：同样不含内部 id */
export interface SharedMapDetail extends Omit<TravelMapMeta, 'id'> {
  author: MapAuthor
  points: MapPoint[]
  routes: MapRoute[]
}

/** 全量保存的请求体 */
export interface SaveMapPayload {
  title: string
  description: string
  center: LngLat
  zoom: number
  baseLayer: BaseLayer
  isPublic: boolean
  points: Array<Omit<MapPoint, 'id'>>
  routes: Array<Omit<MapRoute, 'id'>>
}

export interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

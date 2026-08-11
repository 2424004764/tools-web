import type { PointCategory, BaseLayer, MapRoute, RouteProfile } from './types'

// 点位分类 —— 必须与 functions/services/travelMapsService.js 的 POINT_CATEGORIES 保持一致。
// 用 emoji 而不是图片资源，新增分类不需要准备图标。
export interface CategoryMeta {
  value: PointCategory
  label: string
  emoji: string
  color: string
}

export const POINT_CATEGORIES: CategoryMeta[] = [
  { value: 'camp', label: '露营地', emoji: '⛺', color: '#16a34a' },
  { value: 'shop', label: '商店超市', emoji: '🛒', color: '#ea580c' },
  { value: 'water', label: '水源补给', emoji: '💧', color: '#0891b2' },
  { value: 'food', label: '餐饮', emoji: '🍜', color: '#d97706' },
  { value: 'toilet', label: '卫生间', emoji: '🚻', color: '#7c3aed' },
  { value: 'parking', label: '停车场', emoji: '🅿️', color: '#2563eb' },
  { value: 'viewpoint', label: '观景点', emoji: '📸', color: '#db2777' },
  { value: 'lodging', label: '住宿', emoji: '🏨', color: '#4f46e5' },
  { value: 'danger', label: '危险/注意', emoji: '⚠️', color: '#dc2626' },
  { value: 'other', label: '其他', emoji: '📍', color: '#64748b' },
]

const CATEGORY_MAP = new Map<string, CategoryMeta>(
  POINT_CATEGORIES.map((c) => [c.value, c])
)

export function getCategory(value: string): CategoryMeta {
  return CATEGORY_MAP.get(value) ?? CATEGORY_MAP.get('other')!
}

export const BASE_LAYERS: Array<{ value: BaseLayer; label: string; desc: string }> = [
  { value: 'vec', label: '矢量', desc: '标准街道地图' },
  { value: 'img', label: '影像', desc: '卫星影像图' },
  { value: 'ter', label: '地形', desc: '地形晕渲，看山势起伏' },
]

export const ROUTE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#0f172a',
]

// OSRM 出行方式选项（与 src/utils/osrm.ts 的 OsrmProfile 一一对应）。
// label 是中文展示，emoji + color 用于 draft 路径颜色提示。
export const OSRM_PROFILES: Array<{
  value: RouteProfile
  label: string
  emoji: string
  color: string
}> = [
  { value: 'foot', label: '徒步', emoji: '🚶', color: '#16a34a' },
  { value: 'cycling', label: '骑行', emoji: '🚴', color: '#ea580c' },
  { value: 'driving', label: '驾车', emoji: '🚗', color: '#2563eb' },
]

// 与后端 travelMapsService.js 的上限保持一致，前端提前拦截给出更友好的提示
export const LIMITS = {
  points: 200,
  routes: 20,
  routeNodes: 500,
}

export const DEFAULT_CENTER = { lng: 116.397428, lat: 39.90923 }
export const DEFAULT_ZOOM = 12

/**
 * 两点间大圆距离（米）。
 * 天地图不提供可靠的离线测距，这里自己算，路线里程与后端解耦。
 */
export function haversine(
  lng1: number, lat1: number,
  lng2: number, lat2: number
): number {
  const R = 6371008.8 // 地球平均半径（米）
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 折线总里程（米） */
export function pathDistance(path: [number, number][]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += haversine(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
  }
  return total
}

/**
 * Douglas-Peucker 路径抽稀。
 * 删掉「偏离前后两点连线不到 tol 米」的中间点，保留主要拐点。
 * 这样 OSRM 返回的几百节点能简化到几十，视觉上像高德地图那样清爽。
 *
 * 选 tol 米而不是像素，是因为像素阈值需要知道当前 zoom，反而麻烦。
 * 米阈值 5 ~ 10m 在地图上很难看出细节差异，跟高德 / 百度地图的简化粒度差不多。
 */
export function simplifyPath(
  path: [number, number][],
  toleranceMeters: number = 8
): [number, number][] {
  if (path.length <= 2) return path.slice()

  // 把"偏离前后两点连线"的距离，转成经纬度上的"垂直距离阈值"（粗略估算）
  // —— 用 haversine 度量点到线段的距离。toleranceMeters 米在 WGS-84 上
  // 大约等于 toleranceMeters / 111000 纬度度。
  // 经度方向要除以 cos(lat)，但简单起见用全局经度纬度统一阈值（小数值上
  // 误差可忽略，因为 toleranceMeters 本身是"近似"参数）。
  const tolDeg = toleranceMeters / 111000

  const keep = new Array<boolean>(path.length).fill(false)
  keep[0] = true
  keep[path.length - 1] = true

  const stack: Array<[number, number]> = [[0, path.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()!
    let maxDist = 0
    let maxIdx = -1
    const [lng1, lat1] = path[start]
    const [lng2, lat2] = path[end]
    for (let i = start + 1; i < end; i++) {
      const [lng, lat] = path[i]
      const d = pointToSegmentDeg(lng, lat, lng1, lat1, lng2, lat2)
      if (d > maxDist) {
        maxDist = d
        maxIdx = i
      }
    }
    if (maxDist > tolDeg && maxIdx > -1) {
      keep[maxIdx] = true
      stack.push([start, maxIdx])
      stack.push([maxIdx, end])
    }
  }

  return path.filter((_, i) => keep[i])
}

/** 点 (lng, lat) 到线段 (lng1, lat1)-(lng2, lat2) 的垂直距离（度，近似） */
function pointToSegmentDeg(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) {
    // 退化：起点 = 终点
    const ex = px - x1
    const ey = py - y1
    return Math.sqrt(ex * ex + ey * ey)
  }
  // |(p - a) × (b - a)| / |b - a|  （2D 叉积）
  const cross = Math.abs((px - x1) * dy - (py - y1) * dx)
  const len = Math.sqrt(dx * dx + dy * dy)
  return cross / len
}

/** 米 → 友好文案 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`
}

export function formatElevation(elevation: number | null): string {
  return elevation === null || elevation === undefined ? '—' : `${Math.round(elevation)} m`
}

/** 新建一条空路线（本地临时对象，保存时后端会重新分配 id） */
export function createEmptyRoute(index: number, path: [number, number][]): MapRoute {
  return {
    id: `local-${Date.now()}-${index}`,
    name: `路线 ${index + 1}`,
    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    path,
    distance: pathDistance(path),
    note: '',
  }
}

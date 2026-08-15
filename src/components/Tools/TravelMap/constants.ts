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

// ---------- 急弯识别 ----------

export interface SharpTurnOptions {
  /** 窗口内累积转向角达到该角度（度）即计为一个急弯 */
  thresholdDeg?: number
  /** 累积转向角的计算窗口（米），超过仍未到阈值就清零 */
  windowMeters?: number
  /** 计完一个急弯后的冷却距离（米），避免同一个大弯被数两次 */
  cooldownMeters?: number
  /** 高亮折线前后各延伸多少米（沿路径往两头走）。0=仅顶点一个点 */
  highlightExtendMeters?: number
}

/** 急弯判定默认参数 —— 想调整灵敏度直接改这里 */
export const SHARP_TURN_DEFAULTS: Required<SharpTurnOptions> = {
  thresholdDeg: 90,
  windowMeters: 200,
  cooldownMeters: 60,
  highlightExtendMeters: 80,
}

/**
 * 一个急弯的位置信息 —— 用来在地图上画高亮折线。
 *   centerIdx：触发判定的那个顶点（path 中的下标）
 *   startIdx / endIdx：往前/后各 extendMeters 米后定位到的下标；含头尾
 *   turnDeg：触发时该急弯已累积的角度（不一定精确等于 thresholdDeg，可能略大）
 */
export interface SharpTurnSpan {
  centerIdx: number
  startIdx: number
  endIdx: number
  turnDeg: number
}

/**
 * 一条路线里识别出的所有急弯。
 *
 * 原理：沿路线逐段算方位角变化，把小转角累积起来；在 windowMeters 米的窗口内
 * 累积转向角 ≥ thresholdDeg 就计一个急弯。用「累积窗口」而非单个顶点夹角，是因为
 * OSRM 节点保存前被 simplifyPath 按 30m 容差抽稀，一个急弯的顶点可能只剩 2~3 个
 * 节点，单点夹角会明显偏小、漏数。
 *
 * 计完一个弯后设置 cooldownMeters 冷却距离，避免同一个大弯（或紧挨的两个 90°）
 * 被数成两次。
 *
 * 只对沿道路路线（kind='road'）有意义；手点直线路线的节点就是直线，结果基本为空。
 */
export function detectSharpTurns(
  path: [number, number][],
  options: SharpTurnOptions = {}
): SharpTurnSpan[] {
  const {
    thresholdDeg = SHARP_TURN_DEFAULTS.thresholdDeg,
    windowMeters = SHARP_TURN_DEFAULTS.windowMeters,
    cooldownMeters = SHARP_TURN_DEFAULTS.cooldownMeters,
    highlightExtendMeters = SHARP_TURN_DEFAULTS.highlightExtendMeters,
  } = options
  const spans: SharpTurnSpan[] = []
  if (path.length < 3) return spans

  let accumulatedTurn = 0
  let accumulatedDist = 0
  let cooldown = 0
  let lastTriggerIdx = -Infinity

  // 段 i 从 path[i] 指向 path[i+1]，转角发生在节点 path[i]
  for (let i = 1; i < path.length - 1; i++) {
    const segLen = haversine(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1])
    if (cooldown > 0) {
      cooldown -= segLen
      continue
    }
    const turn = headingDiffDeg(
      bearingDeg(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]),
      bearingDeg(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1])
    )
    accumulatedTurn += turn
    accumulatedDist += segLen
    if (accumulatedTurn >= thresholdDeg) {
      spans.push({
        centerIdx: i,
        startIdx: walkAlongPath(path, i, 'back', highlightExtendMeters),
        endIdx: walkAlongPath(path, i, 'forward', highlightExtendMeters),
        turnDeg: Math.round(accumulatedTurn),
      })
      lastTriggerIdx = i
      accumulatedTurn = 0
      accumulatedDist = 0
      cooldown = cooldownMeters
    } else if (accumulatedDist >= windowMeters) {
      accumulatedTurn = 0
      accumulatedDist = 0
    }
  }
  // 合并：相邻急弯高亮区间重叠时合并成一个，避免画两条几乎重合的红线。
  // 「相邻」用高亮区间是否相交判断（endIdx >= next.startIdx）。
  if (spans.length < 2) return spans
  const merged: SharpTurnSpan[] = [spans[0]]
  for (let k = 1; k < spans.length; k++) {
    const prev = merged[merged.length - 1]
    const cur = spans[k]
    if (cur.startIdx <= prev.endIdx) {
      prev.endIdx = Math.max(prev.endIdx, cur.endIdx)
      prev.centerIdx = cur.turnDeg > prev.turnDeg ? cur.centerIdx : prev.centerIdx
      prev.turnDeg = Math.max(prev.turnDeg, cur.turnDeg)
    } else {
      merged.push(cur)
    }
  }
  void lastTriggerIdx
  return merged
}

/**
 * 沿 path 从中心点向某方向走 targetMeters 米，返回落点的下标。
 * 边界情况：到起点/终点位置直接 clamp，不会越过数组。
 */
function walkAlongPath(
  path: [number, number][],
  centerIdx: number,
  direction: 'back' | 'forward',
  targetMeters: number
): number {
  if (targetMeters <= 0) return centerIdx
  let walked = 0
  if (direction === 'back') {
    for (let i = centerIdx; i > 0; i--) {
      const d = haversine(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
      walked += d
      if (walked >= targetMeters) return i - 1
    }
    return 0
  } else {
    for (let i = centerIdx; i < path.length - 1; i++) {
      const d = haversine(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1])
      walked += d
      if (walked >= targetMeters) return i + 1
    }
    return path.length - 1
  }
}

/** 仅返回急弯数 —— 给纯数字 UI 用（如卡片徽标） */
export function countSharpTurns(
  path: [number, number][],
  options: SharpTurnOptions = {}
): number {
  return detectSharpTurns(path, options).length
}

/** 两点间方位角（度，0°=正北，顺时针）。小范围内用平面 atan2 近似即可 */
function bearingDeg(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLng = toRad(lng2 - lng1)
  const lat1r = toRad(lat1)
  const lat2r = toRad(lat2)
  const y = Math.sin(dLng) * Math.cos(lat2r)
  const x =
    Math.cos(lat1r) * Math.sin(lat2r) -
    Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLng)
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return (deg + 360) % 360
}

/** 两个方位角的夹角（0~180 度） */
function headingDiffDeg(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360
  if (diff > 180) diff = 360 - diff
  return diff
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

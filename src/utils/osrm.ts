// OSRM 路径规划公共 demo 服务封装
//
// 用 OSRM（Open Source Routing Machine）的 router.project-osrm.org 公共 demo：
//   - 免费、无需 key
//   - 由 OpenStreetMap 基金会维护，路网数据来自 OSM
//   - 公网 demo 有流量限制（每天几万个请求），但个人 / 小流量使用完全够
//   - 文档：http://project-osrm.org/docs/v5.24.0/api/#route-service
//
// 我们用 foot / bike / car 三种 profile：徒步 / 骑行 / 驾车。
// 注意 OSRM 的坐标系是 WGS-84（lng, lat），跟天地图一致，**不需要坐标转换**。
//
// 接口签名：
//   GET /route/v1/{profile}/{lng,lat;lng,lat;lng,lat}?overview=full&geometries=geojson&steps=false
//
// 返回结构：
//   {
//     code: 'Ok' | 'NoRoute' | ...,
//     routes: [{
//       distance: 米,
//       duration: 秒,
//       geometry: { coordinates: [[lng, lat], ...] }
//     }]
//   }

export type OsrmProfile = 'foot' | 'cycling' | 'driving'

export interface OsrmRouteResult {
  /** 总里程（米） */
  distance: number
  /** 路径节点数组 [lng, lat] */
  path: [number, number][]
}

export class OsrmError extends Error {
  code: 'network' | 'http' | 'no-route' | 'empty' | 'timeout'
  constructor(code: OsrmError['code'], message: string) {
    super(message)
    this.code = code
    this.name = 'OsrmError'
  }
}

const BASE_URL = 'https://router.project-osrm.org'
const TIMEOUT_MS = 8000

/**
 * 给一组坐标点按顺序做路径规划，返回沿道路的节点数组。
 * 失败时抛 OsrmError，调用方应处理（按用户要求"完全不画，等用户重试"）。
 *
 * @param profile 出行方式
 * @param coords  要串起来的坐标点（[lng, lat][]），至少 2 个
 * @param signal  可选的 AbortSignal，用于取消未完成的请求
 */
export async function routeAlongRoad(
  profile: OsrmProfile,
  coords: [number, number][],
  signal?: AbortSignal
): Promise<OsrmRouteResult> {
  if (coords.length < 2) {
    throw new OsrmError('empty', '至少需要 2 个坐标点')
  }

  // OSRM 路径格式：lng,lat;lng,lat;lng,lat  （注意经度在前）
  const coordStr = coords
    .map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join(';')
  const url =
    `${BASE_URL}/route/v1/${profile}/${coordStr}` +
    `?overview=full&geometries=geojson&steps=false&alternatives=false`

  // 把超时和外部 signal 合并
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (error: any) {
    clearTimeout(timer)
    if (error?.name === 'AbortError') {
      throw new OsrmError('timeout', 'OSRM 请求超时（8s）')
    }
    throw new OsrmError('network', `OSRM 网络错误：${error?.message || '未知'}`)
  }
  clearTimeout(timer)

  if (!res.ok) {
    throw new OsrmError('http', `OSRM HTTP ${res.status}`)
  }

  const data = (await res.json()) as {
    code?: string
    message?: string
    routes?: Array<{
      distance: number
      duration: number
      geometry: { type: string; coordinates: [number, number][] }
    }>
  }

  if (data.code !== 'Ok') {
    throw new OsrmError('no-route', data.message || `OSRM 返回错误：${data.code}`)
  }
  const route = data.routes?.[0]
  if (!route || !route.geometry?.coordinates?.length) {
    throw new OsrmError('empty', 'OSRM 没返回路径节点')
  }

  // OSRM 返回的坐标是 [lng, lat]，直接用
  const path: [number, number][] = route.geometry.coordinates.map(
    (c) => [c[0], c[1]] as [number, number]
  )
  return { distance: route.distance, path }
}
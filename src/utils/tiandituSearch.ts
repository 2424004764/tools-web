// 天地图 REST 搜索接口封装
//
// 这里走的是天地图公开的 WebService API（同 JS API 共用同一个 tk 密钥），
// 而不是用 SDK 里的 T.Geocoder / T.LocalSearch 类，原因：
//   1. SDK 类的内部 API 在 4.0 之后变动较多，查文档/猜参数容易踩坑
//   2. 走 fetch 直接拿到 JSON，可以被 T.Label 之外的 UI 自由消费
//   3. 同源 / CORS 天地图官方已放行
// 文档：http://lbs.tianditu.gov.cn/server/guide.html

import { getTiandituKey } from './tianditu'

const GEOCODER_URL = 'https://api.tianditu.gov.cn/geocoder'
const SEARCH_URL = 'https://api.tianditu.gov.cn/v2/search'
const USER_AGENT_HEADER = 'User-Agent' // 部分 endpoint 对没有 UA 的请求会拒

export interface GeocodedPlace {
  /** 完整地址（行政区 + 街道/POI 名） */
  address: string
  /** 中文名 */
  name: string
  /** 经纬度，WGS84 经度优先，天地图坐标系（WGS-84）的偏差可忽略 */
  lng: number
  lat: number
  /** 匹配的行政级别，province/city/district/street/poi */
  level: string
  /** 行政区 code，便于限定二次搜索 */
  adminCode?: string
}

export interface PoiItem {
  name: string
  address: string
  lng: number
  lat: number
  /** 联系电话，可能为空 */
  phone?: string
  /** 天地图内部 ID（不依赖） */
  hotPointId?: string
}

export interface PoiSearchResult {
  total: number
  pois: PoiItem[]
}

interface GeocoderRaw {
  msg?: string
  location?: {
    lon: string | number
    lat: string | number
    level?: string
    /** 兴趣点返回时附带 POI 全名 */
    keyWord?: string
    score?: number
  }
  /** 0=成功，1=无结果，2=参数错误，3=鉴权失败 */
  status: string
  searchVersion?: string
}

interface SearchRaw {
  /** 真实接口里 status 是 { cndesc, infocode } 对象；infocode=1000 表示成功，2003=参数错误 */
  status?: { cndesc?: string; infocode?: number }
  msg?: string
  /** 成功时 data 是个对象，不是一组数组 */
  data?: {
    keyWord?: string
    count?: string | number
    pois?: Array<{
      name: string
      address: string
      lonlat: string
      phone?: string
      hotPointID?: string
      poiType?: string
    }>
  }
}

/** 地址 → 坐标（位置搜索） */
export async function geocode(keyword: string, adminCode?: string): Promise<GeocodedPlace[]> {
  const tk = getTiandituKey()
  if (!tk) throw new Error('未配置天地图密钥')

  // 接口要求 ds 是一个 JSON 字符串作为 query 参数，URL 编码两次更稳
  const ds: Record<string, unknown> = { keyWord: keyword }
  if (adminCode) {
    ds.specifyAdmin = adminCode
    ds.latestAdmin = adminCode
  }
  const url = `${GEOCODER_URL}?ds=${encodeURIComponent(JSON.stringify(ds))}&tk=${encodeURIComponent(tk)}`

  const res = await fetch(url, { headers: { [USER_AGENT_HEADER]: 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`地址搜索失败：HTTP ${res.status}`)

  const raw = (await res.json()) as GeocoderRaw
  if (raw.status !== '0' || !raw.location) {
    if (raw.status === '1') return []
    throw new Error(raw.msg || '地址搜索失败')
  }
  const r = raw.location
  return [{
    address: r.keyWord || '',
    name: r.keyWord || '',
    lng: Number(r.lon),
    lat: Number(r.lat),
    level: r.level || '兴趣点',
  }]
}

interface BBox {
  minLng: number; minLat: number; maxLng: number; maxLat: number
}

/** 视野内 POI 搜索（周边搜索） */
export async function searchPoi(
  keyword: string,
  bounds: BBox,
  options: { count?: number; mapType?: 'vector' | 'image' } = {}
): Promise<PoiSearchResult> {
  const tk = getTiandituKey()
  if (!tk) throw new Error('未配置天地图密钥')

  const count = Math.min(Math.max(options.count ?? 20, 1), 50)
  // 注意：postStr 必须放在 query string 上（而不是 request body），实测 POST 形式会让
  // 服务端 500；这与天地图官方 SDK 的实现不一致，但公共 REST 端点行为如此
  const postStr = {
    keyWord: keyword,
    queryType: 1,
    level: 12, // 12 = 兴趣点搜索（不传会 infocode=2003）
    mapBound: `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}`,
    start: 0,
    count,
    mapType: options.mapType === 'image' ? 'img' : 'vec',
  }
  const url = `${SEARCH_URL}?postStr=${encodeURIComponent(JSON.stringify(postStr))}&type=query&tk=${encodeURIComponent(tk)}`

  const res = await fetch(url, { headers: { [USER_AGENT_HEADER]: 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`POI 搜索失败：HTTP ${res.status}`)

  const raw = (await res.json()) as SearchRaw
  const code = raw.status?.infocode
  // 1000 = 成功；2003 = 参数错误；其他非 1000 的也是失败
  if (code !== undefined && code !== 1000) {
    if (raw.data && (raw.data.count === 0 || raw.data.count === '0')) {
      return { total: 0, pois: [] }
    }
    throw new Error(raw.status?.cndesc || raw.msg || `POI 搜索失败（infocode ${code}）`)
  }
  if (!raw.data) return { total: 0, pois: [] }

  const list = raw.data.pois ?? []
  const total = Number(raw.data.count ?? list.length)
  const pois: PoiItem[] = []
  for (const p of list) {
    // lonlat 形如 "116.4074,39.9042"
    const parts = p.lonlat?.split(',').map(Number)
    if (!parts || parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) continue
    pois.push({
      name: p.name,
      address: p.address,
      lng: parts[0],
      lat: parts[1],
      phone: p.phone || undefined,
      hotPointId: p.hotPointID || undefined,
    })
  }
  return { total, pois }
}

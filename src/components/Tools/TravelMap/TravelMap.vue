<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import TiandituMap from './TiandituMap.vue'
import PointEditDialog from './PointEditDialog.vue'
import MyMapsDrawer from './MyMapsDrawer.vue'
import { useUserStore } from '@/store/modules/user'
import { fetchMyMaps, createMap, fetchMap, saveMap } from '@/api/travel-maps'
import { geocode, searchPoi, type GeocodedPlace, type PoiItem } from '@/utils/tiandituSearch'
import { routeAlongRoad, OsrmError } from '@/utils/osrm'
import {
  POINT_CATEGORIES, BASE_LAYERS, ROUTE_COLORS, OSRM_PROFILES, LIMITS,
  DEFAULT_CENTER, DEFAULT_ZOOM,
  getCategory, pathDistance, formatDistance, formatElevation, simplifyPath,
  countSharpTurns, SHARP_TURN_DEFAULTS,
} from './constants'
import type { MapPoint, MapRoute, BaseLayer, LngLat, PointCategory, RouteProfile } from './types'

const info = {
  title: '旅游地图',
  desc: '基于天地图规划路线、标注露营地/商店超市/观景点并记录海拔，可创建多张地图并分享到地图广场。',
}

const router = useRouter()
const userStore = useUserStore()
const mapRef = ref<InstanceType<typeof TiandituMap> | null>(null)

// ---------- 当前地图状态 ----------
const mapId = ref('')
const slug = ref('')
const title = ref('我的旅游地图')
const description = ref('')
const center = ref<LngLat>({ ...DEFAULT_CENTER })
const zoom = ref(DEFAULT_ZOOM)
const baseLayer = ref<BaseLayer>('vec')
const isPublic = ref(false)
const points = ref<MapPoint[]>([])
const routes = ref<MapRoute[]>([])

const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)
const drawerVisible = ref(false)

// ---------- 交互模式 ----------
const mode = ref<'browse' | 'point' | 'route' | 'route-osrm'>('browse')
const draftPath = ref<[number, number][]>([])
// OSRM 当前 profile + 调 OSRM 时的 abort 控制器（用于取消未完成的请求）
const osrmProfile = ref<RouteProfile>('driving')
let osrmAbort: AbortController | null = null
const osrmLoading = ref(false)
// 沿道路画路线模式下「最近一次被点中的点位 id」，传给 TiandituMap 用于高亮边框。
// 用户点 A → A 高亮；点 B → A 取消、B 高亮；OSRM 失败 → 回滚到上一次的 id（或 null）。
const selectedPointId = ref<string | null>(null)
// 当前选中的路线 id：用户点地图上的路线 → 路线列表选中该项；点空白处取消。
const selectedRouteId = ref<string | null>(null)

// ---------- 点位弹窗 ----------
const pointDialogVisible = ref(false)
const editingPoint = ref<MapPoint | null>(null)
const pendingLng = ref(0)
const pendingLat = ref(0)

// draft 路径颜色：route-osrm 模式按当前 profile 给色，其他模式默认红
const draftColor = computed(() => {
  if (mode.value === 'route-osrm') {
    return OSRM_PROFILES.find((p) => p.value === osrmProfile.value)?.color || '#dc2626'
  }
  return '#dc2626'
})

// ---------- 列表筛选 ----------
const categoryFilter = ref<PointCategory | 'all'>('all')

const isLoggedIn = computed(() => userStore.getLoginStatus)

const filteredPoints = computed(() =>
  categoryFilter.value === 'all'
    ? points.value
    : points.value.filter((p) => p.category === categoryFilter.value)
)

const totalDistance = computed(() =>
  routes.value.reduce((sum, r) => sum + r.distance, 0)
)

// 每条路线的急弯数 —— 用 Map 缓存，path 不变就不重算。
// 路线长度 ≤ 500 节点，单条计算很轻；但模板里每个卡片每帧都可能被重渲染，
// 不缓存的话改一下其他东西也会顺带全量重算一遍，没必要。
const sharpTurnsCache = computed(() => {
  const map = new Map<string, number>()
  for (const r of routes.value) {
    map.set(r.id, countSharpTurns(r.path))
  }
  return map
})
function getSharpTurns(routeId: string): number {
  return sharpTurnsCache.value.get(routeId) ?? 0
}
// 删除路线时清掉缓存里对应的 id,避免 Map 无限增长。
// 这里用 watch 而不是把清理写在 deleteRoute 里,是因为 applyDetail 回填
// 时 routes 整体被替换（id 全换一遍）,缓存自然会被 computed 重新算,不需要
// 在那里手动清。
watch(routes, (next) => {
  const liveIds = new Set(next.map((r) => r.id))
  for (const id of sharpTurnsCache.value.keys()) {
    if (!liveIds.has(id)) sharpTurnsCache.value.delete(id)
  }
})

const draftDistance = computed(() => pathDistance(draftPath.value))

const shareUrl = computed(() =>
  slug.value ? `${window.location.origin}/travel-map/share/${slug.value}` : ''
)

// 任何本地改动都标记为未保存 + 触发自动保存
// 去抖 1.5s：避免连续打字/连续点击触发一堆 PUT。
// 抑制条件：
//   - applyingDetail：applyDetail 正在把服务器响应回填到本地状态，那些写值
//     不算"用户改动"，不能因为它再 PUT 一次
//   - bootstrap 期间（避免刚打开地图就 PUT 一遍）
//   - 路线绘制中（draftPath 还没落库，不能把半成品打回去）
// 点位弹窗期间不抑制，因为弹窗关掉那一刻 handlePointSubmit 才会改 points.value，
// 此时 dialog 已经 close 了，watch 看到的 state 是稳定可保存的。
const applyingDetail = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
watch([title, description, baseLayer, points, routes], () => {
  if (loading.value) return
  if (applyingDetail.value) return
  if (mode.value === 'route' || mode.value === 'route-osrm') return
  if (!isLoggedIn.value || !mapId.value) return
  dirty.value = true
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    void handleSave({ silent: true })
  }, 1500)
}, { deep: true })

// ---------- 搜索 ----------

const geocodeQuery = ref('')
const geocodeResults = ref<GeocodedPlace[]>([])
const geocodeLoading = ref(false)
const geocodeOpen = ref(false)

async function runGeocode() {
  const q = geocodeQuery.value.trim()
  if (!q) return
  geocodeLoading.value = true
  geocodeOpen.value = true
  try {
    geocodeResults.value = await geocode(q)
    if (!geocodeResults.value.length) {
      ElMessage.info('没找到匹配地点，试试更短的关键词')
    }
  } catch (error: any) {
    const msg = error?.message || '地址搜索失败'
    ElMessage.error(msg)
    geocodeResults.value = []
  } finally {
    geocodeLoading.value = false
  }
}

function pickGeocodeResult(place: GeocodedPlace) {
  // 飞过去并放大到能看清周边；同时把编辑器当前 center / zoom 同步上去，否则保存时会覆盖
  center.value = { lng: place.lng, lat: place.lat }
  zoom.value = Math.max(zoom.value, 14)
  mapRef.value?.panTo(place.lng, place.lat, zoom.value)
  geocodeOpen.value = false
  geocodeQuery.value = ''
  ElMessage.success(`已定位：${place.name}`)
}

const POI_CATEGORIES: Array<{ keyword: string; emoji: string; label: string; category: PointCategory }> = [
  { keyword: '露营地', emoji: '⛺', label: '露营地', category: 'camp' },
  { keyword: '超市', emoji: '🛒', label: '超市', category: 'shop' },
  { keyword: '加油站', emoji: '⛽', label: '加油站', category: 'other' },
  { keyword: '餐厅', emoji: '🍜', label: '餐厅', category: 'food' },
  { keyword: '卫生间', emoji: '🚻', label: '卫生间', category: 'toilet' },
  { keyword: '停车场', emoji: '🅿️', label: '停车场', category: 'parking' },
]

const poiQuery = ref('')
const poiCategory = ref<typeof POI_CATEGORIES[number] | null>(null)
const poiResults = ref<PoiItem[]>([])
const poiLoading = ref(false)
const poiVisible = ref(false)

async function runPoiSearch() {
  const kw = (poiCategory.value?.keyword || poiQuery.value).trim()
  if (!kw) {
    ElMessage.warning('请输入关键词或选一个分类')
    return
  }
  const bounds = mapRef.value?.getBounds()
  if (!bounds) {
    ElMessage.warning('地图还没准备好，拖动一下地图再试')
    return
  }
  poiLoading.value = true
  poiVisible.value = true
  try {
    const res = await searchPoi(kw, bounds, { count: 20, mapType: baseLayer.value === 'img' ? 'image' : 'vector' })
    poiResults.value = res.pois
    if (!res.pois.length) {
      ElMessage.info('当前视野内没搜到结果，试试把地图放到更大范围或换关键词')
    }
  } catch (error: any) {
    ElMessage.error(error?.message || 'POI 搜索失败')
    poiResults.value = []
  } finally {
    poiLoading.value = false
  }
}

function pickPoiCategory(c: typeof POI_CATEGORIES[number]) {
  poiCategory.value = c
  poiQuery.value = ''
  runPoiSearch()
}

function flyToPoi(p: PoiItem) {
  mapRef.value?.panTo(p.lng, p.lat, 16)
  center.value = { lng: p.lng, lat: p.lat }
  zoom.value = 16
  poiVisible.value = false
}

function addPoiAsPoint(p: PoiItem) {
  const cat = poiCategory.value?.category ?? 'other'
  if (points.value.length >= LIMITS.points) {
    ElMessage.warning(`单张地图最多 ${LIMITS.points} 个点位`)
    return
  }
  points.value = [
    ...points.value,
    {
      id: `local-point-${Date.now()}-${points.value.length}`,
      name: p.name,
      category: cat,
      lng: p.lng,
      lat: p.lat,
      elevation: null,
      note: p.address || '',
    },
  ]
  ElMessage.success(`已添加：${p.name}`)
}

// ---------- 登录拦截 ----------

function requireLogin(): boolean {
  if (isLoggedIn.value) return true
  ElMessageBox.confirm('保存地图需要先登录，是否前往登录？', '未登录', {
    confirmButtonText: '去登录',
    cancelButtonText: '继续逛逛',
    type: 'info',
  })
    .then(() => {
      window.location.href = `/login?redirect=${encodeURIComponent('/travel-map/')}`
    })
    .catch(() => { /* 用户选择继续本地试用 */ })
  return false
}

// ---------- 加载 ----------

// 记下用户最后打开的地图 id，下次进来直接打开它而不是取列表第一张。
// localStorage 没有失效机制，但每次 openMap 都会写；如果该 id 已被删除或被另一
// 个用户拥有（403/404），bootstrap 会自然 fallback 到列表第一张，再清掉这个值。
// 按 uid 隔离，避免同浏览器换账号时读到别人的。
const LAST_MAP_KEY = (uid: string) => `travel-map:last-opened:${uid}`

function readLastMapId(uid: string): string | null {
  try {
    return localStorage.getItem(LAST_MAP_KEY(uid)) || null
  } catch {
    return null
  }
}

function writeLastMapId(uid: string, id: string) {
  try {
    localStorage.setItem(LAST_MAP_KEY(uid), id)
  } catch {
    // 隐私模式 / 配额满，忽略
  }
}

function clearLastMapId(uid: string) {
  try {
    localStorage.removeItem(LAST_MAP_KEY(uid))
  } catch {
    // ignore
  }
}

async function bootstrap() {
  loading.value = true
  try {
    if (!isLoggedIn.value) return // 未登录：本地试玩，不拉数据

    const uid = userStore.getUserInfo?.uid
    const lastId = uid ? readLastMapId(uid) : null

    if (lastId) {
      // 优先尝试上次打开的那张。如果它已被删/被改权/取不到，自动回落
      const ok = await openMap(lastId)
      if (ok) return
    }

    // 列表第一张作为兜底
    const { list } = await fetchMyMaps(1, 1)
    if (list.length) {
      await openMap(list[0].id)
    } else {
      const created = await createMap({ title: '我的旅游地图' })
      applyDetail(created)
      if (uid && mapId.value) writeLastMapId(uid, mapId.value)
    }
  } catch {
    // 拦截器已提示
  } finally {
    loading.value = false
    dirty.value = false
  }
}

// 数组"等价"判断：长度相同 + 每个元素 id / name / lng / lat / elevation / note / category / sortOrder 都一致。
// 严格相等（same reference）算等价；顺序一致且内容一致算等价；只要有任何字段不同
// 就视为需要重画。注意：服务端会在保存后重排 id（本地临时 id → 真 uuid），所以保存
// 之后的 detail.points 跟本地 points 引用/字段都不同，是合理的「需要重画」场景。
// 数组"等价"判断 —— 跳过 id，因为服务端会在保存后重排 id（本地临时 → 真 uuid）。
// 这里只比业务字段，业务字段一致就算等价；id 变化交给 Vue 正常去替换组件实例，
// 不会牵连其他字段的输入框。
function pointsEqual(a: MapPoint[], b: MapPoint[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    if (x.name !== y.name || x.category !== y.category) return false
    if (x.lng !== y.lng || x.lat !== y.lat) return false
    if (x.elevation !== y.elevation || x.note !== y.note) return false
  }
  return true
}

// 数组"等价"判断 —— 跳过 id，因为服务端会在保存后重排 id（本地临时 → 真 uuid），
// 把 id 列进对比会让 routesEqual 永远 false，结果就是 routes 数组每次都赋值，
// 整个路线卡片（含路线名称 el-input）会被 v-for 销毁重建 → 输入框失焦。
// 这里只比业务字段，业务字段一致就算等价，id 不同让 Vue 替换组件实例没关系。
function routesEqual(a: MapRoute[], b: MapRoute[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    if (x.name !== y.name || x.color !== y.color) return false
    if (x.note !== y.note) return false
    if (x.distance !== y.distance) return false
    // kind 是 UI 标签 + 未来筛选用的字段，必须参与等价判断：
    // 不然 route-osrm 模式保存后回填，kind 字段差异会让 routesEqual = false，
    // 触发整个路线数组重新赋值，路线卡片里的 el-input 会被销毁重建 → 失焦。
    if ((x.kind ?? 'straight') !== (y.kind ?? 'straight')) return false
    if (x.path.length !== y.path.length) return false
    for (let j = 0; j < x.path.length; j++) {
      if (x.path[j][0] !== y.path[j][0] || x.path[j][1] !== y.path[j][1]) return false
    }
  }
  return true
}

function applyDetail(detail: any) {
  // 整个赋值过程包在 applyingDetail 旗标里：
  //   - 抑制上面的 watch 自动保存（不是用户改动，不能 PUT 回服务器）
  //   - applyDetail 结束后再清 dirty（用户在 PUT 之前改的东西已经被服务器接受了）
  //
  // 每个 ref 都要做"内容等价"判断：保存成功后服务端回填的 detail 内容跟本地
  // 往往是一致的（服务器只是把 id 从临时换成真 uuid 后整体返回），如果直接赋值
  // 会让 Vue 检测到引用/值变化，触发：
  //   - el-input 的 v-model → 输入框内部 <input> DOM value 被重写 → 失焦
  //     （这就是用户报告的「标题输入框聚焦后闪一下失焦」）
  //   - 子组件 props 变化 → 整个 watch 重画 → 备注/点位闪动
  // 所以 applyDetail 必须做到"内容没变就别赋值"。
  applyingDetail.value = true
  try {
    if (mapId.value !== detail.id) mapId.value = detail.id
    if (slug.value !== detail.slug) slug.value = detail.slug
    // title / description：字符串相等就直接跳过赋值，避免 el-input 重渲染失焦
    if (title.value !== detail.title) title.value = detail.title
    if (description.value !== detail.description) description.value = detail.description
    // center / zoom 用亚像素级容差比较：保存时是浮点坐标，applyDetail 回填后
    // 浮点微差也会触发子组件的 centerAndZoom → 视野跳动让 label 抖一下
    const c = detail.center
    if (
      !center.value ||
      Math.abs(center.value.lng - c.lng) > 1e-7 ||
      Math.abs(center.value.lat - c.lat) > 1e-7
    ) {
      center.value = c
    }
    if (Math.abs(zoom.value - detail.zoom) > 0.01) zoom.value = detail.zoom
    if (baseLayer.value !== detail.baseLayer) baseLayer.value = detail.baseLayer
    if (isPublic.value !== detail.isPublic) isPublic.value = detail.isPublic
    const nextPoints = detail.points ?? []
    const nextRoutes = detail.routes ?? []
    if (!pointsEqual(points.value, nextPoints)) points.value = nextPoints
    if (!routesEqual(routes.value, nextRoutes)) routes.value = nextRoutes
  } finally {
    applyingDetail.value = false
  }
}

async function openMap(id: string): Promise<boolean> {
  loading.value = true
  try {
    const detail = await fetchMap(id)
    // 切地图：旧的选中态属于上一张地图，清掉避免"列表里残留高亮但地图上没线"
    selectedRouteId.value = null
    selectedPointId.value = null
    applyDetail(detail)
    // 中心/缩放/点位/路线都更新了 props。TiandituMap 里挂了 watch：
    //   - center/zoom 变化 → 飞过去
    //   - points/routes 变化 → 重绘覆盖物
    // 所以这里不再额外调 panTo / fitAll。
    // 记下当前打开的 id，下次刷新直接进这张
    const uid = userStore.getUserInfo?.uid
    if (uid) writeLastMapId(uid, id)
    return true
  } catch {
    // 404/403 都表示这张 id 已不可用：清掉缓存，让 bootstrap 走列表兜底
    const uid = userStore.getUserInfo?.uid
    if (uid) clearLastMapId(uid)
    return false
  } finally {
    loading.value = false
    dirty.value = false
  }
}

onMounted(bootstrap)

// ---------- 地图交互 ----------

function handleMapClick(ll: { lng: number; lat: number }) {
  if (mode.value === 'point') {
    if (points.value.length >= LIMITS.points) {
      ElMessage.warning(`单张地图最多 ${LIMITS.points} 个点位`)
      return
    }
    editingPoint.value = null
    pendingLng.value = ll.lng
    pendingLat.value = ll.lat
    pointDialogVisible.value = true
  } else if (mode.value === 'route') {
    if (draftPath.value.length >= LIMITS.routeNodes) {
      ElMessage.warning(`单条路线最多 ${LIMITS.routeNodes} 个节点`)
      return
    }
    draftPath.value = [...draftPath.value, [ll.lng, ll.lat]]
  }
}

function handleViewChange(payload: { center: LngLat; zoom: number }) {
  // 这里原本会把 center/zoom 写回父组件状态（用于保存时写回 map meta），
  // 但「地图自己拖动」也会 emit view-change，如果实时回写，
  // 子组件的 center watch 会命中 → 调 centerAndZoom → 再触发 moveend →
  // 再 emit → 死循环，瓦片请求风暴式打过来。
  //
  // 修法：本地缓存的 center/zoom 只在「用户主动跳视野」时才更新（panTo /
  // fitAll / openMap）。地图自己拖出来的最终位置，在保存时由 handleSave
  // 自己从 mapRef.getCenter() 取实时值，避免依赖父组件状态去触发子组件 watch。
  // 这里只更新 POI 搜索要用的视野缓存（currentBounds 在子组件内自行维护）。
  void payload
}

function handlePointClick(id: string) {
  const p = points.value.find((x) => x.id === id)
  if (!p) return
  editingPoint.value = p
  pointDialogVisible.value = true
}

// 用户点中地图上的路线（线身或距离标签）→ 选中该项。
// 再次点同一项则取消选中（toggle）。
function handleRouteClick(routeId: string) {
  selectedRouteId.value = selectedRouteId.value === routeId ? null : routeId
}

// 用户在 browse 模式下点中空白处 → 清掉选中的路线
function handleMapBlankClick() {
  selectedRouteId.value = null
}

// 路线卡片 DOM 引用表：用 id 索引，selectedRouteId 变化时 scrollIntoView 用。
// 不放 ref() 里是因为一个 ref 只能绑一个元素，路线数量动态的，
// 用 Map 按 id 索引更直观。Vue 在 v-for 元素销毁时会调用 ref 回调传 null，
// 这里清掉对应 entry 避免内存泄漏。
const routeCardRefs = new Map<string, HTMLElement>()
function setRouteCardRef(id: string, el: HTMLElement | null) {
  if (el) routeCardRefs.set(id, el)
  else routeCardRefs.delete(id)
}

// 用户从地图上选中路线后，如果对应卡片在路线列表的可滚动区之外，
// 自动滚到可见区域（block: 'nearest' 让"已经可见就不动"，
// 用户在屏幕外选了就滚到屏幕内，屏幕内选了就不滚）。
watch(selectedRouteId, (id) => {
  if (!id) return
  const el = routeCardRefs.get(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})

// ---------- 点位增删改 ----------

function handlePointSubmit(payload: Omit<MapPoint, 'id'> & { id?: string }) {
  if (payload.id) {
    const index = points.value.findIndex((p) => p.id === payload.id)
    if (index >= 0) {
      points.value[index] = { ...points.value[index], ...payload, id: payload.id }
    }
  } else {
    points.value = [
      ...points.value,
      { ...payload, id: `local-point-${Date.now()}-${points.value.length}` },
    ]
  }
  // 改动会被上面的 watch 监到，1.5s 后自动保存
}

function handlePointDelete(id: string) {
  points.value = points.value.filter((p) => p.id !== id)
}

function locatePoint(p: MapPoint) {
  mapRef.value?.panTo(p.lng, p.lat, Math.max(zoom.value, 14))
}

// ---------- 路线 ----------

function startDrawRoute() {
  if (routes.value.length >= LIMITS.routes) {
    ElMessage.warning(`单张地图最多 ${LIMITS.routes} 条路线`)
    return
  }
  mode.value = 'route'
  draftPath.value = []
  ElMessage.info('在地图上依次点击添加直线节点，完成后点「结束绘制」')
}

function undoDraftNode() {
  if (mode.value === 'route-osrm') {
    // OSRM 模式：撤销一段（从 anchorPoints 弹出最后一个，draftPath 截到上一个锚点）。
    if (osrmAnchorPoints.value.length <= 1) {
      draftPath.value = []
      osrmAnchorPoints.value = []
      osrmSegmentDistances.value = []
      return
    }
    osrmAnchorPoints.value = osrmAnchorPoints.value.slice(0, -1)
    osrmSegmentDistances.value = osrmSegmentDistances.value.slice(0, -1)
    // 截 draftPath 到倒数第二个锚点的位置（包含）
    const lastAnchor = osrmAnchorPoints.value[osrmAnchorPoints.value.length - 1]
    const idx = draftPath.value.findIndex(
      ([lng, lat]) => Math.abs(lng - lastAnchor[0]) < 1e-7 && Math.abs(lat - lastAnchor[1]) < 1e-7
    )
    draftPath.value = idx >= 0 ? draftPath.value.slice(0, idx + 1) : []
  } else {
    draftPath.value = draftPath.value.slice(0, -1)
  }
}

function finishDrawRoute() {
  if (draftPath.value.length < 2) {
    ElMessage.warning('至少需要 2 个节点才能形成一条路线')
    return
  }
  const index = routes.value.length
  // 距离用 osrmSegmentDistances 累加（OSRM 给的精确值），不用 pathDistance
  // —— 因为 draftPath 是抽稀过的，pathDistance 用 haversine 累加会比 OSRM
  // 返回的精确距离略小，抽稀越狠差越多。osrmSegmentDistances 是源头数据。
  const routeDistance = osrmSegmentDistances.value.length > 0
    ? osrmSegmentDistances.value.reduce((a, b) => a + b, 0)
    : pathDistance(draftPath.value)
  // 路线类型：route-osrm 模式下是「沿道路画路线」（OSRM 算的真实道路），
  // 其他模式（route）都是用户在地图上点出来的直线段。
  const routeKind: 'straight' | 'road' = mode.value === 'route-osrm' ? 'road' : 'straight'
  routes.value = [
    ...routes.value,
    {
      id: `local-route-${Date.now()}-${index}`,
      name: `路线 ${index + 1}`,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
      path: [...draftPath.value],
      distance: routeDistance,
      note: '',
      kind: routeKind,
    },
  ]
  draftPath.value = []
  osrmAnchorPoints.value = []
  osrmSegmentDistances.value = []
  selectedPointId.value = null
  mode.value = 'browse'
  ElMessage.success('路线已添加')
}

function cancelDrawRoute() {
  // abort 未完成的 OSRM 请求，避免取消后请求结果污染 draftPath
  if (osrmAbort) {
    osrmAbort.abort()
    osrmAbort = null
  }
  osrmLoading.value = false
  draftPath.value = []
  osrmAnchorPoints.value = []
  osrmSegmentDistances.value = []
  selectedPointId.value = null
  mode.value = 'browse'
}

function deleteRoute(id: string) {
  routes.value = routes.value.filter((r) => r.id !== id)
  // 如果删的就是当前选中的路线，清掉选中态（否则列表里那行卡片留着高亮，
  // 但地图上已经没对应的线了，看着像 bug）
  if (selectedRouteId.value === id) selectedRouteId.value = null
}

/** 点击路线卡片 → panTo 到路线第一个节点位置（比 fitAll 更精准） */
function locateRoute(r: MapRoute) {
  if (!r.path || r.path.length === 0) return
  const [lng, lat] = r.path[0]
  mapRef.value?.panTo(lng, lat, Math.max(zoom.value, 12))
}

function cycleRouteColor(route: MapRoute) {
  const i = ROUTE_COLORS.indexOf(route.color)
  route.color = ROUTE_COLORS[(i + 1) % ROUTE_COLORS.length]
}

function setMode(next: 'browse' | 'point') {
  if (mode.value === 'route' || mode.value === 'route-osrm') cancelDrawRoute()
  mode.value = mode.value === next ? 'browse' : next
}

// ---------- 沿道路画路线（OSRM） ----------

/**
 * 用户在 OSRM 模式下点中的点位（原始顺序）。
 * draftPath 是渲染用的「沿道路节点序列」，被 OSRM 返回值污染；
 * osrmAnchorPoints 保存用户视角的「我点了哪些点位」，每次只算"上一段"。
 * 这是避免"点 N 个点位变成几千个节点"的关键 —— 不能让 draftPath 在每次
 * OSRM 调用之间累积路径节点。
 */
const osrmAnchorPoints = ref<[number, number][]>([])
// 每段沿道路距离（米），长度 = anchorPoints.length - 1
const osrmSegmentDistances = ref<number[]>([])

function startDrawOsrmRoute() {
  if (routes.value.length >= LIMITS.routes) {
    ElMessage.warning(`单张地图最多 ${LIMITS.routes} 条路线`)
    return
  }
  if (!points.value.length) {
    ElMessage.warning('地图上还没有点位，先标几个点再来连')
    return
  }
  mode.value = 'route-osrm'
  draftPath.value = []
  osrmAnchorPoints.value = []
  osrmSegmentDistances.value = []
  const profileLabel = OSRM_PROFILES.find((p) => p.value === osrmProfile.value)?.label || ''
  ElMessage.info(`沿道路画路线（${profileLabel}）：依次点中点位，每次点中会调 OSRM 实时算路，完成后点「结束绘制」`)
}

/**
 * 用户在 route-osrm 模式下点中一个点位：
 *   - 把点位存到 osrmAnchorPoints（不污染 draftPath）
 *   - 第一次点中：直接把这个点放进 draftPath（只有起点没路径可算）
 *   - 第二次及之后点中：调 OSRM 算「上一锚点 → 当前锚点」的沿道路路径，
 *     把 result.path 追加到 draftPath 后面（替换掉之前临时加的那个直线点）
 *   - 失败时按用户要求"完全不画"：toast 报错，**回退掉刚加的锚点**
 */
async function handleOsrmRouteFromPoint(payload: { id: string; lng: number; lat: number }) {
  const { id, lng, lat } = payload
  const beforeAnchors = osrmAnchorPoints.value.length
  if (beforeAnchors >= LIMITS.routeNodes) {
    ElMessage.warning(`单条路线最多 ${LIMITS.routeNodes} 个节点`)
    return
  }
  // 记录用户点中的点位（用户视角的锚点）
  osrmAnchorPoints.value = [...osrmAnchorPoints.value, [lng, lat]]
  // draftPath 现在 = OSRM 返回的完整路径（沿真实道路），不是直线连接。
  // 这样画线过程中能预览真实路线形状。性能优化靠：drawDraft 不画 Circle 节点
  // + 段距离标签按累计步长。
  draftPath.value = [...osrmAnchorPoints.value] // 第一个点先占位，等 OSRM 回来再覆盖
  // 视觉反馈：让最近被点中的点位边框变橙。OSRM 失败时回滚到 previousSelected；
  // 被用户快速连点导致 abort 时，selectedPointId 已经被更新的调用接管，不回滚。
  const previousSelected = selectedPointId.value
  selectedPointId.value = id

  if (beforeAnchors === 0) return

  // abort 上一次未完成的请求，避免乱序返回污染路径
  if (osrmAbort) osrmAbort.abort()
  const thisAbort = new AbortController()
  osrmAbort = thisAbort
  osrmLoading.value = true
  try {
    // 算路只传两个点：上一锚点 + 当前锚点。把结果追加到 draftPath 后面。
    const prev = osrmAnchorPoints.value[beforeAnchors - 1]
    const result = await routeAlongRoad(
      osrmProfile.value,
      [prev, [lng, lat]],
      thisAbort.signal
    )
    // 把"沿道路的真实路径节点"写进 draftPath —— 画线过程中显示真实路线形状，
    // 不再是直线。段距离也存一份用于显示距离标签。
    // draftPath 结构：[锚点0, ...OSRM节点, 锚点1, ...OSRM节点, 锚点2, ...]
    // —— 把上一段的尾点去掉避免重复（OSRM path 包含起点 = 锚点 0）
    //
    // OSRM 单次返回几百节点（overview=full）。直接把 tail 全 append 进去会导致：
    //   1. draftPath 总节点数爆炸（5 段 × 200 = 1000），超过服务端 MAX_ROUTE_NODES=500
    //   2. 自动保存时被服务端校验拒绝，路线画完却保存失败
    //   3. 状态栏"已加 X 个节点"数字飙到 900+，用户根本不在乎这个
    // 这里用 30m 容差把每段抽稀到几十节点 —— 抽稀后的节点仍然沿道路走，
    // 距离损失 < 1%（drawDraft 还会用 100m 容差二次简化视觉），但总节点数
    // 从 O(段数 × 几百) 降到 O(段数 × 几十)，不会再撞上限。
    const rawTail: [number, number][] = result.path.length > 0
      ? result.path.slice(1) as [number, number][]
      : [[lng, lat]]
    const tail: [number, number][] = rawTail.length > 1
      ? simplifyPath(rawTail, 30)
      : rawTail
    draftPath.value = [...draftPath.value.slice(0, -1), ...tail]
    osrmSegmentDistances.value = [...osrmSegmentDistances.value, result.distance]
    ElMessage.success(`已算路 ${formatDistance(result.distance)}`)
  } catch (error: any) {
    // 先判断是不是"被更新点击打断了"——这种情况属于用户主动连点，
    // 不应该回滚 selectedPointId（新调用已经把它接管）。
    // 被外部 abort 时 thisAbort.signal.aborted === true。
    const wasAborted = thisAbort.signal.aborted
    if (wasAborted) {
      // 不弹错误、不回滚选中态；让更新的那次调用去管
    } else {
      if (error?.code === 'timeout') {
        ElMessage.error('OSRM 请求超时，请稍后重试')
      } else if (error instanceof OsrmError) {
        ElMessage.error(`OSRM 算路失败：${error.message}`)
      } else {
        ElMessage.error(`OSRM 算路失败：${error?.message || '未知错误'}`)
      }
      // 失败时回退选中态：保留更早的成功选中
      selectedPointId.value = previousSelected
      // 用户要求：失败时"完全不画" —— 回退掉刚才加的锚点 + draftPath 也回退
      osrmAnchorPoints.value = osrmAnchorPoints.value.slice(0, -1)
      // draftPath 回退方式：截掉最后一段（从最后一个锚点开始往前所有节点）
      if (osrmAnchorPoints.value.length === 0) {
        draftPath.value = []
      } else {
        const lastAnchor = osrmAnchorPoints.value[osrmAnchorPoints.value.length - 1]
        const idx = draftPath.value.findIndex(
          ([lng, lat]) => Math.abs(lng - lastAnchor[0]) < 1e-7 && Math.abs(lat - lastAnchor[1]) < 1e-7
        )
        draftPath.value = idx >= 0 ? draftPath.value.slice(0, idx + 1) : []
      }
    }
  } finally {
    if (osrmAbort === thisAbort) osrmAbort = null
    osrmLoading.value = false
  }
}

// ---------- 保存与分享 ----------

async function handleSave(opts: { silent?: boolean } = {}): Promise<boolean> {
  if (!requireLogin()) return false
  if (!mapId.value) {
    ElMessage.warning('地图尚未初始化，请刷新页面重试')
    return false
  }
  // 两种画线模式都阻止保存：draftPath 是未提交的半成品路线
  if ((mode.value === 'route' || mode.value === 'route-osrm') && draftPath.value.length) {
    if (!opts.silent) ElMessage.warning('请先结束或取消当前路线绘制')
    return false
  }

  saving.value = true
  try {
    // 优先取地图实例的实时视野（用户可能已经拖动 / 缩放过了，center/zoom 父组件
    // 状态不一定是最新的；不直接信父组件状态是为了避免「view-change → 改 center
    // → 子组件 watch → centerAndZoom → 再 emit view-change」的反馈循环）
    const liveView = mapRef.value?.getView?.()
    const saveCenter = liveView?.center ?? center.value
    const saveZoom = liveView?.zoom ?? zoom.value
    // 保存后把父组件的 center/zoom 也同步上去，否则 fitAll / panTo 等后续操作
    // 还会拿到陈旧值
    if (liveView) {
      center.value = liveView.center
      zoom.value = liveView.zoom
    }
    const detail = await saveMap(mapId.value, {
      title: title.value,
      description: description.value,
      center: saveCenter,
      zoom: saveZoom,
      baseLayer: baseLayer.value,
      isPublic: isPublic.value,
      // 后端会重新分配 id，这里把本地临时 id 去掉
      points: points.value.map(({ id, ...rest }) => rest),
      routes: routes.value.map(({ id, ...rest }) => rest),
    })
    applyDetail(detail)
    dirty.value = false
    // 自动保存的 toast 静默——每改一个字就弹一次会刷屏；手动点保存才提示
    if (!opts.silent) ElMessage.success('已保存')
    return true
  } catch (error: any) {
    // 400 是服务端校验（超限等），带着后端文案提示更有用
    const msg = error?.response?.data?.error
    if (msg) ElMessage.error(msg)
    return false
  } finally {
    saving.value = false
  }
}

async function toggleShare(value: string | number | boolean) {
  const next = Boolean(value)
  const previous = isPublic.value
  if (!requireLogin()) {
    isPublic.value = false
    return
  }
  isPublic.value = next
  const ok = await handleSave()
  if (!ok) {
    // 保存失败就把开关拨回去，避免显示成已分享但实际没存上
    isPublic.value = previous
    return
  }
  if (next && slug.value) {
    ElMessage.success('已分享，地图现在会出现在地图广场')
  }
}

async function copyShareUrl() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    ElMessage.success('分享链接已复制')
  } catch {
    ElMessage.warning('复制失败，请手动选中链接复制')
  }
}

function goPlaza() {
  router.push('/travel-map/plaza')
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title">
      <template #right>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg border border-border-subtle text-ink-700 hover:bg-gray-50 transition-colors"
            @click="goPlaza"
          >
            地图广场
          </button>
          <button
            v-if="isLoggedIn"
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg border border-accent-300 text-accent-700 hover:bg-accent-50 transition-colors"
            @click="drawerVisible = true"
          >
            我的地图
          </button>
          <!-- 现在内容改动会自动保存；按钮作为「立即保存」出口，附「已自动保存」/ dirty 提示 -->
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg text-ink-700 border border-border-subtle hover:bg-gray-50 transition-colors disabled:opacity-50"
            :disabled="saving"
            :title="dirty ? '有改动，等 1.5 秒自动保存，或点这里立即保存' : '已自动保存'"
            @click="handleSave()"
          >
            {{ saving ? '保存中…' : dirty ? '立即保存' : '已保存' }}
          </button>
        </div>
      </template>
    </DetailHeader>

    <!-- 未登录提示 -->
    <div v-if="!isLoggedIn" class="px-4">
      <div class="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between gap-3">
        <p class="text-body-sm text-amber-900">
          当前未登录，可以自由试用标点和画线，但<strong>无法保存或分享</strong>。
        </p>
        <a
          :href="`/login?redirect=${encodeURIComponent('/travel-map/')}`"
          class="shrink-0 px-3 py-1.5 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
        >去登录</a>
      </div>
    </div>

    <div class="px-4 mt-3 space-y-3">
      <!-- 地图信息 -->
      <div class="p-4 rounded-2xl bg-white">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-1.5">地图名称</label>
            <el-input v-model="title" maxlength="60" placeholder="例如：川西环线 7 日" />
          </div>
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-1.5">
              简介 <span class="font-normal text-ink-500">选填</span>
            </label>
            <el-input v-model="description" maxlength="500" placeholder="这条线路的亮点、适合季节…" />
          </div>
        </div>
      </div>

      <!-- 工具条 -->
      <div class="p-3 rounded-2xl bg-white space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <el-button
            :type="mode === 'point' ? 'primary' : 'default'"
            @click="setMode('point')"
          >
            📍 {{ mode === 'point' ? '点击地图打点中…' : '标点' }}
          </el-button>

          <template v-if="mode !== 'route' && mode !== 'route-osrm'">
            <el-button @click="startDrawRoute">📏 画直线</el-button>
            <el-button @click="startDrawOsrmRoute">🚶 沿道路画路线</el-button>
            <!-- 出行方式选择器：route-osrm 模式前显示，方便用户切换 -->
            <el-select v-model="osrmProfile" size="default" style="width: 110px">
              <el-option
                v-for="p in OSRM_PROFILES"
                :key="p.value"
                :value="p.value"
                :label="`${p.emoji} ${p.label}`"
              />
            </el-select>
          </template>
          <template v-else>
            <span class="px-2 text-body-sm text-ink-600">
              <template v-if="mode === 'route'">画直线模式</template>
              <template v-else>沿道路模式（{{ OSRM_PROFILES.find(p => p.value === osrmProfile)?.label }}）<span v-if="osrmLoading">· 算路中…</span></template>
              · {{ formatDistance(draftDistance) }}
            </span>
            <el-button size="small" :disabled="!draftPath.length" @click="undoDraftNode">撤销一步</el-button>
            <el-button size="small" type="primary" @click="finishDrawRoute">结束绘制</el-button>
            <el-button size="small" @click="cancelDrawRoute">取消</el-button>
          </template>

          <div class="flex items-center gap-1 ml-auto flex-wrap">
            <span class="text-body-sm text-ink-600">底图</span>
            <el-radio-group v-model="baseLayer" size="small">
              <el-radio-button
                v-for="l in BASE_LAYERS"
                :key="l.value"
                :value="l.value"
                :title="l.desc"
              >{{ l.label }}</el-radio-button>
            </el-radio-group>
            <el-button size="small" class="ml-1" @click="mapRef?.fitAll()">看全</el-button>
          </div>
        </div>

        <!-- 搜索区：位置 + 周边 POI -->
        <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle">
          <!-- 位置搜索 -->
          <div class="relative flex-1 min-w-[220px]">
            <el-input
              v-model="geocodeQuery"
              placeholder="搜地点/地名，如「九寨沟」「北京颐和园」"
              clearable
              size="default"
              @keyup.enter="runGeocode"
              @clear="geocodeOpen = false"
            >
              <template #prefix>🔍</template>
              <template #append>
                <el-button size="default" :loading="geocodeLoading" @click="runGeocode">跳转</el-button>
              </template>
            </el-input>
            <div
              v-if="geocodeOpen"
              class="absolute z-10 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-border-subtle rounded-lg shadow-lg"
            >
              <div v-if="geocodeLoading" class="p-3 text-center text-xs text-ink-500">搜索中…</div>
              <div
                v-else-if="!geocodeResults.length"
                class="p-3 text-center text-xs text-ink-500"
              >无结果</div>
              <button
                v-for="r in geocodeResults"
                :key="r.address"
                type="button"
                class="w-full text-left px-3 py-2 hover:bg-accent-50 border-b border-border-subtle last:border-0"
                @click="pickGeocodeResult(r)"
              >
                <div class="text-body-sm text-ink-900 truncate">{{ r.name }}</div>
                <div class="text-xs text-ink-500 truncate">{{ r.address }}</div>
              </button>
            </div>
          </div>

          <!-- 周边 POI 搜索 -->
          <div class="relative flex-1 min-w-[260px]">
            <el-input
              v-model="poiQuery"
              placeholder="搜当前视野周边：露营地/超市/卫生间…"
              size="default"
              @keyup.enter="runPoiSearch"
            >
              <template #prefix>📌</template>
              <template #append>
                <el-button size="default" :loading="poiLoading" @click="runPoiSearch">搜周边</el-button>
              </template>
            </el-input>
            <div
              v-if="poiVisible"
              class="absolute z-10 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-border-subtle rounded-lg shadow-lg"
            >
              <div class="px-3 py-2 flex flex-wrap gap-1.5 border-b border-border-subtle bg-gray-50">
                <button
                  v-for="c in POI_CATEGORIES"
                  :key="c.keyword"
                  type="button"
                  class="text-xs px-2 py-1 rounded-full border transition-colors"
                  :class="poiCategory?.keyword === c.keyword
                    ? 'border-accent-400 bg-accent-50 text-accent-700'
                    : 'border-border-subtle hover:border-accent-300'"
                  @click="pickPoiCategory(c)"
                >{{ c.emoji }} {{ c.label }}</button>
              </div>
              <div v-if="poiLoading" class="p-3 text-center text-xs text-ink-500">搜索中…</div>
              <div
                v-else-if="!poiResults.length"
                class="p-3 text-center text-xs text-ink-500"
              >无结果</div>
              <div
                v-for="p in poiResults"
                :key="`${p.lng}-${p.lat}-${p.name}`"
                class="px-3 py-2 border-b border-border-subtle last:border-0"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="text-body-sm text-ink-900 truncate">{{ p.name }}</div>
                    <div class="text-xs text-ink-500 truncate">{{ p.address }}</div>
                  </div>
                  <div class="shrink-0 flex items-center gap-1">
                    <el-button size="small" plain @click="flyToPoi(p)">定位</el-button>
                    <el-button size="small" type="primary" plain @click="addPoiAsPoint(p)">加点</el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分享 + 统计 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="p-3 rounded-2xl bg-white">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-body-sm font-medium text-ink-900">分享到地图广场</div>
              <p class="text-xs text-ink-500 mt-0.5">开启后任何人都能通过链接查看</p>
            </div>
            <el-switch
              :model-value="isPublic"
              :disabled="!isLoggedIn || saving"
              @update:model-value="toggleShare"
            />
          </div>
          <div v-if="isPublic && shareUrl" class="mt-2 flex items-center gap-2">
            <el-input :model-value="shareUrl" readonly size="small" />
            <el-button size="small" @click="copyShareUrl">复制</el-button>
          </div>
        </div>

        <div class="p-3 rounded-2xl bg-white grid grid-cols-3 gap-2 text-center">
          <div class="p-2 rounded-xl bg-gray-50">
            <div class="text-lg font-semibold text-ink-900">{{ points.length }}</div>
            <div class="text-xs text-ink-500">点位</div>
          </div>
          <div class="p-2 rounded-xl bg-gray-50">
            <div class="text-lg font-semibold text-ink-900">{{ routes.length }}</div>
            <div class="text-xs text-ink-500">路线</div>
          </div>
          <div class="p-2 rounded-xl bg-gray-50">
            <div class="text-lg font-semibold text-ink-900">{{ formatDistance(totalDistance) }}</div>
            <div class="text-xs text-ink-500">总里程</div>
          </div>
        </div>
      </div>

      <!-- 点位 + 路线 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <!-- 点位 -->
        <div class="p-3 rounded-2xl bg-white">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-body-sm font-semibold text-ink-900">点位</h3>
            <el-select v-model="categoryFilter" size="small" style="width: 128px">
              <el-option value="all" label="全部分类" />
              <el-option
                v-for="c in POINT_CATEGORIES"
                :key="c.value"
                :value="c.value"
                :label="`${c.emoji} ${c.label}`"
              />
            </el-select>
          </div>

          <p v-if="!filteredPoints.length" class="py-6 text-center text-xs text-ink-500">
            {{ points.length ? '该分类下暂无点位' : '点「标点」后在地图上点击即可添加' }}
          </p>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            <div
              v-for="p in filteredPoints"
              :key="p.id"
              class="p-2 rounded-lg border border-border-subtle hover:border-accent-300 transition-colors"
            >
              <div class="flex items-center gap-2">
                <span>{{ getCategory(p.category).emoji }}</span>
                <span class="flex-1 min-w-0 truncate text-body-sm text-ink-900">{{ p.name }}</span>
                <span class="shrink-0 text-xs text-ink-500">{{ formatElevation(p.elevation) }}</span>
              </div>
              <p v-if="p.note" class="mt-0.5 text-xs text-ink-500 line-clamp-2">{{ p.note }}</p>
              <div class="mt-1 flex gap-2">
                <button class="text-xs text-accent-600 hover:underline" @click="locatePoint(p)">定位</button>
                <button class="text-xs text-accent-600 hover:underline" @click="handlePointClick(p.id)">编辑</button>
                <button class="text-xs text-red-600 hover:underline" @click="handlePointDelete(p.id)">删除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 路线 -->
        <div class="p-3 rounded-2xl bg-white">
          <h3 class="text-body-sm font-semibold text-ink-900 mb-2">路线</h3>
          <p v-if="!routes.length" class="py-6 text-center text-xs text-ink-500">
            点「画直线」后在地图上依次点击节点
          </p>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            <div
              v-for="r in routes"
              :key="r.id"
              :ref="el => setRouteCardRef(r.id, el as HTMLElement | null)"
              class="p-2 rounded-lg border cursor-pointer transition-colors"
              :class="selectedRouteId === r.id
                ? 'border-accent-400 bg-accent-50/60 ring-1 ring-accent-300'
                : 'border-border-subtle hover:border-accent-300'"
              @click="handleRouteClick(r.id)"
            >
              <div class="flex items-center gap-2">
                <button
                  class="w-3.5 h-3.5 rounded-full shrink-0 border border-white shadow"
                  :style="{ backgroundColor: r.color }"
                  title="点击换颜色"
                  @click="cycleRouteColor(r)"
                ></button>
                <el-input v-model="r.name" size="small" maxlength="60" class="flex-1" />
                <!-- 路线类型徽标：直线路线 vs 道路路线，让用户一眼分清。
                     道路路线用蓝色填充 + 🚶 图标，直线路线用浅灰边框 + 📏 图标，
                     颜色对比够明显但不抢眼。 -->
                <span
                  v-if="r.kind === 'road'"
                  class="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-medium leading-tight"
                  title="沿 OSRM 道路画的路线"
                >🚶 道路</span>
                <span
                  v-else
                  class="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-ink-500 text-[10px] font-medium leading-tight"
                  title="用户在地图上手点的直线路线"
                >📏 直线</span>
                <button
                  class="shrink-0 text-body-sm text-accent-600 hover:text-accent-700 hover:underline"
                  title="定位到这条路线"
                  @click="locateRoute(r)"
                >📍 定位</button>
              </div>
              <div class="mt-1 flex items-center justify-between text-xs text-ink-500">
                <span class="flex items-center gap-1.5 flex-wrap">
                  <span>{{ r.path.length }} 节点 · {{ formatDistance(r.distance) }}</span>
                  <!-- 急弯数：只有沿道路路线（OSRM 算出来的）才有意义，
                       直线路线节点少算出来不靠谱，直接不显示。 -->
                  <span
                    v-if="r.kind === 'road'"
                    class="inline-flex items-center gap-0.5 px-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700"
                    :title="`累积转向角 ≥ ${SHARP_TURN_DEFAULTS.thresholdDeg}° 的急弯数（${SHARP_TURN_DEFAULTS.windowMeters}m 窗口 + ${SHARP_TURN_DEFAULTS.cooldownMeters}m 冷却）`"
                  >↩️ 急弯 {{ getSharpTurns(r.id) }}</span>
                </span>
                <button class="text-red-600 hover:underline" @click="deleteRoute(r.id)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 地图（满宽 100%） -->
      <div class="w-full h-[420px] sm:h-[560px] lg:h-[640px] rounded-2xl overflow-hidden border border-border-subtle">
        <TiandituMap
          ref="mapRef"
          :points="points"
          :routes="routes"
          :center="center"
          :zoom="zoom"
          :base-layer="baseLayer"
          :mode="mode"
          :draft-path="draftPath"
          :draft-color="draftColor"
          :selected-point-id="selectedPointId"
          :selected-route-id="selectedRouteId"
          @map-click="handleMapClick"
          @map-blank-click="handleMapBlankClick"
          @point-click="handlePointClick"
          @route-click="handleRouteClick"
          @route-osrm-point="handleOsrmRouteFromPoint"
          @view-change="handleViewChange"
        />
      </div>
    </div>

    <ToolDetail title="使用说明">
      <div class="space-y-3 text-body-sm text-ink-800">
        <p><strong>标点：</strong>点击工具条的「标点」，然后在地图上点击想标注的位置，填写名称、分类（露营地 / 商店超市 / 水源 / 观景点等）、海拔和备注。</p>
        <p><strong>海拔：</strong>天地图官方没有提供「经纬度查海拔」的接口，因此海拔需要手动填写，可参考户外 App 或地形图等高线。把底图切到「地形」可以直观看到山势起伏。</p>
        <p><strong>画直线：</strong>点击「画直线」后在地图上依次点击各个节点，系统会实时显示累计里程；点「结束绘制」保存这条路线。节点之间是直线段，不依赖路网，适合徒步、越野和自驾的概略规划。</p>
        <p><strong>多张地图：</strong>登录后可以在「我的地图」里创建、切换和删除多张地图，每次出行一张互不干扰。</p>
        <p><strong>分享：</strong>打开「分享到地图广场」开关后会生成公开链接，任何人无需登录都能查看；同时这张地图会出现在「地图广场」。关掉开关后链接立即失效，广场里也不再显示。</p>
        <p class="text-ink-500">上限：单张地图最多 {{ LIMITS.points }} 个点位、{{ LIMITS.routes }} 条路线，单条路线最多 {{ LIMITS.routeNodes }} 个节点。</p>
      </div>
    </ToolDetail>

    <PointEditDialog
      v-model="pointDialogVisible"
      :point="editingPoint"
      :lng="pendingLng"
      :lat="pendingLat"
      @submit="handlePointSubmit"
      @delete="handlePointDelete"
    />

    <MyMapsDrawer
      v-model="drawerVisible"
      :current-id="mapId"
      @open="openMap"
      @deleted="(id) => {
        const uid = userStore.getUserInfo?.uid
        if (uid) clearLastMapId(uid)
        if (id === mapId) bootstrap()
      }"
    />
  </div>
</template>

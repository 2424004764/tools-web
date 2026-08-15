<script setup lang="ts">
/**
 * 天地图容器 —— 编辑器 / 分享页 共用。
 *
 * 职责边界：本组件只负责「把 points / routes 画到天地图上」以及「把用户在地图上的
 * 操作抛成事件」，不持有业务数据。所有增删改都由父组件改 props 后触发重绘。
 */
import { ref, shallowRef, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { loadTianditu, hasTiandituKey } from '@/utils/tianditu'
import { getCategory, DEFAULT_CENTER, DEFAULT_ZOOM, haversine, formatDistance, pathDistance, simplifyPath, detectSharpTurns } from './constants'
import type { MapPoint, MapRoute, BaseLayer, LngLat } from './types'

const props = withDefaults(defineProps<{
  points: MapPoint[]
  routes: MapRoute[]
  center?: LngLat
  zoom?: number
  baseLayer?: BaseLayer
  /** 'browse' 浏览 | 'point' 点击打点 | 'route' 连续点击画线（直线）
   *  | 'route-osrm' 连点已有点位 + 沿道路画线 */
  mode?: 'browse' | 'point' | 'route' | 'route-osrm'
  /** 画线过程中的临时节点（由父组件维护，实时预览） */
  draftPath?: [number, number][]
  /** draft 路径颜色，route-osrm 模式下根据 profile 给不同色 */
  draftColor?: string
  /** 只读模式下不响应任何点击建点 */
  readonly?: boolean
  /** 当前正在参与路线绘制的点位 id（沿道路画路线模式下被点中的点位高亮） */
  selectedPointId?: string | null
  /** 当前选中的路线 id（地图上点中路线 → 路线列表选中该项） */
  selectedRouteId?: string | null
}>(), {
  center: () => ({ ...DEFAULT_CENTER }),
  zoom: DEFAULT_ZOOM,
  baseLayer: 'vec',
  mode: 'browse',
  draftPath: () => [],
  readonly: false,
  selectedPointId: null,
  selectedRouteId: null,
})

const emit = defineEmits<{
  (e: 'map-click', lnglat: { lng: number; lat: number }): void
  (e: 'map-blank-click'): void
  (e: 'point-click', pointId: string): void
  (e: 'route-click', routeId: string): void
  (e: 'route-osrm-point', payload: { id: string; lng: number; lat: number }): void
  (e: 'view-change', payload: { center: LngLat; zoom: number }): void
  (e: 'ready'): void
}>()

const mapEl = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const missingKey = ref(!hasTiandituKey())

// 天地图实例与覆盖物用 shallowRef：它们是庞大的第三方对象，
// 不能被 Vue 深度代理，否则内部状态会错乱且性能极差。
const mapInstance = shallowRef<any>(null)
const T = shallowRef<any>(null)
const pointOverlays = shallowRef<any[]>([])
const routeOverlays = shallowRef<any[]>([])
const draftOverlays = shallowRef<any[]>([])
// 急弯高亮：单独存一份 ref,跟主路线一起被 routes 变化驱动重画，
// 独立 ref 是为了让 unmount/clear 时一次清掉（不混入主路线数组）。
const sharpTurnOverlays = shallowRef<any[]>([])

// 急弯高亮配色：在任意底图/路线颜色上都跳出来。
// 之前用 halo(11px 描边) + main(7px 实色) 两层 polyline 叠出来 —— 视觉更精细,
// 但覆盖物数翻倍,缩放/平移时天地图要重绘的对象多一倍,在 polyline 总量大
// (多条路线 + 每条路几十个急弯) 的情况下会肉眼可见地掉帧。改成单根粗 polyline,
// 视觉损失有限 (描边与主线之间那点光晕),覆盖物数砍半。
const SHARP_TURN_HIGHLIGHT = {
  color: '#dc2626', // 红
  weight: 9,        // 比主线 4px 粗一倍多,远看一眼能看到
  opacity: 1.0,
}
// 缓存当前视野边界，POI 搜索用到。坐标系是 WGS-84（天地图用此坐标系）。
const currentBounds = shallowRef<{ minLng: number; minLat: number; maxLng: number; maxLat: number } | null>(null)

const cursorClass = computed(() =>
  !props.readonly && (props.mode === 'point' || props.mode === 'route' || props.mode === 'route-osrm')
    ? 'travel-map--crosshair'
    : ''
)

// 拖动 / 缩放过程中的 view-change 去抖 timer，需要在 unmount 时清掉
let syncTimer: ReturnType<typeof setTimeout> | null = null

// 地图交互进行中（缩放 / 平移）—— 给容器加 .travel-map--animating 类，
// CSS 隐藏所有 T.Label。SDK 在 zoomend/moveend 重投影 Label 时 DOM 会跳,
// 这就是用户感觉"路线跐跐跐跳"的主要来源。Label 是唯一受影响的 —— Polyline
// (SVG) 天地图自己处理得很好,不需要隐藏。
const isAnimating = ref(false)
let animTimer: ReturnType<typeof setTimeout> | null = null

// ---------- 底图 ----------

function applyBaseLayer(layer: BaseLayer) {
  const map = mapInstance.value
  const t = T.value
  if (!map || !t) return
  const typeMap: Record<BaseLayer, string> = {
    vec: 'TMAP_NORMAL_MAP',
    img: 'TMAP_HYBRID_MAP',
    ter: 'TMAP_TERRAIN_HYBRID_MAP',
  }
  // 地图类型常量挂在全局（window.TMAP_NORMAL_MAP 等），SDK 版本差异时兜底为矢量图
  const constant = (window as any)[typeMap[layer]] ?? (window as any).TMAP_NORMAL_MAP
  if (constant !== undefined) map.setMapType(constant)
}

// ---------- 覆盖物绘制 ----------

function clearOverlays(store: { value: any[] }) {
  const map = mapInstance.value
  if (!map) return
  store.value.forEach((o) => {
    try {
      map.removeOverLay(o)
    } catch {
      // 覆盖物可能已随地图销毁，忽略
    }
  })
  store.value = []
}

// ---------- 绘制调度（去重 + rAF） ----------
//
// 三个 watch 都会触发重画：points/routes/draftPath。一次拖动 / 一次 dialog 提交
// 会同时改多个字段（points 引用变了 + 字段也变了），同帧内多次触发 deep watch
// 会导致 drawPoints 被连续调两次，把 200 个 marker 反复 clearOverLay + 重建。
// 这里用一个 rafToken 把同帧内的多次调用合并成一次。

let drawPointsRaf = 0
let drawRoutesRaf = 0
let drawDraftRaf = 0

function scheduleDrawPoints() {
  if (drawPointsRaf) return
  drawPointsRaf = requestAnimationFrame(() => {
    drawPointsRaf = 0
    drawPoints()
  })
}
function scheduleDrawRoutes() {
  if (drawRoutesRaf) return
  drawRoutesRaf = requestAnimationFrame(() => {
    drawRoutesRaf = 0
    drawRoutes()
  })
}
function scheduleDrawDraft() {
  if (drawDraftRaf) return
  drawDraftRaf = requestAnimationFrame(() => {
    drawDraftRaf = 0
    drawDraft()
  })
}

function drawPoints() {
  const map = mapInstance.value
  const t = T.value
  if (!map || !t) return

  clearOverlays(pointOverlays)
  const created: any[] = []

  props.points.forEach((p) => {
    // 单个点位画失败不能连累其余点位，更不能让整张地图停在半成品状态
    try {
      const cate = getCategory(p.category)
      const lnglat = new t.LngLat(p.lng, p.lat)
      // 选中态：沿道路画路线时被点中的点位用橙色边框 + 外发光强调。
      // 只在「沿道路画路线」模式下生效（route-osrm），其他模式
      // 不会传 selectedPointId，行为不变。
      const isSelected = props.selectedPointId === p.id
      const headStyle = isSelected
        ? `padding:3px 7px;border-radius:14px;background:#fff;border:3px solid #f59e0b;font-size:13px;line-height:1.2;box-shadow:0 0 0 3px rgba(245,158,11,0.28),0 1px 4px rgba(15,23,42,0.18);white-space:nowrap;`
        : `padding:3px 7px;border-radius:14px;background:#fff;border:2px solid ${cate.color};font-size:13px;line-height:1.2;box-shadow:0 1px 4px rgba(15,23,42,0.18);white-space:nowrap;`

      // 不再用默认 marker —— 它只有几像素基本点不中；t.Icon 自定义图标在 SDK
      // 4.0 上会炸（null.classList）。label 顶替图标的"视觉"和"命中区"两种角色：
      //   - 视觉：emoji + 分类色边框 = 一个清晰的点位图标
      //   - 命中区：整个 label div 都是命中区，点中 emoji / 名称 / 海拔 / 备注
      //     任意位置都能被 closest('[data-point-id]') 抓到
      //
      // 用一个圆形 + emoji 充当"点位图标"，下面挂一个信息气泡（名称 + 海拔 + 备注）。
      // 整体结构紧凑，点中任何位置都触发点位命中。
      const elevPart = p.elevation !== null && p.elevation !== undefined
        ? `<span style="color:#64748b;font-weight:500;font-size:11px;margin-left:2px;">· ${Math.round(p.elevation)}m</span>`
        : ''
      const notePart = p.note
        ? `<div style="margin-top:2px;color:#64748b;font-size:11px;line-height:1.35;word-break:break-all;">${escapeHtml(p.note)}</div>`
        : ''
      const label = new t.Label({
        text: `<div class="tt-point-label${isSelected ? ' tt-point-label--selected' : ''}" data-point-id="${escapeHtml(p.id)}" style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:3px;cursor:pointer;">
            <div style="display:flex;align-items:center;gap:4px;${headStyle}">
              <span style="font-size:14px;">${cate.emoji}</span>
              <span style="color:#0f172a;font-weight:600;">${escapeHtml(p.name)}</span>
              ${elevPart}
            </div>
            ${notePart ? `<div style="padding:4px 8px;border-radius:6px;background:#fff;border:1px solid ${cate.color};font-size:11px;line-height:1.35;max-width:220px;box-shadow:0 1px 4px rgba(15,23,42,0.08);word-break:break-all;">${notePart.replace(/^<div[^>]*>|<\/div>$/g, '')}</div>` : ''}
          </div>`,
        position: lnglat,
        // 把 label 锚点设在 div 左上角（默认居中），让它"图钉一样"从点位向外延伸
        offset: new t.Point(-6, isSelected ? -30 : -28),
      })
      map.addOverLay(label)
      created.push(label)
      // 注意：marker 自带图标只有几像素，几乎点不中，
      // 不要在 marker 上绑 click / 自定义 Icon —— 天地图 4.0 的 onAdd 路径在
      // 自定义 Icon 上会抛 "Cannot read properties of null (reading 'classList')"
    } catch (error) {
      console.error('绘制点位失败:', p.name, error)
    }
  })

  pointOverlays.value = created
}

function drawRoutes() {
  const map = mapInstance.value
  const t = T.value
  if (!map || !t) return

  clearOverlays(routeOverlays)
  clearOverlays(sharpTurnOverlays)
  const created: any[] = []
  const sharpCreated: any[] = []

  props.routes.forEach((r) => {
    if (!r.path || r.path.length < 2) return
    // 和 drawDraft 保持一致的视觉策略：一条干净的线 + 一个总距离标签。
    // OSRM 路线就算入站时已经 30m 抽稀，8m 容差再二次简化还是会让 polyline
    // 看起来"密密麻麻"——拐点全保留，远看一堆小段。150m 容差只保留主拐点，
    // 视觉上仍是一条平滑曲线，但节点数比 100m 再少 30~40%，缩放/平移时天地图
    // 重绘开销明显降低。急弯高亮用 30m 单独抽稀切片,150m 容差不影响那段精度。
    const simplified = simplifyPath(r.path as [number, number][], 150)
    // 选中态：线变粗 + 完全不透明 + 略微饱和，作为「当前选中的路线」的视觉强调。
    // 未选中保持原样。
    const isSelected = props.selectedRouteId === r.id
    const line = new t.Polyline(
      simplified.map(([lng, lat]) => new t.LngLat(lng, lat)),
      {
        color: r.color,
        weight: isSelected ? 6 : 4,
        opacity: isSelected ? 1.0 : 0.85,
      }
    )
    // T.Polyline 支持原生 click 事件 —— 用户点中线身（不只是距离标签）就触发。
    // emit route-click 由父组件决定怎么联动（路线列表选中 + 自动滚到可见区）。
    line.addEventListener('click', () => {
      emit('route-click', r.id)
    })
    map.addOverLay(line)
    created.push(line)

    // 急弯高亮：只对沿道路路线画,直线路线节点稀疏、统计意义不大。
    // 单根粗 polyline —— 之前 halo+main 两层在覆盖物多时会显著拖慢缩放/平移,
    // 砍掉 halo 后视觉损失不大(就少了一圈模糊描边),缩放/平移帧率明显回升。
    // 急弯 span 切片后再用 simplifyPath(30m) 二次抽稀 —— span 段通常 100~150m,
    // 原始 OSRM 节点在这段里可能有 30~50 个,9px 粗线上根本看不出 30 个和 8 个
    // 节点的区别,但 SVG path 节点数砍 70%,缩放/平移时天地图重绘开销降一档。
    if (r.kind === 'road') {
      const spans = detectSharpTurns(r.path)
      for (const span of spans) {
        if (span.endIdx <= span.startIdx) continue
        const slice = simplifyPath(
          r.path.slice(span.startIdx, span.endIdx + 1) as [number, number][],
          30
        )
        if (slice.length < 2) continue
        const slicePts = slice.map(([lng, lat]) => new t.LngLat(lng, lat))
        const main = new t.Polyline(slicePts, {
          color: SHARP_TURN_HIGHLIGHT.color,
          weight: SHARP_TURN_HIGHLIGHT.weight,
          opacity: SHARP_TURN_HIGHLIGHT.opacity,
          lineJoin: 'round',
          lineCap: 'round',
        })
        // 点中急弯高亮也触发选中对应路线 —— 用户能放大查看
        main.addEventListener('click', () => {
          emit('route-click', r.id)
        })
        map.addOverLay(main)
        sharpCreated.push(main)
      }
    }

    // 每条路线只画一个总距离标签，位置在距起点半程的点（按累计距离插值）。
    // 用户视角：「一条路多长」就够了，不需要每 200/500m 看一次"已走 X 米"。
    // 距离直接用 r.distance（保存时已用 osrmSegmentDistances 累加或 pathDistance 算出），
    // 不重新用 pathDistance 算 —— 避免抽稀后再算 haversine 累加产生误差。
    const totalDist = r.distance
    if (!Number.isFinite(totalDist) || totalDist <= 0) return
    const halfDist = totalDist / 2
    let labelPos: [number, number] = r.path[0]
    let accum = 0
    for (let i = 1; i < r.path.length; i++) {
      const [lng1, lat1] = r.path[i - 1]
      const [lng2, lat2] = r.path[i]
      const segDist = haversine(lng1, lat1, lng2, lat2)
      if (accum + segDist >= halfDist) {
        const tk = (halfDist - accum) / segDist
        labelPos = [
          lng1 + (lng2 - lng1) * tk,
          lat1 + (lat2 - lat1) * tk,
        ]
        break
      }
      accum += segDist
    }
    // 选中态：距离标签稍微放大 + 更强的阴影，让"选中"的路线在视觉上更跳。
    const labelBg = isSelected
      ? `padding:2px 8px;border-radius:12px;background:${r.color};color:#fff;font-size:12px;font-weight:700;line-height:1.4;box-shadow:0 2px 6px rgba(15,23,42,0.28);pointer-events:none;white-space:nowrap;`
      : `padding:1px 6px;border-radius:10px;background:${r.color};color:#fff;font-size:11px;font-weight:600;line-height:1.4;box-shadow:0 1px 2px rgba(15,23,42,0.18);pointer-events:none;white-space:nowrap;`
    const totalLabel = new t.Label({
      text: `<div class="tt-seg-label${isSelected ? ' tt-seg-label--selected' : ''}" style="${labelBg}">
          ${escapeHtml(formatDistance(totalDist))}
        </div>`,
      position: new t.LngLat(labelPos[0], labelPos[1]),
      offset: new t.Point(0, -10),
    })
    // 距离标签也支持点中 → 选中对应路线（让用户点"距离数字"也能选中，
    // 不用瞄准细线身）。label 上的 div 会被 closest 抓到（见下面的命中逻辑）。
    totalLabel.addEventListener?.('click', () => {
      emit('route-click', r.id)
    })
    map.addOverLay(totalLabel)
    created.push(totalLabel)
  })

  routeOverlays.value = created
  sharpTurnOverlays.value = sharpCreated
}

function drawDraft() {
  const map = mapInstance.value
  const t = T.value
  if (!map || !t) return

  clearOverlays(draftOverlays)
  const path = props.draftPath
  if (!path.length) return

  // 用户视角：「沿道路画路线」就是两个点位之间一条干净的路。
  // OSRM 真实返回几百个节点表达道路曲率，但视觉上太"密密麻麻"——
  // 8m 容差虽然抽稀了，polyline 拐点还是太多，远看像一堆小段堆在一起。
  // 改用 150m 容差 → 几个主要拐点保留，polyline 视觉上几乎是一条平滑曲线。
  // 注意：抽稀只影响视觉显示，pathDistance 计算用的是原始 path，距离仍然准确。
  const simplified = simplifyPath(path, 150)

  const created: any[] = []
  const lnglats = simplified.map(([lng, lat]) => new t.LngLat(lng, lat))
  // draft 颜色由父组件传入（route-osrm 模式按 profile 给色，否则默认红色）
  const draftColor = props.draftColor || '#dc2626'

  if (lnglats.length >= 2) {
    const line = new t.Polyline(lnglats, {
      color: draftColor, weight: 4, opacity: 0.9,
    })
    map.addOverLay(line)
    created.push(line)
  }
  // 不画节点小圆 —— 几百个 Circle 会挤爆渲染。

  // 只画一个总距离标签：用户不需要每 200/500m 看一次"已走 X 米"，
  // 一条路总长就够了。位置取"距起点半程"的点（按累计距离插值），
  // 而不是数组索引中点 —— 后者在「长直路 + 短弯路」时会偏到短边，
  // 视觉上不在路的中段。
  if (path.length >= 2) {
    const totalDist = pathDistance(path)
    const halfDist = totalDist / 2
    let labelPos: [number, number] = path[0]
    let accum = 0
    for (let i = 1; i < path.length; i++) {
      const [lng1, lat1] = path[i - 1]
      const [lng2, lat2] = path[i]
      const segDist = haversine(lng1, lat1, lng2, lat2)
      if (accum + segDist >= halfDist) {
        const t2 = (halfDist - accum) / segDist
        labelPos = [
          lng1 + (lng2 - lng1) * t2,
          lat1 + (lat2 - lat1) * t2,
        ]
        break
      }
      accum += segDist
    }
    const totalLabel = new t.Label({
      text: `<div class="tt-seg-label" style="padding:1px 6px;border-radius:10px;background:${draftColor};color:#fff;font-size:11px;font-weight:600;line-height:1.4;box-shadow:0 1px 2px rgba(15,23,42,0.18);pointer-events:none;white-space:nowrap;">
          ${escapeHtml(formatDistance(totalDist))}
        </div>`,
      position: new t.LngLat(labelPos[0], labelPos[1]),
      offset: new t.Point(0, -10),
    })
    map.addOverLay(totalLabel)
    created.push(totalLabel)
  }

  draftOverlays.value = created
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

// ---------- hit layer 命中反查 ----------
//
// 自管 DOM 命中层上的点击事件。从事件坐标反查最近点位：
//   1. 点击坐标是 hit layer 内的 offsetX/offsetY
//   2. 用 map.layerPointToLngLat 转成经纬度（layerPoint 是相对地图内部坐标系的）
//   3. 用 haversine 算每个点位到点击点的距离，取阈值内最近的
//
// 实际实现已经改成"读 label 上的 data-point-id"——见 drawPoints 里给 label
// 内层 div 加 data-point-id。这里保留一段注释说明为什么不用 marker 自带 click：
//   - 天地图 4.0 的 T.Icon 自定义 html 在 onAdd 路径上会抛 null 错
//   - 默认 marker 图标只有几像素，几乎点不中
//   - map.click 在覆盖物（marker / label）上不触发

// document 全局 click：判断落点是否在地图容器内，是就做点位命中反查。
// 用 capture 阶段拿事件，能在 SDK 内部 listener 之前 / 之后任意介入。
// 关键点：mousedown 不拦（避免破坏地图拖动），只拦 click —— click 是 mousedown
// + mouseup 同一坐标的产物，拖动不会产生 click。
function onGlobalClickForHit(ev: MouseEvent) {
  const mapElVal = mapEl.value
  if (!mapElVal) return
  // 只在「需要点中点位」的模式里处理
  if (
    props.mode !== 'route-osrm' &&
    props.mode !== 'browse' &&
    !props.readonly
  ) return

  // 直接从事件 target 上读 data-point-id —— 我们在每个点位 label 的内层 div
  // 上加了 data-point-id="<id>"，命中点位时用户点中 label 任意位置都能拿到。
  // 这是最可靠的方式：不依赖 SDK 投影方法、不依赖 contains / 矩形判断。
  const target = ev.target as HTMLElement | null
  const labelEl = target?.closest('[data-point-id]') as HTMLElement | null
  if (!labelEl) return
  const pointId = labelEl.dataset.pointId
  if (!pointId) return
  const hit = props.points.find((p) => p.id === pointId)
  if (!hit) return

  if (props.mode === 'route-osrm') {
    emit('route-osrm-point', { id: hit.id, lng: hit.lng, lat: hit.lat })
    return
  }
  // browse / readonly 都走打开 / 定位
  emit('point-click', hit.id)
}

// ---------- 容器尺寸变化 ----------
//
// 天地图不会自己感知容器尺寸变化，宽高一变而不通知它，瓦片就会错位/变灰。
// 触发场景比想象中多：el-dialog / el-drawer 打开时会锁 body 滚动并补一段
// padding-right，页面宽度瞬间变化；侧栏点位列表变长、窗口缩放、专注模式切换同理。
// 所以这里用 ResizeObserver 盯住容器，任何尺寸变化都补一次 checkResize()。

let resizeObserver: ResizeObserver | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

function checkResizeNow() {
  const map = mapInstance.value
  if (!map) return
  try {
    // checkResize 是天地图 4.0 的官方方法；做个存在性判断以防版本差异
    map.checkResize?.()
  } catch {
    // 地图可能正在销毁，忽略
  }
}

function scheduleCheckResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  // 合并连续的尺寸变化（弹窗打开时会连着触发好几次）
  resizeTimer = setTimeout(checkResizeNow, 80)
}

/** 供父组件在已知会引起布局变化的时机主动调用 */
function refreshSize() {
  scheduleCheckResize()
}

// ---------- 初始化 ----------

async function initMap() {
  if (!mapEl.value) return
  if (missingKey.value) {
    loading.value = false
    return
  }

  try {
    const t = await loadTianditu()
    T.value = t

    const map = new t.Map(mapEl.value, { minZoom: 3, maxZoom: 18 })
    map.centerAndZoom(new t.LngLat(props.center.lng, props.center.lat), props.zoom)
    map.enableScrollWheelZoom()
    map.addControl(new t.Control.Zoom())
    map.addControl(new t.Control.Scale())
    mapInstance.value = map

    applyBaseLayer(props.baseLayer)

    map.addEventListener('click', (e: any) => {
      const ll = e.lnglat
      if (!ll) return
      const lng = ll.getLng()
      const lat = ll.getLat()

      // 注意：marker 是地图覆盖物，点中 marker 时只会触发 marker 自带的 click，
      // 不会冒泡到 map.click。点空白处才会触发这里。
      // 各模式的分工：
      //   - point：点空白处建点位（emit map-click）
      //   - route：点空白处加节点（emit map-click，父组件 handleMapClick 处理）
      //   - route-osrm：点空白处忽略（沿道路画路线只能点中点位）
      //   - browse / readonly：点空白处什么都不做（编辑/定位由 hit layer 走 point-click）
      //   - 但 browse 模式下若当前有选中的路线，也允许点空白处取消选中 →
      //     emit map-blank-click 由父组件去清 selectedRouteId
      if (props.mode === 'point' || props.mode === 'route') {
        emit('map-click', { lng, lat })
      } else if (props.mode === 'browse' && props.selectedRouteId) {
        emit('map-blank-click')
      }
    })

    // 拖动 / 缩放过程中 moveend 会被连续 emit 多次（天地图不带节流），每一次都会
    // 触发父组件 reactive center/zoom 写值、props 重传、子组件 watch 检查。点位多了
    // 的时候这套链路会让拖动明显卡顿。这里统一收口到「动画 idle 后」再触发一次。
    const syncView = () => {
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(() => {
        const c = map.getCenter()
        emit('view-change', {
          center: { lng: c.getLng(), lat: c.getLat() },
          zoom: map.getZoom(),
        })
        // 缓存视野边界
        try {
          const b = map.getBounds?.()
          if (b) {
            const sw = b.getSouthWest()
            const ne = b.getNorthEast()
            currentBounds.value = {
              minLng: sw.getLng(), minLat: sw.getLat(),
              maxLng: ne.getLng(), maxLat: ne.getLat(),
            }
          }
        } catch {
          // 旧版本 SDK 不支持 getBounds，忽略
        }
      }, 120)
    }
    map.addEventListener('moveend', syncView)
    map.addEventListener('zoomend', syncView)

    // 动画期间隐藏 Label —— 在 start 设 true,end 设 false。
    // 不监听 move/zoom 中间态:中间态设的话还没进入缩放就会闪一帧。
    // 设置 80ms 缓冲:zoomend 后 80ms 再恢复,让 SDK 的重投影彻底完成,
    // 否则用户会看到"路线出现一瞬间 → 跐跐跐一下 → 稳定"。
    const startAnim = () => {
      if (animTimer) clearTimeout(animTimer)
      animTimer = null
      isAnimating.value = true
    }
    const endAnim = () => {
      if (animTimer) clearTimeout(animTimer)
      animTimer = setTimeout(() => {
        isAnimating.value = false
        animTimer = null
      }, 80)
    }
    map.addEventListener('movestart', startAnim)
    map.addEventListener('zoomstart', startAnim)
    map.addEventListener('moveend', endAnim)
    map.addEventListener('zoomend', endAnim)

    drawRoutes()
    drawPoints()
    drawDraft()

    // 容器尺寸一变就补 checkResize，防止弹窗/抽屉引起的布局位移把地图搞灰
    if (typeof ResizeObserver !== 'undefined' && mapEl.value) {
      resizeObserver = new ResizeObserver(scheduleCheckResize)
      resizeObserver.observe(mapEl.value)
    }
    window.addEventListener('resize', scheduleCheckResize)

    // 全局 click 监听 —— 反查点位命中。
    // 为什么不在 hit layer 上挂 click：之前的方案是 hit layer 设 pointer-events:auto
    // 拦所有 click，但这样会顺带拦掉地图的 mousedown / mousemove / wheel，导致
    // 画完路线后地图无法拖动、缩放。改成在 document 上监听 click，通过判断事件
    // 目标是否落在地图区域内来决定是否做命中反查：
    //   - 点中 marker（覆盖物）→ map.click 不会触发，但我们的全局 click 会拿到事件
    //   - 点空白处 → map.click 也会触发，但 mode 是 browse / readonly 时不需要建点位，
    //     所以 map.click 不 emit，全局 click 反查命中即可
    document.addEventListener('click', onGlobalClickForHit, true)

    loading.value = false
    emit('ready')
  } catch (error: any) {
    errorMsg.value = error?.message || '地图加载失败'
    loading.value = false
  }
}

onMounted(initMap)

onBeforeUnmount(() => {
  if (resizeTimer) clearTimeout(resizeTimer)
  if (syncTimer) clearTimeout(syncTimer)
  if (animTimer) clearTimeout(animTimer)
  if (drawPointsRaf) cancelAnimationFrame(drawPointsRaf)
  if (drawRoutesRaf) cancelAnimationFrame(drawRoutesRaf)
  if (drawDraftRaf) cancelAnimationFrame(drawDraftRaf)
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', scheduleCheckResize)
  document.removeEventListener('click', onGlobalClickForHit, true)
  clearOverlays(pointOverlays)
  clearOverlays(routeOverlays)
  clearOverlays(sharpTurnOverlays)
  clearOverlays(draftOverlays)
  mapInstance.value = null
})

// props 变化 → 重绘。schedule* 把同帧内的多次触发合并成一次 draw，
// 避免点位 + 字段同时改时反复 clearOverLay + 重建所有覆盖物。
watch(() => props.points, scheduleDrawPoints, { deep: true })
watch(() => props.routes, scheduleDrawRoutes, { deep: true })
watch(() => props.draftPath, scheduleDrawDraft, { deep: true })
watch(() => props.baseLayer, (v) => applyBaseLayer(v))
// 选中点位 id 变化 → 只换边框样式，但仍要走完整重画（label 内容随选择变化）。
watch(() => props.selectedPointId, () => scheduleDrawPoints())
// 选中路线 id 变化 → 重画路线（粗细/不透明度/距离标签样式都要换）。
watch(() => props.selectedRouteId, () => scheduleDrawRoutes())

// 中心/缩放变化 → 跳过去。
// onMounted 里 centerAndZoom 用了 props.center 的初值，但 props.center 之后再变（比如
// openMap 加载了一张新地图，父组件把 center 换成新地图的 center）组件不会自动感知，
// 必须显式 watch。这一点对"打开某张地图"很关键：默认初始化在北京。
watch(
  [() => props.center?.lng, () => props.center?.lat, () => props.zoom],
  ([lng, lat, z], [oldLng, oldLat, oldZ]) => {
    if (!mapInstance.value) return
    if (lng === oldLng && lat === oldLat && z === oldZ) return
    const T = (window as any).T
    if (!T) return
    mapInstance.value.centerAndZoom(new T.LngLat(lng, lat), z)
  }
)

/** 供父组件调用：把视野移到指定坐标 */
function panTo(lng: number, lat: number, zoom?: number) {
  const map = mapInstance.value
  const t = T.value
  if (!map || !t) return
  map.centerAndZoom(new t.LngLat(lng, lat), zoom ?? map.getZoom())
}

/** 供父组件调用：缩放到能看全所有点位与路线 */
function fitAll() {
  const map = mapInstance.value
  const t = T.value
  if (!map || !t) return
  const coords: [number, number][] = [
    ...props.points.map((p) => [p.lng, p.lat] as [number, number]),
    ...props.routes.flatMap((r) => r.path),
  ]
  if (!coords.length) return
  if (coords.length === 1) {
    map.centerAndZoom(new t.LngLat(coords[0][0], coords[0][1]), 14)
    return
  }
  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  const bounds = new t.LngLatBounds(
    new t.LngLat(Math.min(...lngs), Math.min(...lats)),
    new t.LngLat(Math.max(...lngs), Math.max(...lats))
  )
  map.setViewport ? map.setViewport(bounds) : map.centerAndZoom(bounds.getCenter(), map.getZoom())
}

/** 供父组件保存时取当前地图视野（不依赖父组件的 center/zoom 状态） */
const getView = (): { center: LngLat; zoom: number } | null => {
  const map = mapInstance.value
  if (!map) return null
  try {
    const c = map.getCenter()
    return { center: { lng: c.getLng(), lat: c.getLat() }, zoom: map.getZoom() }
  } catch {
    return null
  }
}

defineExpose({ panTo, fitAll, refreshSize, getBounds: () => currentBounds.value, getView })
</script>

<template>
  <div
    class="relative w-full h-full rounded-xl overflow-hidden bg-gray-100"
    :class="[cursorClass, { 'travel-map--animating': isAnimating }]"
  >
    <!--
      注意：这个 div 是天地图的挂载点，绝对不要在它上面绑任何动态 class/style。
      天地图初始化后会往这个元素上加自己的 tdt-container 等类名，Vue 一旦因为
      动态绑定重新 patch class 属性，就会把那些类名整个覆盖掉，容器失去定位样式
      → 瓦片错位、地图变灰。光标样式因此挂在外层容器上，用 :deep 选中内部元素。
    -->
    <div ref="mapEl" class="w-full h-full"></div>

    <!-- 未配置密钥：给出可操作的引导，而不是白屏 -->
    <div
      v-if="missingKey"
      class="absolute inset-0 flex items-center justify-center bg-gray-50 p-6"
    >
      <div class="max-w-md text-center space-y-3">
        <div class="text-4xl">🗺️</div>
        <h3 class="text-base font-semibold text-ink-900">尚未配置天地图密钥</h3>
        <p class="text-body-sm text-ink-600 leading-relaxed">
          请到
          <a
            href="https://console.tianditu.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-600 hover:underline"
          >天地图控制台</a>
          申请「浏览器端」类型的 tk 密钥，填入环境变量
          <code class="px-1 py-0.5 rounded bg-gray-200 text-xs">VITE_TIANDITU_KEY</code>
          后重启开发服务。
        </p>
        <p class="text-xs text-ink-500">
          注意：需要把 localhost、127.0.0.1 以及线上域名加进该密钥的域名白名单，否则底图不出图。
        </p>
      </div>
    </div>

    <div
      v-else-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-gray-50"
    >
      <span class="text-body-sm text-ink-500">地图加载中…</span>
    </div>

    <div
      v-else-if="errorMsg"
      class="absolute inset-0 flex items-center justify-center bg-gray-50 p-6"
    >
      <div class="max-w-md text-center space-y-2">
        <div class="text-3xl">⚠️</div>
        <p class="text-body-sm text-ink-700">{{ errorMsg }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 光标挂在外层，避免动态 class 落到天地图自己的容器元素上（见模板注释） */
.travel-map--crosshair :deep(.tdt-container),
.travel-map--crosshair :deep(.tdt-container *) {
  cursor: crosshair !important;
}

/* 缩放/拖动动画进行中：临时隐藏所有 T.Label DOM，避免 SDK 在 zoomend/moveend
   时重投影 Label 造成跐跐跐跐跐跐跐跐跳。Polyline (SVG) 不受影响,路线本身依然可见。
   visibility 而非 display —— display 会触发 reflow,visibility 只触发 composite,
   跳过成本最低。 */
.travel-map--animating :deep(.tdt-container label),
.travel-map--animating :deep(.tdt-container .tdt-label),
.travel-map--animating :deep(.tdt-container [class*="label"]) {
  visibility: hidden !important;
}
</style>

<!--
  天地图 4.0 的 T.Label 容器会自带白色背景 + 内边距，段距离标签的内层胶囊之外
  会出现一圈白色色块。用 :has() 选择器命中「子节点带 tt-seg-label class 的 Label
  容器」，只压掉这一类标签的容器白底，不会误伤点位 label（点位 label 自带白底
  视觉，没外层容器白底也无所谓）。
-->
<style>
.tdt-label:has(.tt-seg-label),
[class*="tdt-label"]:has(.tt-seg-label) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}
</style>

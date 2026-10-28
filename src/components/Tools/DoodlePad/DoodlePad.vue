<script setup lang="ts">
/**
 * 在线涂鸦画板（无限画布）
 * --------------------------------------------------------
 * - 无限画布：手型工具 / 空格 / 中键拖动平移，Ctrl+滚轮 / 双指捏合缩放
 * - 画笔 / 橡皮：笔画用 perfect-freehand 渲染，支持数位板压感
 * - 颜色：10 色预设 + 自定义拾色器；画笔 1~60px，橡皮 4~80px
 * - 撤销 / 重做：笔画级历史，无步数限制（Ctrl+Z / Ctrl+Y）
 * - 导出：按内容包围盒自动裁剪，下载 PNG / 复制到剪贴板，可选透明背景
 * - 全部纯前端，离线可用，隐私安全
 */
import { ref, shallowRef, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getStroke } from 'perfect-freehand'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

// ============================================================
// 类型
// ============================================================
type Tool = 'brush' | 'eraser' | 'hand'

/** perfect-freehand 输入点（世界坐标，pressure 为 0~1 压感，可选） */
interface StrokePoint {
  x: number
  y: number
  pressure?: number
}

/** 一笔：提交后 points 不再变化，outline / bbox 提交时缓存 */
interface Stroke {
  tool: 'brush' | 'eraser'
  color: string
  size: number
  points: StrokePoint[]
  /** 鼠标/触摸无真实压感时用速度模拟粗细；数位板关闭模拟 */
  simulatePressure: boolean
  /** 世界坐标轮廓（getStroke 返回的 [x, y] 元组），提交时计算一次 */
  outline?: [number, number][]
  /** 内容包围盒（含笔宽外扩），用于视口裁剪与导出 */
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
}

// 预设颜色（8 色常用 + 黑/白）
const PRESET_COLORS = [
  '#000000', // 黑
  '#FFFFFF', // 白
  '#E11D48', // 红
  '#F59E0B', // 橙
  '#FACC15', // 黄
  '#22C55E', // 绿
  '#06B6D4', // 青
  '#2563EB', // 蓝
  '#7C3AED', // 紫
  '#A16207', // 棕
]

// ============================================================
// 状态
// ============================================================
const tool = ref<Tool>('brush')
const color = ref<string>('#000000')
const brushSize = ref<number>(6)
const eraserSize = ref<number>(20)
const canvasBg = ref<string>('#FFFFFF')
const transparentBg = ref(false)

const strokes = shallowRef<Stroke[]>([])
const redoStack = shallowRef<Stroke[]>([])
const canUndo = computed(() => strokes.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)

/** 视口：x/y 为视口左上角的世界坐标，zoom 为显示比例 */
const viewport = reactive({ x: 0, y: 0, zoom: 1 })
const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

// ============================================================
// 画布引用 / 交互状态
// ============================================================
const wrapEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

const spaceHeld = ref(false)
const panning = ref(false)
let panLast = { x: 0, y: 0 }

/** 活跃触点（含鼠标），用于双指捏合 */
const activePointers = new Map<number, { x: number; y: number }>()
let pinchStart: {
  dist: number
  worldMid: { x: number; y: number }
  zoom: number
} | null = null

let drawingId: number | null = null
let liveStroke: Stroke | null = null

let rafId = 0
let resizeObserver: ResizeObserver | null = null

// ============================================================
// 坐标换算
// ============================================================
function screenToWorld(sx: number, sy: number) {
  return {
    x: sx / viewport.zoom + viewport.x,
    y: sy / viewport.zoom + viewport.y,
  }
}

function canvasPos(e: { clientX: number; clientY: number }) {
  const rect = canvasEl.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/** 以屏幕坐标 (sx, sy) 为锚点缩放：锚点下的世界内容保持不动 */
function zoomAt(sx: number, sy: number, factor: number) {
  const z = clampZoom(viewport.zoom * factor)
  const wx = viewport.x + sx / viewport.zoom
  const wy = viewport.y + sy / viewport.zoom
  viewport.zoom = z
  viewport.x = wx - sx / z
  viewport.y = wy - sy / z
}

function viewCenter() {
  const cv = canvasEl.value
  if (!cv) return { x: 0, y: 0 }
  return { x: cv.clientWidth / 2, y: cv.clientHeight / 2 }
}

// ============================================================
// 笔画几何
// ============================================================
function strokeOutline(s: Stroke, finished: boolean) {
  if (s.tool === 'brush') {
    return getStroke(s.points, {
      size: s.size,
      thinning: 0.55,
      smoothing: 0.5,
      streamline: 0.45,
      simulatePressure: s.simulatePressure,
      last: finished,
    })
  }
  // 橡皮只要恒定宽度的胶囊形
  return getStroke(s.points, {
    size: s.size,
    thinning: 0,
    smoothing: 0.4,
    streamline: 0.4,
    simulatePressure: false,
    last: finished,
  })
}

function strokeBbox(s: Stroke): Stroke['bbox'] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of s.points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const pad = s.size / 2 + 2
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

function fillOutline(c: CanvasRenderingContext2D, outline: [number, number][], s: Stroke) {
  if (outline.length === 0) return
  if (s.tool === 'eraser') {
    c.globalCompositeOperation = 'destination-out'
    c.fillStyle = '#000'
  } else {
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = s.color
  }
  c.beginPath()
  c.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) c.lineTo(outline[i][0], outline[i][1])
  c.closePath()
  c.fill()
  c.globalCompositeOperation = 'source-over'
}

// ============================================================
// 渲染（脏标记 + rAF）
// ============================================================
function render() {
  const cv = canvasEl.value
  if (!cv) return
  const w = cv.clientWidth
  const h = cv.clientHeight
  if (w === 0 || h === 0) return
  const dpr = window.devicePixelRatio || 1
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
  }
  ctx = ctx || cv.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  // 世界坐标变换（画布本体只承载笔画，透明；底色/网格由容器 CSS 呈现）
  ctx.setTransform(
    dpr * viewport.zoom, 0, 0, dpr * viewport.zoom,
    -viewport.x * viewport.zoom * dpr, -viewport.y * viewport.zoom * dpr,
  )

  // 视口世界范围（裁掉画布外的笔画）
  const vx0 = viewport.x
  const vy0 = viewport.y
  const vx1 = vx0 + w / viewport.zoom
  const vy1 = vy0 + h / viewport.zoom

  for (const s of strokes.value) {
    const b = s.bbox
    if (b.maxX < vx0 || b.minX > vx1 || b.maxY < vy0 || b.minY > vy1) continue
    const o = s.outline ?? (s.outline = strokeOutline(s, true))
    fillOutline(ctx, o, s)
  }
  if (liveStroke) {
    fillOutline(ctx, strokeOutline(liveStroke, false), liveStroke)
  }
}

function scheduleRender() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    render()
  })
}

// ============================================================
// 指针交互：绘制 / 平移 / 双指捏合
// ============================================================
function beginPinch() {
  const pts = [...activePointers.values()]
  if (pts.length < 2) return
  const [a, b] = pts
  const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
  const rect = canvasEl.value!.getBoundingClientRect()
  const mid = screenToWorld((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top)
  pinchStart = { dist, worldMid: mid, zoom: viewport.zoom }
}

function onPointerDown(e: PointerEvent) {
  const cv = canvasEl.value
  if (!cv) return
  try {
    cv.setPointerCapture(e.pointerId)
  } catch {
    // 个别环境（自动化注入等）pointerId 未激活会抛 NotFoundError，不影响后续逻辑
  }
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  // 第二根手指落下：丢弃进行中的笔画，进入捏合
  if (e.pointerType === 'touch' && activePointers.size === 2) {
    liveStroke = null
    drawingId = null
    panning.value = false
    beginPinch()
    scheduleRender()
    return
  }

  const wantPan = e.button === 1 || spaceHeld.value || tool.value === 'hand'
  if (wantPan) {
    // 阻止中键默认的自动滚动
    if (e.button === 1) e.preventDefault()
    panning.value = true
    panLast = { x: e.clientX, y: e.clientY }
    return
  }
  if (e.button !== 0 || activePointers.size > 1 || pinchStart) return

  const pos = screenToWorld(canvasPos(e).x, canvasPos(e).y)
  const isBrush = tool.value !== 'eraser'
  liveStroke = {
    tool: isBrush ? 'brush' : 'eraser',
    color: color.value,
    size: isBrush ? brushSize.value : eraserSize.value,
    points: [{ x: pos.x, y: pos.y }],
    simulatePressure: e.pointerType !== 'pen',
    bbox: { minX: pos.x, minY: pos.y, maxX: pos.x, maxY: pos.y },
  }
  drawingId = e.pointerId
  scheduleRender()
}

function onPointerMove(e: PointerEvent) {
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  if (pinchStart && activePointers.size >= 2) {
    const [a, b] = [...activePointers.values()]
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
    const rect = canvasEl.value!.getBoundingClientRect()
    const cx = (a.x + b.x) / 2 - rect.left
    const cy = (a.y + b.y) / 2 - rect.top
    const z = clampZoom(pinchStart.zoom * (dist / pinchStart.dist))
    viewport.zoom = z
    viewport.x = pinchStart.worldMid.x - cx / z
    viewport.y = pinchStart.worldMid.y - cy / z
    scheduleRender()
    return
  }

  if (panning.value) {
    const dx = e.clientX - panLast.x
    const dy = e.clientY - panLast.y
    panLast = { x: e.clientX, y: e.clientY }
    viewport.x -= dx / viewport.zoom
    viewport.y -= dy / viewport.zoom
    scheduleRender()
    return
  }

  if (liveStroke && e.pointerId === drawingId) {
    const pos = screenToWorld(canvasPos(e).x, canvasPos(e).y)
    const last = liveStroke.points[liveStroke.points.length - 1]
    // 过滤原地抖动，控制笔画点数
    if (Math.hypot(pos.x - last.x, pos.y - last.y) >= 0.5 && liveStroke.points.length < 5000) {
      const pt: StrokePoint = { x: pos.x, y: pos.y }
      if (e.pointerType === 'pen' && e.pressure > 0) pt.pressure = e.pressure
      liveStroke.points.push(pt)
      scheduleRender()
    }
  }
}

function onPointerUp(e: PointerEvent) {
  activePointers.delete(e.pointerId)
  if (pinchStart && activePointers.size < 2) pinchStart = null
  panning.value = false
  if (liveStroke && e.pointerId === drawingId) {
    commitStroke()
    drawingId = null
  }
}

function onPointerCancel(e: PointerEvent) {
  activePointers.delete(e.pointerId)
  if (pinchStart && activePointers.size < 2) pinchStart = null
  panning.value = false
  if (e.pointerId === drawingId) {
    liveStroke = null
    drawingId = null
    scheduleRender()
  }
}

function commitStroke() {
  if (!liveStroke) return
  const s = liveStroke
  s.outline = strokeOutline(s, true)
  s.bbox = strokeBbox(s)
  strokes.value = strokes.value.concat(s)
  redoStack.value = []
  liveStroke = null
  scheduleRender()
}

// ============================================================
// 滚轮：Ctrl/⌘+滚轮缩放，普通滚轮平移
// ============================================================
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const pos = canvasPos(e)
  if (e.ctrlKey || e.metaKey) {
    zoomAt(pos.x, pos.y, Math.exp(-e.deltaY * 0.0015))
  } else {
    viewport.x += e.deltaX / viewport.zoom
    viewport.y += e.deltaY / viewport.zoom
  }
  scheduleRender()
}

// ============================================================
// 快捷键：空格平移、Ctrl+Z / Ctrl+Y
// ============================================================
function isEditableTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
  )
}

function onKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return
  if (e.code === 'Space') {
    e.preventDefault()
    spaceHeld.value = true
    return
  }
  const key = e.key.toLowerCase()
  if ((e.ctrlKey || e.metaKey) && key === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
    e.preventDefault()
    redo()
  }
}

function onKeyup(e: KeyboardEvent) {
  if (e.code === 'Space') spaceHeld.value = false
}

// ============================================================
// 历史
// ============================================================
function undo() {
  const arr = strokes.value
  if (arr.length === 0) return
  const s = arr[arr.length - 1]
  strokes.value = arr.slice(0, -1)
  redoStack.value = redoStack.value.concat(s)
  scheduleRender()
}

function redo() {
  const arr = redoStack.value
  if (arr.length === 0) return
  const s = arr[arr.length - 1]
  redoStack.value = arr.slice(0, -1)
  strokes.value = strokes.value.concat(s)
  scheduleRender()
}

function clearCanvas() {
  if (strokes.value.length === 0) return
  ElMessageBox.confirm('确定清空所有绘制内容？', '清空画板', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    strokes.value = []
    redoStack.value = []
    scheduleRender()
  }).catch(() => {})
}

// ============================================================
// 缩放控制
// ============================================================
const zoomPercent = computed(() => Math.round(viewport.zoom * 100))

function zoomIn() {
  const c = viewCenter()
  zoomAt(c.x, c.y, 1.25)
  scheduleRender()
}

function zoomOut() {
  const c = viewCenter()
  zoomAt(c.x, c.y, 0.8)
  scheduleRender()
}

function resetZoom() {
  const c = viewCenter()
  zoomAt(c.x, c.y, 1 / viewport.zoom)
  scheduleRender()
}

/** 全部笔画的包围盒（含笔宽），无内容返回 null */
function contentBounds() {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of strokes.value) {
    const b = s.bbox
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  if (minX === Infinity) return null
  return { minX, minY, maxX, maxY }
}

function fitContent() {
  const cv = canvasEl.value
  const b = contentBounds()
  if (!cv || !b) {
    ElMessage.warning('画布还是空的，先画点什么吧')
    return
  }
  const pad = 60
  const bw = b.maxX - b.minX + pad * 2
  const bh = b.maxY - b.minY + pad * 2
  const z = clampZoom(Math.min(cv.clientWidth / bw, cv.clientHeight / bh, 2))
  viewport.zoom = z
  viewport.x = (b.minX + b.maxX) / 2 - cv.clientWidth / 2 / z
  viewport.y = (b.minY + b.maxY) / 2 - cv.clientHeight / 2 / z
  scheduleRender()
}

// ============================================================
// 导出：按内容包围盒裁剪合成
// ============================================================
/** 浏览器单张 canvas 尺寸上限（保守值），超出时整体等比缩小 */
const MAX_EXPORT_SIDE = 16000

function composeExportCanvas(): { canvas: HTMLCanvasElement } | null {
  const b = contentBounds()
  if (!b) {
    ElMessage.warning('画布还是空的，先画点什么吧')
    return null
  }
  const margin = 32
  let w = b.maxX - b.minX + margin * 2
  let h = b.maxY - b.minY + margin * 2
  let scale = 1
  if (w > MAX_EXPORT_SIDE || h > MAX_EXPORT_SIDE) {
    scale = MAX_EXPORT_SIDE / Math.max(w, h)
    w *= scale
    h *= scale
    ElMessage.warning(`内容超出浏览器画布上限，已等比缩小到 ${(scale * 100).toFixed(0)}% 导出`)
  }
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(w))
  out.height = Math.max(1, Math.round(h))
  const c = out.getContext('2d')!
  if (!transparentBg.value) {
    c.fillStyle = canvasBg.value
    c.fillRect(0, 0, out.width, out.height)
  }
  c.setTransform(scale, 0, 0, scale, (-(b.minX - margin)) * scale, (-(b.minY - margin)) * scale)
  for (const s of strokes.value) {
    const o = s.outline ?? (s.outline = strokeOutline(s, true))
    fillOutline(c, o, s)
  }
  return { canvas: out }
}

function downloadPNG() {
  const composed = composeExportCanvas()
  if (!composed) return
  composed.canvas.toBlob((blob) => {
    if (!blob) {
      ElMessage.error('生成图片失败')
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.href = url
    a.download = `doodle-${ts}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('已下载 PNG')
  }, 'image/png')
}

async function copyToClipboard() {
  const composed = composeExportCanvas()
  if (!composed) return
  try {
    const blob: Blob | null = await new Promise((resolve) => {
      composed.canvas.toBlob((b) => resolve(b), 'image/png')
    })
    if (!blob) {
      ElMessage.error('生成图片失败')
      return
    }
    // @ts-ignore ClipboardItem 可能不在 TS 类型里
    const ClipboardItemCtor = (window as any).ClipboardItem
    if (!ClipboardItemCtor) {
      ElMessage.warning('当前浏览器不支持复制图片到剪贴板，请使用下载')
      return
    }
    const item = new ClipboardItemCtor({ 'image/png': blob })
    await (navigator.clipboard as any).write([item])
    ElMessage.success('已复制到剪贴板')
  } catch (e: any) {
    ElMessage.warning(`复制失败：${e?.message || e}`)
  }
}

// ============================================================
// 颜色
// ============================================================
function onColorPickerInput(e: Event) {
  color.value = (e.target as HTMLInputElement).value
}

function onBgColorPickerInput(e: Event) {
  canvasBg.value = (e.target as HTMLInputElement).value
}

function pickPresetColor(c: string) {
  color.value = c
  // 选了白色自动切到画笔工具，避免误以为是橡皮
  if (tool.value !== 'brush') tool.value = 'brush'
}

// ============================================================
// 视觉辅助
// ============================================================
const canvasCursor = computed(() => {
  if (tool.value === 'hand' || spaceHeld.value) {
    return panning.value ? 'cursor-grabbing' : 'cursor-grab'
  }
  return 'cursor-crosshair'
})

/** 点阵网格跟随视口平移/缩放，给无限画布提供空间参照 */
const gridStyle = computed(() => ({
  backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
  backgroundPosition: `${-viewport.x * viewport.zoom}px ${-viewport.y * viewport.zoom}px`,
}))

// ============================================================
// 生命周期
// ============================================================
onMounted(() => {
  const cv = canvasEl.value
  const wrap = wrapEl.value
  if (!cv || !wrap) return

  // 初始视口：世界原点居中
  viewport.x = -wrap.clientWidth / 2
  viewport.y = -wrap.clientHeight / 2

  // wheel 需要非 passive 才能 preventDefault（阻止浏览器页面滚动/缩放）
  cv.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)

  resizeObserver = new ResizeObserver(() => scheduleRender())
  resizeObserver.observe(wrap)
  scheduleRender()
})

onBeforeUnmount(() => {
  const cv = canvasEl.value
  if (cv) cv.removeEventListener('wheel', onWheel)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
  resizeObserver?.disconnect()
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="在线涂鸦画板" />

    <!-- 工具栏 -->
    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200 mb-3 space-y-3">
      <!-- 工具 + 颜色 + 粗细 -->
      <div class="flex flex-wrap items-center gap-4">
        <!-- 工具切换 -->
        <div class="flex items-center gap-2">
          <span class="text-body-sm text-slate-600">工具</span>
          <el-radio-group v-model="tool" size="default">
            <el-radio-button label="brush">✏️ 画笔</el-radio-button>
            <el-radio-button label="eraser">🩹 橡皮</el-radio-button>
            <el-radio-button label="hand">🖐 移动</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 颜色预设（橡皮时禁用） -->
        <div
          class="flex items-center gap-2 transition-opacity"
          :class="{ 'opacity-40 pointer-events-none': tool === 'eraser' }"
        >
          <span class="text-body-sm text-slate-600">颜色</span>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              v-for="c in PRESET_COLORS"
              :key="c"
              class="w-7 h-7 rounded-md border-2 transition-all hover:scale-110"
              :class="color === c ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-300'"
              :style="{ backgroundColor: c }"
              :title="c"
              @click="pickPresetColor(c)"
            ></button>
            <!-- 自定义拾色器 -->
            <label
              class="w-7 h-7 rounded-md border-2 border-slate-300 cursor-pointer relative overflow-hidden hover:scale-110 transition-transform"
              :class="!PRESET_COLORS.includes(color) ? 'ring-2 ring-indigo-200 border-indigo-500' : ''"
              :style="{ backgroundColor: color }"
              title="自定义颜色"
            >
              <input
                type="color"
                class="absolute inset-0 opacity-0 cursor-pointer"
                :value="color"
                @input="onColorPickerInput"
              />
            </label>
          </div>
        </div>

        <!-- 画笔粗细 -->
        <div class="flex items-center gap-2 min-w-[200px]">
          <span class="text-body-sm text-slate-600 whitespace-nowrap">画笔粗细</span>
          <el-slider
            v-model="brushSize"
            :min="1"
            :max="60"
            :step="1"
            class="w-32"
          />
          <span class="text-caption text-slate-500 w-8 text-right">{{ brushSize }}px</span>
        </div>

        <!-- 橡皮粗细 -->
        <div class="flex items-center gap-2 min-w-[200px]">
          <span class="text-body-sm text-slate-600 whitespace-nowrap">橡皮粗细</span>
          <el-slider
            v-model="eraserSize"
            :min="4"
            :max="80"
            :step="1"
            class="w-32"
          />
          <span class="text-caption text-slate-500 w-8 text-right">{{ eraserSize }}px</span>
        </div>
      </div>

      <!-- 背景 + 缩放 + 操作 -->
      <div class="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100">
        <!-- 背景 -->
        <div class="flex items-center gap-2">
          <span class="text-body-sm text-slate-600">画布底色</span>
          <label
            class="w-7 h-7 rounded-md border-2 border-slate-300 cursor-pointer relative overflow-hidden"
            :style="{ backgroundColor: transparentBg ? 'transparent' : canvasBg }"
            :class="{ 'opacity-50': transparentBg }"
            title="选择画布底色"
          >
            <input
              type="color"
              class="absolute inset-0 opacity-0 cursor-pointer"
              :value="canvasBg"
              :disabled="transparentBg"
              @input="onBgColorPickerInput"
            />
          </label>
          <el-checkbox v-model="transparentBg">透明背景</el-checkbox>
        </div>

        <!-- 缩放 -->
        <div class="flex items-center gap-2">
          <span class="text-body-sm text-slate-600">缩放</span>
          <el-button-group>
            <el-button size="small" @click="zoomOut" title="缩小">−</el-button>
            <el-button size="small" class="!w-14" disabled>{{ zoomPercent }}%</el-button>
            <el-button size="small" @click="zoomIn" title="放大">＋</el-button>
          </el-button-group>
          <el-button size="small" @click="resetZoom">100%</el-button>
          <el-button size="small" @click="fitContent" title="缩放至全部内容可见">⛶ 适配内容</el-button>
        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center gap-2 ml-auto">
          <el-button :disabled="!canUndo" @click="undo" title="撤销 (Ctrl+Z)">
            ↶ 撤销
          </el-button>
          <el-button :disabled="!canRedo" @click="redo" title="重做 (Ctrl+Y)">
            ↷ 重做
          </el-button>
          <el-button type="warning" plain @click="clearCanvas">
            🗑 清空
          </el-button>
          <el-button type="primary" plain @click="copyToClipboard">
            📋 复制
          </el-button>
          <el-button type="primary" @click="downloadPNG">
            ⬇️ 下载 PNG
          </el-button>
        </div>
      </div>
    </div>

    <!-- 画布区（无限画布：底色/网格由容器呈现，canvas 只承载笔画） -->
    <div
      ref="wrapEl"
      class="relative rounded-2xl border border-slate-200 shadow-inner overflow-hidden touch-none"
      :class="transparentBg ? 'bg-checker' : ''"
      :style="!transparentBg ? { backgroundColor: canvasBg } : undefined"
      style="height: min(72vh, 900px); min-height: 420px;"
    >
      <!-- 点阵网格：跟随视口移动，提供平移/缩放的空间参照 -->
      <div v-if="!transparentBg" class="absolute inset-0 pointer-events-none dot-grid" :style="gridStyle"></div>
      <canvas
        ref="canvasEl"
        class="absolute inset-0 w-full h-full touch-none"
        :class="canvasCursor"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      ></canvas>
      <!-- 操作提示 -->
      <div class="absolute left-3 bottom-3 pointer-events-none text-caption px-2 py-1 rounded-md bg-white/75 text-slate-500 backdrop-blur">
        拖拽绘制 · 空格/中键/移动工具平移 · Ctrl+滚轮缩放 · 触屏双指捏合
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <el-text>
        <p>在线涂鸦画板是一款纯前端的网页画图工具，画布无限大小，支持平移缩放，适合随手涂鸦、画示意图、做标记等场景。</p>
        <p><b>核心功能：</b></p>
        <ul class="list-disc pl-6 space-y-1">
          <li><b>无限画布</b>：画布没有边界，随便画多大都行</li>
          <li><b>平移</b>：按住 <b>空格</b> 拖动、鼠标<b>中键</b>拖动，或切换「🖐 移动」工具</li>
          <li><b>缩放</b>：<b>Ctrl + 滚轮</b>（触屏双指捏合），10%~800%，配合「⛶ 适配内容」一键回到全部内容</li>
          <li><b>画笔</b>：10 种预设色 + 自定义颜色，粗细 1~60px，支持<b>数位板压感</b>（无压感设备自动按速度模拟笔锋）</li>
          <li><b>橡皮</b>：4~80px 可调，按绘制顺序擦除笔画</li>
          <li><b>撤销 / 重做</b>：笔画级历史，无步数限制（快捷键 Ctrl+Z / Ctrl+Y）</li>
          <li><b>画布底色</b>：可设为任意颜色，或勾选「透明背景」用于导出透明 PNG</li>
          <li><b>导出</b>：自动按绘制内容裁剪，一键下载 PNG 或复制到剪贴板</li>
        </ul>
        <p><b>使用技巧：</b></p>
        <ul class="list-disc pl-6 space-y-1">
          <li>手机 / 平板可直接用手指涂鸦，双指捏合缩放画布</li>
          <li>画歪了用 Ctrl+Z 撤销单笔，比橡皮更快</li>
          <li>选择「透明背景」导出 PNG 可得到镂空图层</li>
          <li>所有操作均在浏览器本地完成，作品不会上传到服务器，隐私安全</li>
        </ul>
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 透明背景时的棋盘格，指示“透明”区域 */
.bg-checker {
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
    linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

/* 点阵网格（大小/位置由 gridStyle 内联控制） */
.dot-grid {
  background-image: radial-gradient(circle, rgba(100, 116, 139, 0.35) 1px, transparent 1.2px);
}

canvas {
  display: block;
}
</style>

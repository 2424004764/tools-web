<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import Download from '~icons/ep/download'
import RefreshRight from '~icons/ep/refresh-right'
import SwitchButton from '~icons/ep/switch-button'
import UploadFilled from '~icons/ep/upload-filled'
import VideoPlay from '~icons/ep/video-play'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { createMp3Encoder, createOggEncoder } from 'wasm-media-encoders'

const info = reactive({
  title: '音频剪辑器',
})

type ExportFormat = 'mp3' | 'ogg' | 'wav'

// —— 文件与解码 ——
const fileName = ref('')
const buffer = ref<AudioBuffer | null>(null)
const decoding = ref(false)
const duration = computed(() => buffer.value?.duration ?? 0)
const sampleRate = computed(() => buffer.value?.sampleRate ?? 0)
const channelCount = computed(() => buffer.value?.numberOfChannels ?? 0)

// —— 选区（秒）——
const selStart = ref(0)
const selEnd = ref(0)
const loopPlay = ref(false)

// —— 淡入淡出 ——
const fadeInSec = ref(0)
const fadeOutSec = ref(0)

// —— 导出设置 ——
const format = ref<ExportFormat>('mp3')
const mp3Bitrate = ref(192)
const oggQuality = ref(6)
const exporting = ref(false)
const exportProgress = ref(0)

// —— 结果 ——
const resultUrl = ref('')
const resultBytes = ref(0)
const resultDurationSec = ref(0)
const resultExt = ref('mp3')

// —— 播放 ——
const playing = ref(false)
const playheadSec = ref(0) // 播放游标位置（全曲时间轴）
let audioCtx: AudioContext | null = null
let playSource: AudioBufferSourceNode | null = null
let playRaf = 0
let playTimer = 0 // rAF 被节流（后台标签/遮挡窗口）时的兜底时钟
let playStartedAt = 0 // 播放发起时的 ctx.currentTime
let playOffset = 0 // 本次播放的起始位置（秒）
let playLen = 0 // 本次播放的时长（秒；循环时为循环段长度）
let loopActive = false // 本次播放是否循环

// —— 波形 ——
const waveWrap = ref<HTMLDivElement | null>(null)
const waveCanvas = ref<HTMLCanvasElement | null>(null)
const wavePeaks = ref<Float32Array>(new Float32Array(0)) // [min,max] * 列数
const waveColumns = ref(0)
let resizeObserver: ResizeObserver | null = null

// —— 视图窗口（缩放/平移）——
const viewStart = ref(0)
const viewEnd = ref(0)
const MIN_VIEW_SEC = 0.1 // 视图最小宽度
const viewLen = computed(() => Math.max(1e-6, viewEnd.value - viewStart.value))
const waveBufRev = ref(0) // 换文件时使波形峰值缓存失效
let peaksKey = ''
let drawQueued = false

// —— 概览条（minimap）——
const miniWrap = ref<HTMLDivElement | null>(null)
const miniCanvas = ref<HTMLCanvasElement | null>(null)
let miniPeaks: Float32Array | null = null
let miniCols = 0
const miniDragging = ref(false)

const getCtx = (): AudioContext => {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const pad = (n: number) => String(n).padStart(2, '0')

const formatDuration = (sec: number) => {
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ms = Math.floor((sec - total) * 10)
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}.${ms}`
}

const timestampName = () => {
  const d = new Date()
  const p = (n: number) => pad(n)
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// —— 上传与解码 ——
const onBeforeUnloadGuard = (e: BeforeUnloadEvent) => {
  e.preventDefault()
  e.returnValue = ''
}

const handleUpload = async (params: any) => {
  const file = params.file as File
  if (file.size > 200 * 1024 * 1024) {
    ElMessage.error('音频文件超过 200 MB 上限')
    return
  }
  stopPlayback()
  decoding.value = true
  window.addEventListener('beforeunload', onBeforeUnloadGuard)
  try {
    const arrayBuffer = await file.arrayBuffer()
    const decoded = await getCtx().decodeAudioData(arrayBuffer.slice(0))
    buffer.value = decoded
    fileName.value = file.name
    selStart.value = 0
    selEnd.value = decoded.duration
    viewStart.value = 0
    viewEnd.value = decoded.duration
    waveBufRev.value++
    ElMessage.success('解码成功')
    if (decoded.duration > 1800) {
      ElMessage.warning('音频超过 30 分钟，解码后的内存占用较大，低配设备建议只剪辑短音频')
    }
    await nextTick()
    drawWave(true)
  } catch {
    ElMessage.error('解码失败：该格式可能不被浏览器支持，请尝试 MP3 / WAV / OGG / M4A / FLAC')
  } finally {
    decoding.value = false
    window.removeEventListener('beforeunload', onBeforeUnloadGuard)
  }
}

// —— 波形绘制（列级 min/max 峰值，按当前视图窗口计算）——
const computePeaks = (columns: number, fromSec: number, toSec: number) => {
  const buf = buffer.value
  if (!buf || columns <= 0) {
    wavePeaks.value = new Float32Array(0)
    waveColumns.value = 0
    return
  }
  const peaks = new Float32Array(columns * 2)
  const data0 = buf.getChannelData(0)
  const data1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null
  const total = buf.length
  const sr = buf.sampleRate
  const clampedFrom = Math.min(Math.max(fromSec, 0), buf.duration)
  const clampedTo = Math.min(Math.max(toSec, 0), buf.duration)
  for (let x = 0; x < columns; x++) {
    const from = Math.min(Math.max(Math.floor((clampedFrom + ((clampedTo - clampedFrom) * x) / columns) * sr), 0), total)
    const to = Math.min(
      Math.max(Math.floor((clampedFrom + ((clampedTo - clampedFrom) * (x + 1)) / columns) * sr), from),
      total,
    )
    let min = 0
    let max = 0
    // 每 bucket 内按固定步数抽样，超长音频避免逐点遍历
    const step = Math.max(1, Math.floor((to - from) / 2048))
    for (let i = from; i < to; i += step) {
      let v = data0[i]
      if (data1) v = (v + data1[i]) * 0.5
      if (v < min) min = v
      if (v > max) max = v
    }
    peaks[x * 2] = min
    peaks[x * 2 + 1] = max
  }
  wavePeaks.value = peaks
  waveColumns.value = columns
}

const drawWave = (force = false) => {
  const canvas = waveCanvas.value
  const wrap = waveWrap.value
  const buf = buffer.value
  if (!canvas || !wrap || !buf) return

  const cssWidth = wrap.clientWidth
  if (cssWidth <= 0) return
  const cssHeight = 120
  const dpr = window.devicePixelRatio || 1

  const sizeChanged = canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)
  if (sizeChanged) {
    canvas.width = Math.round(cssWidth * dpr)
    canvas.height = Math.round(cssHeight * dpr)
    canvas.style.width = cssWidth + 'px'
    canvas.style.height = cssHeight + 'px'
  }
  // 峰值缓存键：文件版本 + 视图窗口 + 画布宽度，任一变化才重算
  const key = `${waveBufRev.value}|${viewStart.value.toFixed(5)}|${viewEnd.value.toFixed(5)}|${cssWidth}`
  if (force || sizeChanged || peaksKey !== key) {
    computePeaks(cssWidth, viewStart.value, viewEnd.value)
    peaksKey = key
  }

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssWidth, cssHeight)

  const styles = getComputedStyle(document.documentElement)
  const accent = styles.getPropertyValue('--accent-500').trim() || '99 102 241'
  ctx.fillStyle = `rgb(${accent})`

  const peaks = wavePeaks.value
  const mid = cssHeight / 2
  const scale = cssHeight / 2 - 4
  for (let x = 0; x < waveColumns.value; x++) {
    const min = peaks[x * 2]
    const max = peaks[x * 2 + 1]
    const y0 = mid - max * scale
    const h = Math.max(1, (max - min) * scale)
    ctx.fillRect(x, y0, 1, h)
  }
  drawMini()
}

// —— 概览条（全曲峰值 + DOM 遮罩层表达视图窗口）——
const computeMiniPeaks = (columns: number) => {
  const buf = buffer.value
  if (!buf || columns <= 0) {
    miniPeaks = null
    miniCols = 0
    return
  }
  const peaks = new Float32Array(columns * 2)
  const data0 = buf.getChannelData(0)
  const data1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null
  const total = buf.length
  for (let x = 0; x < columns; x++) {
    const from = Math.floor((x / columns) * total)
    const to = Math.min(Math.floor(((x + 1) / columns) * total), total)
    let min = 0
    let max = 0
    const step = Math.max(1, Math.floor((to - from) / 512))
    for (let i = from; i < to; i += step) {
      let v = data0[i]
      if (data1) v = (v + data1[i]) * 0.5
      if (v < min) min = v
      if (v > max) max = v
    }
    peaks[x * 2] = min
    peaks[x * 2 + 1] = max
  }
  miniPeaks = peaks
  miniCols = columns
}

const drawMini = () => {
  const c = miniCanvas.value
  const buf = buffer.value
  if (!c || !buf) return
  const w = c.clientWidth
  if (w <= 0) return
  const h = 28
  const dpr = window.devicePixelRatio || 1
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr) || !miniPeaks) {
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    c.style.width = w + 'px'
    c.style.height = h + 'px'
    computeMiniPeaks(w)
  }
  const ctx = c.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const styles = getComputedStyle(document.documentElement)
  const accent = styles.getPropertyValue('--accent-500').trim() || '99 102 241'
  ctx.fillStyle = `rgb(${accent})`
  if (!miniPeaks) return
  const mid = h / 2
  const scale = h / 2 - 2
  for (let x = 0; x < miniCols; x++) {
    const min = miniPeaks[x * 2]
    const max = miniPeaks[x * 2 + 1]
    const y0 = mid - max * scale
    const hh = Math.max(1, (max - min) * scale)
    ctx.fillRect(x, y0, 1, hh)
  }
}

// —— 选区交互 ——
// 屏幕 x → 视图窗口内时间（选区拖拽限制在视图内）
const wrapToTime = (clientX: number): number => {
  const wrap = waveWrap.value
  if (!wrap) return 0
  const rect = wrap.getBoundingClientRect()
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  return viewStart.value + ratio * (viewEnd.value - viewStart.value)
}

type DragMode = 'none' | 'new' | 'move-start' | 'move-end' | 'move-whole'
type HitZone = 'start' | 'end' | 'inside' | 'none'
const MIN_SEL = 0.05 // 最小选区长度（秒）
const EDGE_PX = 18 // 选区左右边缘的抓取热区（px），手柄的可视宽度与其对齐

const dragMode = ref<DragMode>('none')
const hoverZone = ref<HitZone>('none')
let dragAnchor = 0 // 「新建」拖拽的按下锚点（秒）
let dragDownX = 0
let dragMovedPx = 0
let moveSelLen = 0 // 「整体移动」开始时的选区长度
let moveSelStart = 0

// 命中检测：选区边缘热区 → 调整边界；选区内部 → 整体移动；其余 → 新建选区
// 边缘热区随缩放级别换算成秒（放大后热区对应的秒数更小，便于精细调整）
const hitTest = (clientX: number): HitZone => {
  const wrap = waveWrap.value
  const buf = buffer.value
  if (!wrap || !buf || buf.duration <= 0) return 'none'
  if (selEnd.value - selStart.value < MIN_SEL) return 'none'
  const rect = wrap.getBoundingClientRect()
  const secPerPx = (viewEnd.value - viewStart.value) / rect.width
  const edgeSec = EDGE_PX * secPerPx
  const t = wrapToTime(clientX)
  if (Math.abs(t - selStart.value) <= edgeSec) return 'start'
  if (Math.abs(t - selEnd.value) <= edgeSec) return 'end'
  if (t > selStart.value && t < selEnd.value) return 'inside'
  return 'none'
}

const waveCursor = computed(() => {
  if (dragMode.value === 'move-whole') return 'grabbing'
  if (dragMode.value === 'move-start' || dragMode.value === 'move-end') return 'ew-resize'
  if (hoverZone.value === 'start' || hoverZone.value === 'end') return 'ew-resize'
  if (hoverZone.value === 'inside') return 'grab'
  return 'crosshair'
})

const onWaveDown = (e: PointerEvent) => {
  const buf = buffer.value
  if (!buf) return
  if (dragMode.value !== 'none') return // 已有指针在拖拽（多点触控第二指），忽略
  e.preventDefault()
  try {
    waveWrap.value?.setPointerCapture(e.pointerId)
  } catch {
    /* 指针已失效时忽略，拖拽仍在本元素上 */
  }
  dragDownX = e.clientX
  dragMovedPx = 0
  const t = wrapToTime(e.clientX)
  const hit = hoverZone.value = hitTest(e.clientX)
  if (hit === 'start') {
    dragMode.value = 'move-start'
  } else if (hit === 'end') {
    dragMode.value = 'move-end'
  } else if (hit === 'inside') {
    // 整体移动：保持选区长度，跟随位移
    dragMode.value = 'move-whole'
    dragAnchor = t
    moveSelLen = selEnd.value - selStart.value
    moveSelStart = selStart.value
  } else {
    // 新建选区：按下点为锚点，选区 = [min(锚点, 当前), max(锚点, 当前)]，往回拖不塌缩
    dragMode.value = 'new'
    dragAnchor = t
    selStart.value = t
    selEnd.value = t
  }
}

const onWaveMove = (e: PointerEvent) => {
  const buf = buffer.value
  if (!buf) return
  if (dragMode.value === 'none') {
    hoverZone.value = hitTest(e.clientX)
    return
  }
  dragMovedPx = Math.max(dragMovedPx, Math.abs(e.clientX - dragDownX))
  const t = wrapToTime(e.clientX)
  switch (dragMode.value) {
    case 'new':
      selStart.value = Math.min(dragAnchor, t)
      selEnd.value = Math.max(dragAnchor, t)
      break
    case 'move-start':
      selStart.value = Math.min(Math.max(t, 0), selEnd.value - MIN_SEL)
      break
    case 'move-end':
      selEnd.value = Math.max(Math.min(t, buf.duration), selStart.value + MIN_SEL)
      break
    case 'move-whole': {
      const next = Math.min(Math.max(moveSelStart + (t - dragAnchor), 0), buf.duration - moveSelLen)
      selStart.value = next
      selEnd.value = next + moveSelLen
      break
    }
  }
}

const onWaveUp = (e: PointerEvent) => {
  const mode = dragMode.value
  if (mode === 'none') return
  const wasClick = dragMovedPx < 3
  dragMode.value = 'none'
  const buf = buffer.value
  if (!buf) return
  // 真正的单击（位移 < 3px）且不在既有选区上：在点击处展开居中小窗口，便于快速框定位置
  if (wasClick && mode === 'new') {
    const half = Math.min(buf.duration * 0.05, 15)
    selStart.value = Math.max(0, dragAnchor - half)
    selEnd.value = Math.min(buf.duration, dragAnchor + half)
  }
  hoverZone.value = hitTest(e.clientX)
}

const selectAll = () => {
  if (!buffer.value) return
  selStart.value = 0
  selEnd.value = buffer.value.duration
}

// 选区/游标遮罩按视图窗口换算为百分比，超出视图部分裁剪到 0~100
const pctInView = (t: number) => ((t - viewStart.value) / viewLen.value) * 100
const selViewLeftSec = computed(() => Math.max(selStart.value, viewStart.value))
const selViewRightSec = computed(() => Math.min(selEnd.value, viewEnd.value))
const selRatioLeft = computed(() => (duration.value > 0 ? Math.min(Math.max(pctInView(selViewLeftSec.value), 0), 100) : 0))
const selRatioWidth = computed(() => {
  if (duration.value <= 0) return 100
  const raw = pctInView(selViewRightSec.value) - pctInView(selViewLeftSec.value)
  return Math.min(Math.max(raw, 0), 100 - selRatioLeft.value)
})
const playheadLeft = computed(() => (duration.value > 0 ? Math.min(Math.max(pctInView(playheadSec.value), 0), 100) : 0))
const playheadGlobalPct = computed(() => (duration.value > 0 ? Math.min(Math.max((playheadSec.value / duration.value) * 100, 0), 100) : 0))
// 边缘手柄：选区有效且边缘在视图内（±1% 容差）时显示，给出可见的抓取目标
const EDGE_HANDLE_W = 10 // 手柄宽度 px，定位时居中于边缘线
const startHandlePct = computed(() => {
  if (duration.value <= 0 || selEnd.value - selStart.value < MIN_SEL) return null
  const p = pctInView(selStart.value)
  return p >= -1 && p <= 101 ? p : null
})
const endHandlePct = computed(() => {
  if (duration.value <= 0 || selEnd.value - selStart.value < MIN_SEL) return null
  const p = pctInView(selEnd.value)
  return p >= -1 && p <= 101 ? p : null
})
const miniViewLeftPct = computed(() => (duration.value > 0 ? Math.min(Math.max((viewStart.value / duration.value) * 100, 0), 100) : 0))
const miniViewWidthPct = computed(() => (duration.value > 0 ? Math.min(Math.max((viewLen.value / duration.value) * 100, 0), 100) : 100))

// —— 缩放 / 平移 ——
const zoomAt = (anchorSec: number, factor: number) => {
  const dur = duration.value
  if (!dur) return
  const curLen = viewLen.value
  const newLen = Math.min(dur, Math.max(MIN_VIEW_SEC, curLen * factor))
  if (newLen === curLen) return
  const ratio = (anchorSec - viewStart.value) / curLen
  let ns = anchorSec - newLen * ratio
  ns = Math.min(Math.max(ns, 0), dur - newLen)
  viewStart.value = ns
  viewEnd.value = ns + newLen
}
const zoomIn = () => zoomAt((viewStart.value + viewEnd.value) / 2, 0.5)
const zoomOut = () => zoomAt((viewStart.value + viewEnd.value) / 2, 2)
const zoomFit = () => {
  viewStart.value = 0
  viewEnd.value = duration.value
}
const panBy = (deltaSec: number) => {
  const dur = duration.value
  if (!dur) return
  const len = viewLen.value
  const ns = Math.min(Math.max(viewStart.value + deltaSec, 0), dur - len)
  viewStart.value = ns
  viewEnd.value = ns + len
}

// 滚轮直接缩放（以光标为锚点）；Shift+滚轮 / 触控板横向滑动平移；Ctrl+滚轮同样缩放（兼容）
const onWaveWheel = (e: WheelEvent) => {
  if (!buffer.value) return
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    // 平移：横向滚动优先取 deltaX，Shift+竖向滚轮取 deltaY
    e.preventDefault()
    const wrap = waveWrap.value
    if (!wrap) return
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    panBy((delta / wrap.clientWidth) * viewLen.value)
    return
  }
  e.preventDefault()
  zoomAt(wrapToTime(e.clientX), e.deltaY > 0 ? 1.3 : 0.77)
}

const scheduleDraw = () => {
  if (drawQueued) return
  drawQueued = true
  requestAnimationFrame(() => {
    drawQueued = false
    drawWave()
  })
}
watch([viewStart, viewEnd], scheduleDraw)

// —— 概览条交互：点击/拖动使视图窗口居中到该处 ——
const miniToTime = (clientX: number): number => {
  const wrap = miniWrap.value
  const buf = buffer.value
  if (!wrap || !buf) return 0
  const rect = wrap.getBoundingClientRect()
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  return ratio * buf.duration
}
const panMiniTo = (clientX: number) => {
  const dur = duration.value
  if (!dur) return
  const len = viewLen.value
  const t = miniToTime(clientX)
  const ns = Math.min(Math.max(t - len / 2, 0), dur - len)
  viewStart.value = ns
  viewEnd.value = ns + len
}
const onMiniDown = (e: PointerEvent) => {
  if (!buffer.value) return
  e.preventDefault()
  try {
    miniWrap.value?.setPointerCapture(e.pointerId)
  } catch {
    /* 忽略 */
  }
  miniDragging.value = true
  panMiniTo(e.clientX)
}
const onMiniMove = (e: PointerEvent) => {
  if (!miniDragging.value) return
  panMiniTo(e.clientX)
}
const onMiniUp = () => {
  miniDragging.value = false
}

// clamp 数字输入与拖动互相打架时的越界值
const clampSelection = () => {
  if (!buffer.value) return
  const dur = buffer.value.duration
  selStart.value = Math.min(Math.max(selStart.value, 0), dur)
  selEnd.value = Math.min(Math.max(selEnd.value, selStart.value), dur)
}

const stopPlayheadTimers = () => {
  if (playRaf) {
    cancelAnimationFrame(playRaf)
    playRaf = 0
  }
  if (playTimer) {
    window.clearInterval(playTimer)
    playTimer = 0
  }
}

// —— 播放 ——
const stopPlayback = () => {
  if (playSource && playing.value && audioCtx) {
    // 手动停止时把游标停在当前位置
    playheadSec.value = currentPlayTime()
  }
  if (playSource) {
    try {
      playSource.stop()
    } catch {
      /* 已停止 */
    }
    playSource.onended = null
    playSource.disconnect()
    playSource = null
  }
  stopPlayheadTimers()
  playing.value = false
}

// 由 AudioContext 时钟推算当前播放位置（循环时在循环段内回绕）
const currentPlayTime = (): number => {
  if (!audioCtx) return playheadSec.value
  const t = playOffset + (audioCtx.currentTime - playStartedAt)
  if (loopActive && playLen > 0) {
    return playOffset + ((t - playOffset) % playLen)
  }
  return Math.min(Math.max(t, playOffset), playOffset + playLen)
}

const tickPlayhead = () => {
  if (!playing.value) return
  const t = currentPlayTime()
  playheadSec.value = t
  // 跟随播放：游标离开视图时平移视图窗口（游标停在左侧 10% 处）
  if (t > viewEnd.value || t < viewStart.value) {
    const len = viewLen.value
    const dur = duration.value
    const ns = len >= dur ? 0 : Math.min(Math.max(t - len * 0.1, 0), dur - len)
    viewStart.value = ns
    viewEnd.value = ns + len
  }
}

const startPlayback = () => {
  const buf = buffer.value
  if (!buf) return
  stopPlayback()
  const ctx = getCtx()
  ctx.resume().catch(() => {})
  const src = ctx.createBufferSource()
  src.buffer = buf
  const hasSel = selEnd.value - selStart.value >= MIN_SEL
  playOffset = hasSel ? selStart.value : 0
  playLen = hasSel ? selEnd.value - selStart.value : buf.duration
  loopActive = loopPlay.value && hasSel
  playStartedAt = ctx.currentTime
  playheadSec.value = playOffset
  if (loopActive) {
    src.loop = true
    src.loopStart = playOffset
    src.loopEnd = playOffset + playLen
    src.start(0, playOffset)
  } else {
    src.start(0, playOffset, playLen)
  }
  src.onended = () => {
    if (playSource === src) {
      playheadSec.value = playOffset + playLen
      stopPlayheadTimers()
      playing.value = false
      playSource = null
    }
  }
  src.connect(ctx.destination)
  playSource = src
  playing.value = true
  stopPlayheadTimers()
  playRaf = requestAnimationFrame(tickPlayhead)
  playTimer = window.setInterval(tickPlayhead, 200)
}

// —— 切片 + 淡入淡出 ——
const buildSlicedBuffer = (): AudioBuffer | null => {
  const buf = buffer.value
  if (!buf) return null
  clampSelection()
  const sr = buf.sampleRate
  let from = Math.floor(selStart.value * sr)
  let to = Math.floor(selEnd.value * sr)
  if (to - from < 1) {
    from = 0
    to = buf.length
  }
  const length = to - from
  const channels = buf.numberOfChannels
  const ctx = getCtx()
  const out = ctx.createBuffer(channels, length, sr)
  for (let c = 0; c < channels; c++) {
    out.copyToChannel(buf.getChannelData(c).subarray(from, to), c)
  }

  const inSec = Math.min(Math.max(fadeInSec.value, 0), duration.value)
  const outSec = Math.min(Math.max(fadeOutSec.value, 0), duration.value)
  const inSamples = Math.floor(inSec * sr)
  const outSamples = Math.floor(outSec * sr)
  for (let c = 0; c < channels; c++) {
    const data = out.getChannelData(c)
    for (let i = 0; i < inSamples && i < length; i++) {
      data[i] *= i / inSamples
    }
    for (let i = 0; i < outSamples && i < length; i++) {
      data[length - 1 - i] *= i / outSamples
    }
  }
  return out
}

// —— WAV 编码（16-bit PCM，零依赖）——
const encodeWav = (audio: AudioBuffer): Blob => {
  const channels = audio.numberOfChannels
  const length = audio.length
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataSize = length * blockAlign
  const view = new DataView(new ArrayBuffer(44 + dataSize))

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, audio.sampleRate, true)
  view.setUint32(28, audio.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const chans: Float32Array[] = []
  for (let c = 0; c < channels; c++) chans.push(audio.getChannelData(c))
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.min(Math.max(chans[c][i], -1), 1)
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' })
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0))

// —— MP3 / OGG 编码（wasm-media-encoders，wasm 已内联 base64）——
const encodeCompressed = async (audio: AudioBuffer, fmt: 'mp3' | 'ogg'): Promise<Blob> => {
  const encoder = fmt === 'mp3' ? await createMp3Encoder() : await createOggEncoder()
  const channels = Math.min(audio.numberOfChannels, 2) as 1 | 2
  encoder.configure({
    channels,
    sampleRate: audio.sampleRate,
    ...(fmt === 'mp3' ? { bitrate: mp3Bitrate.value as 128 | 192 | 256 | 320 } : { vbrQuality: oggQuality.value }),
  })

  const chanData: Float32Array[] = []
  for (let c = 0; c < channels; c++) chanData.push(audio.getChannelData(c))

  const parts: Uint8Array[] = []
  const total = audio.length
  const chunk = Math.max(4096, Math.floor(audio.sampleRate)) // 约 1 秒一片
  for (let offset = 0; offset < total; offset += chunk) {
    const frames = Math.min(chunk, total - offset)
    const slice: Float32Array[] = chanData.map((d) => d.subarray(offset, offset + frames))
    // encode 返回的 Uint8Array 指向内部复用缓冲，必须立即拷贝
    const out = encoder.encode(slice)
    if (out.length > 0) parts.push(new Uint8Array(out))
    exportProgress.value = Math.min(0.99, (offset + frames) / total)
    if ((offset / chunk) % 4 === 3) await yieldToUi()
  }
  const tail = encoder.finalize()
  if (tail.length > 0) parts.push(new Uint8Array(tail))
  exportProgress.value = 1

  return new Blob(parts as BlobPart[], { type: fmt === 'mp3' ? 'audio/mpeg' : 'audio/ogg' })
}

// —— 导出 ——
const canExport = computed(() => !!buffer.value && !exporting.value)

const startExport = async () => {
  const buf = buffer.value
  if (!buf) return
  stopPlayback()
  exporting.value = true
  exportProgress.value = 0
  window.addEventListener('beforeunload', onBeforeUnloadGuard)
  try {
    const sliced = buildSlicedBuffer()
    if (!sliced) return
    const blob =
      format.value === 'wav' ? await Promise.resolve(encodeWav(sliced)) : await encodeCompressed(sliced, format.value)

    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    resultUrl.value = URL.createObjectURL(blob)
    resultBytes.value = blob.size
    resultDurationSec.value = sliced.duration
    resultExt.value = format.value
    ElMessage.success('导出成功')
  } catch (err) {
    console.error('[audio-clipper] export failed:', err)
    ElMessage.error('导出失败：' + (err instanceof Error ? err.message : '未知错误'))
  } finally {
    exporting.value = false
    window.removeEventListener('beforeunload', onBeforeUnloadGuard)
  }
}

const download = () => {
  if (!resultUrl.value) return
  const a = document.createElement('a')
  a.href = resultUrl.value
  a.download = `音频剪辑_${timestampName()}.${resultExt.value}`
  a.click()
  ElMessage.success('下载成功')
}

const reset = () => {
  stopPlayback()
  buffer.value = null
  fileName.value = ''
  playheadSec.value = 0
  resultUrl.value = ''
  resultBytes.value = 0
  resultDurationSec.value = 0
  fadeInSec.value = 0
  fadeOutSec.value = 0
  exportProgress.value = 0
  viewStart.value = 0
  viewEnd.value = 0
  wavePeaks.value = new Float32Array(0)
  waveColumns.value = 0
  peaksKey = ''
  miniPeaks = null
  miniCols = 0
}

onMounted(() => {
  const wrap = waveWrap.value
  if (wrap && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => drawWave())
    resizeObserver.observe(wrap)
  }
})

onBeforeUnmount(() => {
  stopPlayback()
  resizeObserver?.disconnect()
  window.removeEventListener('beforeunload', onBeforeUnloadGuard)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  audioCtx?.close().catch(() => {})
  audioCtx = null
})
</script>

<template>
  <div class="audio-clipper-page flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white space-y-4">
      <!-- 上传 -->
      <el-upload
        drag
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
        :show-file-list="false"
        :http-request="handleUpload"
        class="w-full"
        :disabled="decoding"
      >
        <el-icon :size="40" class="text-gray-400"><UploadFilled /></el-icon>
        <div class="el-upload__text mt-2">
          拖拽音频到此处，或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip text-gray-400 mt-1">
            支持 MP3 / WAV / OGG / M4A / AAC / FLAC（以浏览器解码能力为准），最大 200 MB，纯浏览器本地处理
          </div>
        </template>
      </el-upload>
      <div v-if="decoding" class="text-body-sm text-gray-400">解码中，请稍候…</div>

      <template v-if="buffer">
        <!-- 文件信息 + 重选 -->
        <div class="flex items-center gap-2 flex-wrap text-body-sm">
          <el-tag type="info" size="small">{{ fileName }}</el-tag>
          <el-tag size="small">时长 {{ formatDuration(duration) }}</el-tag>
          <el-tag size="small">{{ sampleRate }} Hz</el-tag>
          <el-tag size="small">{{ channelCount === 1 ? '单声道' : '立体声' }}</el-tag>
          <el-button size="small" class="ml-auto" @click="reset">
            <el-icon class="mr-1"><RefreshRight /></el-icon>
            重新选择文件
          </el-button>
        </div>

        <!-- 波形 + 选区 -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-gray-100 px-3 py-2 text-body-sm flex justify-between items-center gap-2 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium">波形（拖拽框选要保留的片段）</span>
              <span class="text-body-xs text-gray-400">滚轮缩放 · Shift+滚轮/触控板横滑平移 · 拖动下方概览条平移</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <el-tag v-if="playing" type="danger" size="small">▶ {{ formatDuration(playheadSec) }}</el-tag>
              <span class="text-gray-500 font-mono">
                {{ formatDuration(selStart) }} → {{ formatDuration(selEnd) }}（{{ formatDuration(Math.max(0, selEnd - selStart)) }}）
              </span>
              <el-button size="small" @click="zoomOut">缩小</el-button>
              <el-button size="small" @click="zoomFit">整曲</el-button>
              <el-button size="small" @click="zoomIn">放大</el-button>
            </div>
          </div>
          <div
            ref="waveWrap"
            class="relative select-none touch-none bg-gray-50"
            :style="{ cursor: waveCursor }"
            @pointerdown="onWaveDown"
            @pointermove="onWaveMove"
            @pointerup="onWaveUp"
            @pointercancel="onWaveUp"
            @pointerleave="dragMode === 'none' && (hoverZone = 'none')"
            @wheel="onWaveWheel"
          >
            <canvas ref="waveCanvas" class="block wave-canvas"></canvas>
            <!-- 选区两侧变暗遮罩 + 选区边框 -->
            <div class="absolute inset-y-0 left-0 bg-ink-900/25 pointer-events-none" :style="{ width: selRatioLeft + '%' }"></div>
            <div
              class="absolute inset-y-0 right-0 bg-ink-900/25 pointer-events-none"
              :style="{ width: Math.max(0, 100 - selRatioLeft - selRatioWidth) + '%' }"
            ></div>
            <div
              class="absolute inset-y-0 pointer-events-none border-x-2 border-accent-600"
              :style="{ left: selRatioLeft + '%', width: selRatioWidth + '%' }"
            ></div>
            <!-- 边缘抓取手柄：可见目标，交互仍由整个波形区的 hitTest 处理 -->
            <div
              v-if="startHandlePct !== null"
              class="absolute inset-y-0 z-[5] pointer-events-none"
              :style="{ left: `calc(${startHandlePct}% - ${EDGE_HANDLE_W / 2}px)`, width: EDGE_HANDLE_W + 'px' }"
            >
              <div class="h-full w-full bg-accent-600/80 rounded-[3px] border-x border-white/70"></div>
            </div>
            <div
              v-if="endHandlePct !== null"
              class="absolute inset-y-0 z-[5] pointer-events-none"
              :style="{ left: `calc(${endHandlePct}% - ${EDGE_HANDLE_W / 2}px)`, width: EDGE_HANDLE_W + 'px' }"
            >
              <div class="h-full w-full bg-accent-600/80 rounded-[3px] border-x border-white/70"></div>
            </div>
            <!-- 播放游标 -->
            <div
              v-if="playing || playheadSec > 0"
              class="absolute inset-y-0 z-10 w-[2px] bg-danger-500 pointer-events-none"
              :style="{ left: playheadLeft + '%' }"
            ></div>
            <div v-if="!waveColumns" class="absolute inset-0 flex items-center justify-center text-gray-400 text-body-sm">
              波形绘制中…
            </div>
          </div>

          <!-- 概览条：全曲峰值 + 视图窗口（点击/拖动平移） -->
          <div
            ref="miniWrap"
            class="relative border-t bg-gray-50 select-none touch-none cursor-pointer"
            @pointerdown="onMiniDown"
            @pointermove="onMiniMove"
            @pointerup="onMiniUp"
            @pointercancel="onMiniUp"
          >
            <canvas ref="miniCanvas" class="block mini-canvas"></canvas>
            <div class="absolute inset-y-0 left-0 bg-ink-900/20 pointer-events-none" :style="{ width: miniViewLeftPct + '%' }"></div>
            <div
              class="absolute inset-y-0 right-0 bg-ink-900/20 pointer-events-none"
              :style="{ width: Math.max(0, 100 - miniViewLeftPct - miniViewWidthPct) + '%' }"
            ></div>
            <div
              class="absolute inset-y-0 pointer-events-none border-x-2 border-accent-600"
              :style="{ left: miniViewLeftPct + '%', width: miniViewWidthPct + '%' }"
            ></div>
            <div
              v-if="playing || playheadSec > 0"
              class="absolute inset-y-0 z-10 w-[2px] bg-danger-500 pointer-events-none"
              :style="{ left: playheadGlobalPct + '%' }"
            ></div>
          </div>
        </div>

        <!-- 选区与播放操作 -->
        <div class="bg-gray-50 rounded-lg p-3 space-y-3">
          <div class="flex items-center gap-x-4 gap-y-2 flex-wrap">
            <span class="text-body-sm text-gray-500">选区开始（秒）：</span>
            <el-input-number v-model="selStart" :min="0" :max="duration" :step="0.1" :precision="2" size="small" class="!w-32" @change="clampSelection" />
            <span class="text-body-sm text-gray-500">结束（秒）：</span>
            <el-input-number v-model="selEnd" :min="0" :max="duration" :step="0.1" :precision="2" size="small" class="!w-32" @change="clampSelection" />
            <el-button size="small" @click="selectAll">全选</el-button>
          </div>
          <div class="flex items-center gap-x-4 gap-y-2 flex-wrap">
            <el-button type="primary" size="small" @click="playing ? stopPlayback() : startPlayback()">
              <el-icon class="mr-1"><component :is="playing ? SwitchButton : VideoPlay" /></el-icon>
              {{ playing ? '停止播放' : '播放' + (selEnd - selStart >= 0.05 ? '选区' : '全部') }}
            </el-button>
            <el-checkbox v-model="loopPlay">选区循环</el-checkbox>
          </div>

          <!-- 淡入淡出 -->
          <div class="flex items-center gap-x-4 gap-y-2 flex-wrap">
            <span class="text-body-sm text-gray-500">淡入（秒）：</span>
            <el-input-number v-model="fadeInSec" :min="0" :max="10" :step="0.5" :precision="1" size="small" class="!w-28" />
            <span class="text-body-sm text-gray-500">淡出（秒）：</span>
            <el-input-number v-model="fadeOutSec" :min="0" :max="10" :step="0.5" :precision="1" size="small" class="!w-28" />
            <span class="text-body-xs text-gray-400">0 = 关闭，仅作用于导出结果</span>
          </div>
        </div>

        <!-- 导出设置 -->
        <div class="bg-gray-50 rounded-lg p-3 space-y-3">
          <div class="flex items-center gap-x-4 gap-y-2 flex-wrap">
            <span class="text-body-sm text-gray-500">导出格式：</span>
            <el-radio-group v-model="format">
              <el-radio-button value="mp3">MP3</el-radio-button>
              <el-radio-button value="ogg">OGG</el-radio-button>
              <el-radio-button value="wav">WAV</el-radio-button>
            </el-radio-group>

            <template v-if="format === 'mp3'">
              <span class="text-body-sm text-gray-500">码率：</span>
              <el-select v-model="mp3Bitrate" class="!w-32">
                <el-option label="128 kbps" :value="128" />
                <el-option label="192 kbps" :value="192" />
                <el-option label="256 kbps" :value="256" />
                <el-option label="320 kbps" :value="320" />
              </el-select>
            </template>
            <template v-else-if="format === 'ogg'">
              <span class="text-body-sm text-gray-500">质量（VBR）：</span>
              <el-select v-model="oggQuality" class="!w-40">
                <el-option label="标准（约 128k）" :value="4" />
                <el-option label="高（约 192k）" :value="6" />
                <el-option label="极高（约 256k）" :value="8" />
              </el-select>
            </template>
            <template v-else>
              <span class="text-body-xs text-gray-400">WAV 为无损 16-bit PCM，文件较大</span>
            </template>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <el-button type="primary" :disabled="!canExport" :loading="exporting" @click="startExport">
              <el-icon v-if="!exporting" class="mr-1"><Download /></el-icon>
              {{ exporting ? '导出中 ' + Math.round(exportProgress * 100) + '%' : '导出选区音频' }}
            </el-button>
            <el-progress
              v-if="exporting"
              :percentage="Math.round(exportProgress * 100)"
              class="!w-48"
            />
          </div>

          <!-- 结果 -->
          <div v-if="resultUrl" class="space-y-2">
            <div class="flex items-center gap-2 flex-wrap text-body-sm">
              <el-tag type="success" size="small">{{ resultExt.toUpperCase() }} {{ formatSize(resultBytes) }}</el-tag>
              <el-tag size="small">时长 {{ formatDuration(resultDurationSec) }}</el-tag>
              <el-button size="small" type="primary" @click="download">
                <el-icon class="mr-1"><Download /></el-icon>
                下载
              </el-button>
            </div>
            <audio :src="resultUrl" controls class="w-full" playsinline></audio>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else-if="!decoding" class="flex items-center justify-center min-h-[80px]">
        <span class="text-body-sm text-gray-400">上传音频后即可在此裁剪、试听与导出</span>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="工具说明">
      <div class="space-y-3">
        <el-text>
          <strong>裁剪流程：</strong>上传音频后自动绘制波形，在波形上拖拽框选要保留的片段（也可直接输入起止秒数）；滚轮缩放波形（Shift+滚轮平移，也可拖动下方概览条），点击播放可试听选区，开启「选区循环」可反复试听衔接效果。
        </el-text>
        <el-divider />
        <el-text>
          <strong>淡入淡出：</strong>设置秒数后仅作用于导出结果，开头/结尾按线性增益渐变，0 表示关闭。适合制作手机铃声的出入场过渡。
        </el-text>
        <el-divider />
        <el-text>
          <strong>导出格式：</strong>MP3（CBR 128~320 kbps）与 OGG（Vorbis VBR）经 WebAssembly 编码器本地生成，WAV 为无损 16-bit PCM；时长不限，取决于设备内存。
        </el-text>
        <el-divider />
        <el-text>
          <strong>隐私安全：</strong>解码、裁剪、编码全部在浏览器本地完成，音频不会上传服务器。
        </el-text>
        <el-divider />
        <el-text>
          <strong>兼容说明：</strong>需要支持 Web Audio API 的现代浏览器；M4A/AAC/FLAC 等格式的解码依赖浏览器自身能力（Chrome / Edge / Firefox / Safari 支持范围略有差异），解码失败时可先转为 MP3 或 WAV 再处理。
        </el-text>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
:deep(.el-upload) {
  width: 100%;
}
:deep(.el-upload-dragger) {
  width: 100%;
}
.audio-clipper-page .wave-canvas {
  height: 120px;
}
.audio-clipper-page .mini-canvas {
  height: 28px;
}
</style>

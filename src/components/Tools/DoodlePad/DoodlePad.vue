<script setup lang="ts">
/**
 * 在线涂鸦画板
 * --------------------------------------------------------
 * - 画笔 / 橡皮 两种工具
 * - 颜色：8 色预设 + 自定义颜色拾取器
 * - 画笔粗细：1~60 px 滑块
 * - 画布尺寸：宽度 × 高度可调，最大 1600×1200
 * - 画布底色：可设置（白/黑/透明 等）
 * - 历史记录：基于快照的撤销/重做，最多 30 步
 * - 导出：下载 PNG / 复制到剪贴板
 * - 全部纯前端，使用 HTML5 Canvas，离线可用，隐私安全
 */
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

// ============================================================
// 工具类型
// ============================================================
type Tool = 'brush' | 'eraser'

// 预设颜色（8 色常用 + 黑/白 + 透明画布色）
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
// 画布状态
// ============================================================
const canvasWidth = ref(800)        // 画布宽度 (px)
const canvasHeight = ref(600)       // 画布高度 (px)
const canvasBg = ref<string>('#FFFFFF')  // 画布背景色
const transparentBg = ref(false)    // 画布是否透明

const tool = ref<Tool>('brush')
const color = ref<string>('#000000') // 当前画笔颜色
const brushSize = ref<number>(6)     // 画笔粗细
const eraserSize = ref<number>(20)   // 橡皮粗细

// ============================================================
// 画布引用 / 上下文
// ============================================================
const canvasEl = ref<HTMLCanvasElement | null>(null)
const wrapEl = ref<HTMLDivElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null

// ============================================================
// 绘制状态
// ============================================================
let drawing = false
let lastX = 0
let lastY = 0

// ============================================================
// 历史记录（快照栈）
// ============================================================
const history = ref<string[]>([])
const redoStack = ref<string[]>([])
const MAX_HISTORY = 30

// 缩放显示比例：让大画布能放进容器
const displayScale = ref(1)

// ============================================================
// 预设尺寸
// ============================================================
const SIZE_PRESETS = [
  { label: '640×480',   w: 640,  h: 480  },
  { label: '800×600',   w: 800,  h: 600  },
  { label: '1024×768',  w: 1024, h: 768  },
  { label: '1280×720',  w: 1280, h: 720  },
  { label: '1920×1080', w: 1920, h: 1080 },
]

// ============================================================
// 计算属性
// ============================================================
const canUndo = computed(() => history.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)

// ============================================================
// 初始化画布
// ============================================================
function initCanvas() {
  const cv = canvasEl.value
  if (!cv) return
  ctx = cv.getContext('2d')
  if (!ctx) return

  // 高分屏适配
  const dpr = window.devicePixelRatio || 1
  cv.width = canvasWidth.value * dpr
  cv.height = canvasHeight.value * dpr
  cv.style.width = `${canvasWidth.value}px`
  cv.style.height = `${canvasHeight.value}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  fillBackground()

  // 清空历史
  history.value = []
  redoStack.value = []
  pushHistory()
}

function fillBackground() {
  if (!ctx) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0) // 用像素坐标画底
  if (transparentBg.value) {
    ctx.clearRect(0, 0, canvasEl.value!.width, canvasEl.value!.height)
  } else {
    ctx.fillStyle = canvasBg.value
    ctx.fillRect(0, 0, canvasEl.value!.width, canvasEl.value!.height)
  }
  ctx.restore()
}

// 监听背景变化重绘
watch([canvasBg, transparentBg], () => {
  if (!ctx) return
  // 重绘背景会清空画布——只有当历史为空时才允许
  if (history.value.length <= 1) {
    fillBackground()
  }
})

// 监听尺寸变化
watch([canvasWidth, canvasHeight], () => {
  // 尺寸变化时初始化（保留当前绘制会丢失，提示用户）
  ElMessageBox.confirm(
    '修改画布尺寸会清空当前绘制内容，确定继续？',
    '修改画布尺寸',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
  ).then(() => {
    nextTick(() => initCanvas())
  }).catch(() => {
    // 取消：还原
    canvasWidth.value = canvasEl.value?.width
      ? (canvasEl.value.width / (window.devicePixelRatio || 1))
      : canvasWidth.value
  })
})

// ============================================================
// 鼠标 / 触摸事件
// ============================================================
function getPoint(e: MouseEvent | TouchEvent) {
  const cv = canvasEl.value
  if (!cv) return { x: 0, y: 0 }
  const rect = cv.getBoundingClientRect()
  let clientX = 0
  let clientY = 0
  if ('touches' in e) {
    if (e.touches.length === 0) return { x: 0, y: 0 }
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else {
    clientX = e.clientX
    clientY = e.clientY
  }
  // 转换到画布坐标系（考虑 displayScale）
  return {
    x: (clientX - rect.left) / displayScale.value,
    y: (clientY - rect.top) / displayScale.value,
  }
}

function onPointerDown(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  drawing = true
  const p = getPoint(e)
  lastX = p.x
  lastY = p.y
  // 单点点一下也算一笔：画一个圆点
  drawSegment(lastX, lastY, lastX, lastY)
}

function onPointerMove(e: MouseEvent | TouchEvent) {
  if (!drawing) return
  e.preventDefault()
  const p = getPoint(e)
  drawSegment(lastX, lastY, p.x, p.y)
  lastX = p.x
  lastY = p.y
}

function onPointerUp() {
  if (!drawing) return
  drawing = false
  pushHistory()
}

function onPointerLeave() {
  if (drawing) {
    drawing = false
    pushHistory()
  }
}

function drawSegment(x0: number, y0: number, x1: number, y1: number) {
  if (!ctx) return
  ctx.save()
  if (tool.value === 'brush') {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = color.value
    ctx.lineWidth = brushSize.value
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  } else {
    // 橡皮：用 destination-out 清掉像素，保留背景色（通过合成实现）
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = eraserSize.value
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  // 在起点画一个圆点，避免线段起点有缺口
  ctx.beginPath()
  ctx.arc(x1, y1, (tool.value === 'brush' ? brushSize.value : eraserSize.value) / 2, 0, Math.PI * 2)
  ctx.fillStyle = tool.value === 'brush' ? color.value : 'rgba(0,0,0,1)'
  ctx.fill()
  ctx.restore()
}

// ============================================================
// 历史快照
// ============================================================
function pushHistory() {
  const cv = canvasEl.value
  if (!cv) return
  try {
    const snap = cv.toDataURL('image/png')
    // 如果和最后一次一样就不入栈
    if (history.value.length > 0 && history.value[history.value.length - 1] === snap) return
    history.value.push(snap)
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }
    // 新动作清空 redo 栈
    redoStack.value = []
  } catch (e) {
    console.warn('快照保存失败', e)
  }
}

function restoreFromDataURL(url: string) {
  const cv = canvasEl.value
  if (!cv || !ctx) return
  const img = new Image()
  img.onload = () => {
    ctx!.clearRect(0, 0, cv.width, cv.height)
    // 因为 cv.width/height 已经是 dpr 缩放后的，这里直接绘制到像素区
    ctx!.drawImage(img, 0, 0, cv.width, cv.height)
  }
  img.src = url
}

function undo() {
  if (history.value.length <= 1) return
  const current = history.value.pop()!
  redoStack.value.push(current)
  const prev = history.value[history.value.length - 1]
  restoreFromDataURL(prev)
}

function redo() {
  if (redoStack.value.length === 0) return
  const next = redoStack.value.pop()!
  history.value.push(next)
  restoreFromDataURL(next)
}

function clearCanvas() {
  if (!ctx || !canvasEl.value) return
  fillBackground()
  pushHistory()
}

// ============================================================
// 下载 / 复制
// ============================================================
function downloadPNG() {
  const cv = canvasEl.value
  if (!cv) return
  // 使用一个临时 canvas 来合并透明背景（如果需要）
  const out = document.createElement('canvas')
  out.width = cv.width
  out.height = cv.height
  const outCtx = out.getContext('2d')!
  if (!transparentBg.value) {
    outCtx.fillStyle = canvasBg.value
    outCtx.fillRect(0, 0, out.width, out.height)
  }
  outCtx.drawImage(cv, 0, 0)
  out.toBlob((blob) => {
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
  const cv = canvasEl.value
  if (!cv) return
  // Clipboard API 暂不支持直接复制 canvas（Safari 部分版本除外），需要先 toBlob
  try {
    const blob: Blob | null = await new Promise((resolve) => {
      // 带背景合并
      const out = document.createElement('canvas')
      out.width = cv.width
      out.height = cv.height
      const outCtx = out.getContext('2d')!
      if (!transparentBg.value) {
        outCtx.fillStyle = canvasBg.value
        outCtx.fillRect(0, 0, out.width, out.height)
      }
      outCtx.drawImage(cv, 0, 0)
      out.toBlob((b) => resolve(b), 'image/png')
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
// 自动适配显示缩放（让大画布适应容器宽度）
// ============================================================
function updateDisplayScale() {
  const cv = canvasEl.value
  const wrap = wrapEl.value
  if (!cv || !wrap) return
  const containerWidth = wrap.clientWidth - 32 // padding
  const ratio = Math.min(1, containerWidth / canvasWidth.value)
  displayScale.value = ratio
  cv.style.width = `${canvasWidth.value * ratio}px`
  cv.style.height = `${canvasHeight.value * ratio}px`
}

// ============================================================
// 生命周期
// ============================================================
onMounted(() => {
  initCanvas()
  updateDisplayScale()
  window.addEventListener('resize', updateDisplayScale)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateDisplayScale)
})

// ============================================================
// 工具切换 / 预设选择
// ============================================================
function applySizePreset(w: number, h: number) {
  if (w === canvasWidth.value && h === canvasHeight.value) return
  ElMessageBox.confirm(
    '切换预设尺寸会清空当前绘制内容，确定继续？',
    '切换尺寸',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
  ).then(() => {
    canvasWidth.value = w
    canvasHeight.value = h
    nextTick(() => {
      initCanvas()
      updateDisplayScale()
    })
  }).catch(() => {})
}

function onColorPickerInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  color.value = v
}

function onBgColorPickerInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  canvasBg.value = v
}

function pickPresetColor(c: string) {
  color.value = c
  // 选了白色自动切到画笔工具，避免误以为是橡皮
  if (tool.value !== 'brush') tool.value = 'brush'
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="在线涂鸦画板" />

    <!-- 工具栏 -->
    <div class="p-4 rounded-2xl bg-white shadow-sm border border-slate-200 mb-3 space-y-3">
      <!-- 工具 + 颜色 -->
      <div class="flex flex-wrap items-center gap-4">
        <!-- 工具切换 -->
        <div class="flex items-center gap-2">
          <span class="text-body-sm text-slate-600">工具</span>
          <el-radio-group v-model="tool" size="default">
            <el-radio-button label="brush">✏️ 画笔</el-radio-button>
            <el-radio-button label="eraser">🩹 橡皮</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 颜色预设 -->
        <div class="flex items-center gap-2">
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
        <div v-show="tool === 'eraser'" class="flex items-center gap-2 min-w-[200px]">
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

      <!-- 尺寸 + 背景 + 操作 -->
      <div class="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100">
        <!-- 尺寸 -->
        <div class="flex items-center gap-2">
          <span class="text-body-sm text-slate-600">尺寸</span>
          <el-input-number
            v-model="canvasWidth"
            :min="100"
            :max="1920"
            :step="10"
            size="default"
            controls-position="right"
            class="!w-28"
          />
          <span class="text-slate-400">×</span>
          <el-input-number
            v-model="canvasHeight"
            :min="100"
            :max="1920"
            :step="10"
            size="default"
            controls-position="right"
            class="!w-28"
          />
          <!-- 预设 -->
          <el-dropdown trigger="click">
            <el-button size="default">
              预设 ▾
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="p in SIZE_PRESETS"
                  :key="p.label"
                  @click="applySizePreset(p.w, p.h)"
                >
                  {{ p.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

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

    <!-- 画布区 -->
    <div
      ref="wrapEl"
      class="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-inner overflow-auto"
      style="min-height: 400px;"
    >
      <div class="flex items-center justify-center w-full">
        <canvas
          ref="canvasEl"
          class="bg-white shadow-lg rounded-md cursor-crosshair touch-none"
          style="image-rendering: pixelated;"
          @mousedown="onPointerDown"
          @mousemove="onPointerMove"
          @mouseup="onPointerUp"
          @mouseleave="onPointerLeave"
          @touchstart="onPointerDown"
          @touchmove="onPointerMove"
          @touchend="onPointerUp"
          @touchcancel="onPointerLeave"
        ></canvas>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <el-text>
        <p>在线涂鸦画板是一款纯前端的网页画图工具，支持鼠标和触摸操作，适合随手涂鸦、画示意图、做标记等场景。</p>
        <p><b>核心功能：</b></p>
        <ul class="list-disc pl-6 space-y-1">
          <li><b>画笔</b>：自由选择颜色（10 种预设 + 拾色器）和粗细（1~60px），鼠标按下拖动即可绘制</li>
          <li><b>橡皮</b>：基于合成运算实现，可调节大小（4~80px），不影响画布背景色</li>
          <li><b>撤销 / 重做</b>：最多保存 30 步历史记录，可一键返回或恢复</li>
          <li><b>画布尺寸</b>：宽度 / 高度可调（100~1920px），内置 5 种常用预设（640×480、800×600、1024×768、1280×720、1920×1080）</li>
          <li><b>画布底色</b>：可设为任意颜色，或勾选「透明背景」用于导出 PNG 透明图层</li>
          <li><b>导出</b>：一键下载 PNG 到本地，或复制到剪贴板直接粘贴到聊天软件</li>
        </ul>
        <p><b>使用技巧：</b></p>
        <ul class="list-disc pl-6 space-y-1">
          <li>手机 / 平板可直接用手指在画布上涂鸦</li>
          <li>选择「透明背景」+ 橡皮组合，可以做出镂空效果的图层</li>
          <li>大尺寸画布会自动等比缩放显示，导出时按原始尺寸保存，不会模糊</li>
          <li>所有操作均在浏览器本地完成，作品不会上传到服务器，隐私安全</li>
        </ul>
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 画板在画笔工具时光标显示十字，橡皮工具时也用十字 */
canvas {
  display: block;
  max-width: 100%;
}
</style>
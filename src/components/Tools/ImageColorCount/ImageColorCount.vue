<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const info = reactive({ title: '图片颜色数统计' })

// ---------- 状态 ----------
interface ColorEntry {
  key: string          // rgba 字符串
  r: number
  g: number
  b: number
  a: number
  count: number
  hex: string          // #rrggbb
  hexWithAlpha: string // #rrggbbaa
}

const isDragOver = ref(false)
const isAnalyzing = ref(false)
const imagePreview = ref<string>('')       // dataURL 或 URL
const imageName = ref<string>('')
const imageSize = ref<number>(0)
const imageDims = reactive({ w: 0, h: 0 })

const sampledPixels = ref(0)
const totalPixels = ref(0)
const uniqueColors = ref(0)
const elapsedMs = ref(0)
const topColors = ref<ColorEntry[]>([])
const transparentCount = ref(0)

const options = reactive({
  sampleStep: 1,         // 1=全采样；2=每隔一个像素；4=每隔三个像素
  bitsPerChannel: 8,     // 颜色量化位数；8=不量化；4=每通道 16 档；2=每通道 4 档
  ignoreTransparent: true,
  topN: 20,
})

const sampleStepOptions = [
  { label: '全采样（精确）', value: 1 },
  { label: '每 2×2 采 1 个', value: 2 },
  { label: '每 4×4 采 1 个', value: 4 },
  { label: '每 8×8 采 1 个', value: 8 },
]

const bitsOptions = [
  { label: '8 bit（精确）', value: 8 },
  { label: '6 bit', value: 6 },
  { label: '4 bit', value: 4 },
  { label: '3 bit', value: 3 },
  { label: '2 bit', value: 2 },
]

// ---------- 文件上传 ----------
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const handleFileUpload = (file: File) => {
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  imageName.value = file.name
  imageSize.value = file.size

  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string
    analyze()
  }
  reader.onerror = () => ElMessage.error('读取图片失败')
  reader.readAsDataURL(file)
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}
const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
}
const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) handleFileUpload(files[0])
}
const handleFileSelect = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (files && files.length > 0) handleFileUpload(files[0])
}

// ---------- 颜色量化 ----------
// 把 8 位通道值量化到指定位数
const quantizeChannel = (v: number, bits: number): number => {
  if (bits >= 8) return v
  const step = 256 / (1 << bits)
  // 量化到最近的档位
  return Math.min(255, Math.floor(v / step) * step)
}

// ---------- 分析 ----------
const analyze = async () => {
  if (!imagePreview.value) return
  isAnalyzing.value = true
  // 让 UI 有机会更新到 loading 状态
  await new Promise((r) => requestAnimationFrame(() => r(null)))

  try {
    const t0 = performance.now()
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = imagePreview.value
    })

    imageDims.w = img.naturalWidth
    imageDims.h = img.naturalHeight

    // 用离屏 canvas 取像素；尺寸与原图一致
    const canvas = document.createElement('canvas')
    canvas.width = imageDims.w
    canvas.height = imageDims.h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      ElMessage.error('浏览器不支持 Canvas 2D')
      return
    }
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, imageDims.w, imageDims.h)

    const counts = new Map<string, number>()
    let sampled = 0
    let transparent = 0
    const step = Math.max(1, options.sampleStep | 0)
    const bits = Math.min(8, Math.max(1, options.bitsPerChannel | 0))
    const ignoreTrans = options.ignoreTransparent

    for (let y = 0; y < imageDims.h; y += step) {
      for (let x = 0; x < imageDims.w; x += step) {
        const i = (y * imageDims.w + x) * 4
        const r0 = data[i]
        const g0 = data[i + 1]
        const b0 = data[i + 2]
        const a0 = data[i + 3]
        sampled++
        if (a0 === 0) {
          transparent++
          if (ignoreTrans) continue
        }
        const r = quantizeChannel(r0, bits)
        const g = quantizeChannel(g0, bits)
        const b = quantizeChannel(b0, bits)
        const key = `${r},${g},${b},${a0}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }

    const allEntries: ColorEntry[] = []
    for (const [key, count] of counts) {
      const [r, g, b, a] = key.split(',').map(Number)
      allEntries.push({
        key,
        r,
        g,
        b,
        a,
        count,
        hex: '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''),
        hexWithAlpha: '#' + [r, g, b, a].map((v) => v.toString(16).padStart(2, '0')).join(''),
      })
    }
    allEntries.sort((a, b) => b.count - a.count)

    sampledPixels.value = sampled
    totalPixels.value = imageDims.w * imageDims.h
    uniqueColors.value = allEntries.length
    transparentCount.value = transparent
    topColors.value = allEntries.slice(0, options.topN)
    elapsedMs.value = Math.round(performance.now() - t0)
  } catch (err) {
    console.error(err)
    ElMessage.error((err as Error).message || '分析失败')
  } finally {
    isAnalyzing.value = false
  }
}

// ---------- 重新分析（参数变化时） ----------
const reAnalyze = () => {
  if (imagePreview.value) analyze()
}

// ---------- 导出 ----------
const buildExportText = (format: 'json' | 'csv') => {
  if (format === 'json') {
    const payload = topColors.value.map((c) => ({
      hex: c.hex,
      hexWithAlpha: c.hexWithAlpha,
      r: c.r,
      g: c.g,
      b: c.b,
      a: c.a,
      count: c.count,
      percent: ((c.count / sampledPixels.value) * 100).toFixed(4) + '%',
    }))
    return JSON.stringify(
      {
        image: imageName.value,
        width: imageDims.w,
        height: imageDims.h,
        totalPixels: totalPixels.value,
        sampledPixels: sampledPixels.value,
        uniqueColors: uniqueColors.value,
        sampleStep: options.sampleStep,
        bitsPerChannel: options.bitsPerChannel,
        ignoreTransparent: options.ignoreTransparent,
        elapsedMs: elapsedMs.value,
        topColors: payload,
      },
      null,
      2,
    )
  }
  const lines = ['hex,rgba,count,percent']
  for (const c of topColors.value) {
    const pct = ((c.count / sampledPixels.value) * 100).toFixed(4)
    lines.push(`${c.hex},rgba(${c.r},${c.g},${c.b},${c.a}),${c.count},${pct}%`)
  }
  return lines.join('\n')
}

const downloadExport = (format: 'json' | 'csv') => {
  const text = buildExportText(format)
  const blob = new Blob([text], { type: format === 'json' ? 'application/json' : 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const base = imageName.value.replace(/\.[^.]+$/, '') || 'palette'
  a.href = url
  a.download = `${base}-palette.${format}`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${format.toUpperCase()}`)
}

const copyHexList = async () => {
  if (!topColors.value.length) return
  const text = topColors.value.map((c) => c.hex).join('\n')
  await copy(text)
  ElMessage.success('Top 颜色 hex 已复制')
}

const clearAll = () => {
  imagePreview.value = ''
  imageName.value = ''
  imageSize.value = 0
  imageDims.w = 0
  imageDims.h = 0
  sampledPixels.value = 0
  totalPixels.value = 0
  uniqueColors.value = 0
  transparentCount.value = 0
  topColors.value = []
  elapsedMs.value = 0
}

// ---------- 派生 ----------
const ratio = computed(() => {
  if (!sampledPixels.value) return 0
  return Math.min(1, sampledPixels.value / Math.max(1, totalPixels.value))
})

const sampleRateLabel = computed(() => {
  const s = options.sampleStep
  if (s <= 1) return '全采样'
  return `1/${s * s}`
})
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm border border-gray-200">
      <div class="max-w-3xl mx-auto">
        <!-- 上传区 -->
        <div
          class="border-2 border-dashed rounded-lg p-6 text-center transition-colors relative"
          :class="isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <div v-if="isAnalyzing" class="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p class="text-gray-600">正在分析像素颜色...</p>
            </div>
          </div>

          <div v-if="!imagePreview" class="space-y-3">
            <div class="text-gray-400">
              <svg class="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <p class="font-medium text-gray-900">拖拽图片到此处或点击上传</p>
            <p class="text-sm text-gray-500">支持 JPG / PNG / GIF / WebP 等格式</p>
            <label class="inline-block cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              选择图片
              <input type="file" accept="image/*" class="hidden" @change="handleFileSelect" />
            </label>
          </div>

          <div v-else class="flex flex-col items-center gap-3">
            <img
              :src="imagePreview"
              alt="预览"
              class="max-h-48 max-w-full rounded border border-gray-200 shadow-sm"
            />
            <div class="text-sm text-gray-600">
              {{ imageName }}　·　{{ formatFileSize(imageSize) }}　·　{{ imageDims.w }}×{{ imageDims.h }}
            </div>
            <div class="flex gap-2">
              <label class="cursor-pointer bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors text-sm">
                重新选择
                <input type="file" accept="image/*" class="hidden" @change="handleFileSelect" />
              </label>
              <button
                @click="clearAll"
                class="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300 transition-colors text-sm"
              >
                清空
              </button>
            </div>
          </div>
        </div>

        <!-- 分析选项 -->
        <div v-if="imagePreview" class="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <h3 class="text-sm font-medium text-gray-700 mb-2">采样步长</h3>
            <el-select v-model="options.sampleStep" size="small" class="w-full" @change="reAnalyze">
              <el-option v-for="o in sampleStepOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <p class="text-xs text-gray-500 mt-1">步长越大越快，但会丢失细节</p>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <h3 class="text-sm font-medium text-gray-700 mb-2">颜色量化（每通道 bit）</h3>
            <el-select v-model="options.bitsPerChannel" size="small" class="w-full" @change="reAnalyze">
              <el-option v-for="o in bitsOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <p class="text-xs text-gray-500 mt-1">低位会把相近颜色合并</p>
          </div>
          <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <h3 class="text-sm font-medium text-gray-700 mb-2">Top N</h3>
            <el-input-number v-model="options.topN" :min="1" :max="100" size="small" class="w-full" @change="reAnalyze" />
            <p class="text-xs text-gray-500 mt-1">展示前 N 种出现最多的颜色</p>
          </div>
        </div>

        <div v-if="imagePreview" class="mt-3 flex items-center gap-3">
          <el-checkbox v-model="options.ignoreTransparent" @change="reAnalyze">
            忽略完全透明像素（alpha=0）
          </el-checkbox>
        </div>

        <!-- 统计结果 -->
        <div v-if="imagePreview && !isAnalyzing && sampledPixels" class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="text-center bg-amber-50 p-3 rounded-lg border border-amber-200">
            <h3 class="text-sm font-medium text-amber-900">唯一颜色数</h3>
            <p class="text-xl font-bold text-amber-600">{{ uniqueColors.toLocaleString() }}</p>
          </div>
          <div class="text-center bg-blue-50 p-3 rounded-lg border border-blue-200">
            <h3 class="text-sm font-medium text-blue-900">采样像素</h3>
            <p class="text-xl font-bold text-blue-600">
              {{ sampledPixels.toLocaleString() }}
              <span class="text-xs text-blue-400 font-normal">
                ({{ sampleRateLabel }})
              </span>
            </p>
          </div>
          <div class="text-center bg-purple-50 p-3 rounded-lg border border-purple-200">
            <h3 class="text-sm font-medium text-purple-900">总像素</h3>
            <p class="text-xl font-bold text-purple-600">
              {{ totalPixels.toLocaleString() }}
            </p>
          </div>
          <div class="text-center bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <h3 class="text-sm font-medium text-emerald-900">耗时</h3>
            <p class="text-xl font-bold text-emerald-600">{{ elapsedMs }} ms</p>
          </div>
        </div>

        <div v-if="transparentCount > 0" class="mt-3 text-sm text-gray-500">
          其中完全透明像素：{{ transparentCount.toLocaleString() }}（
          {{ options.ignoreTransparent ? '已忽略，不计入颜色统计' : '已计入颜色统计' }}）
        </div>

        <!-- 采样进度条 -->
        <div v-if="ratio < 1 && sampledPixels" class="mt-2 h-1.5 bg-gray-200 rounded overflow-hidden">
          <div class="h-full bg-blue-500" :style="{ width: ratio * 100 + '%' }"></div>
        </div>

        <!-- Top N 调色板 -->
        <div v-if="topColors.length" class="mt-6">
          <div class="flex flex-wrap items-center justify-between mb-3 gap-2">
            <h3 class="text-lg font-medium text-gray-900">
              Top {{ topColors.length }} 颜色（按出现次数）
            </h3>
            <div class="flex gap-2">
              <el-button size="small" type="primary" plain @click="copyHexList">复制 hex</el-button>
              <el-button size="small" type="success" plain @click="downloadExport('json')">导出 JSON</el-button>
              <el-button size="small" type="warning" plain @click="downloadExport('csv')">导出 CSV</el-button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div
              v-for="(c, idx) in topColors"
              :key="c.key + idx"
              class="flex items-center gap-3 p-2 bg-gray-50 rounded border border-gray-200"
            >
              <div
                class="w-10 h-10 rounded border border-gray-300 flex-shrink-0"
                :style="{ backgroundColor: c.hexWithAlpha }"
                :title="c.hexWithAlpha"
              ></div>
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2">
                  <span class="font-mono font-medium text-gray-900">{{ c.hex }}</span>
                  <span v-if="c.a < 255" class="text-xs text-gray-500">α={{ c.a }}</span>
                </div>
                <div class="text-xs text-gray-500 truncate">
                  rgb({{ c.r }}, {{ c.g }}, {{ c.b }}) · {{ c.count.toLocaleString() }} px ·
                  <span class="font-medium text-gray-700">
                    {{ ((c.count / sampledPixels) * 100).toFixed(2) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 提示信息 -->
        <div v-else-if="imagePreview && !isAnalyzing" class="mt-6 text-center text-gray-500 text-sm">
          {{ uniqueColors === 0 ? '点击"重新选择"或调整参数后开始分析' : '' }}
        </div>
      </div>
    </div>

    <ToolDetail title="工具说明">
      <el-text>
        <strong>本工具可以做什么：</strong>统计一张图片中出现了多少种不同的颜色（基于像素的 RGBA 值），并按出现次数排序展示前 N 种颜色，支持 JSON / CSV 导出与 hex 复制，方便设计稿取色、查找重复颜色、估算调色板大小等场景。
      </el-text>
      <el-divider />
      <el-text>
        <strong>关键参数说明：</strong>
        <ul class="list-disc list-inside mt-2 ml-4 space-y-1">
          <li><b>采样步长</b>：1 = 逐像素统计（最精确，但大图较慢）；2/4/8 表示每隔 1/3/7 个像素取一个样本，可大幅缩短分析时间。</li>
          <li><b>颜色量化（每通道 bit）</b>：8 bit = 原始精度；4 bit 表示把每通道 0–255 合并到 16 档，相近的颜色会被合并成一个，从而得到"视觉上接近"的去重调色板。</li>
          <li><b>忽略完全透明像素</b>：勾选后 alpha=0 的像素不计入颜色统计（适合带透明区域的 PNG、图标）。</li>
          <li><b>Top N</b>：控制右侧调色板展示的颜色数。</li>
        </ul>
      </el-text>
      <el-divider />
      <el-text>
        <strong>常见用途：</strong>
        <ul class="list-disc list-inside mt-2 ml-4 space-y-1">
          <li>设计稿 / 插画的实际配色数估算</li>
          <li>判断一张图片是否为纯色 / 少色图（如 logo、图标）</li>
          <li>查找重复出现的颜色用于压缩或简化</li>
          <li>导出当前图片的主色调作为配色参考</li>
        </ul>
      </el-text>
      <el-divider />
      <el-text class="text-gray-500">
        <strong>隐私说明：</strong>所有处理均在浏览器本地完成，图片不会上传到任何服务器。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped></style>

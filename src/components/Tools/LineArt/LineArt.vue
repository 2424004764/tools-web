<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: '图片转线稿图',
})

interface LineArtItem {
  id: string
  name: string
  originalUrl: string
  resultUrl: string
  width: number
  height: number
  processing: boolean
  img: HTMLImageElement
}

// 参数
const config = reactive({
  strength: 1.4, // 线条强度（越大线条越深）
  radius: 6, // 线条粗细 / 细节（模糊半径）
  invert: false, // 反色（黑底白线）
})

const items = ref<LineArtItem[]>([])
const isDragging = ref(false)

let idSeed = 0
const genId = () => `${Date.now()}_${idSeed++}`

// —— 核心算法：铅笔线稿（灰度 -> 反相 -> 高斯模糊 -> 颜色减淡混合） ——

// 单通道盒状模糊（多次叠加近似高斯），in/out 为 Float32Array，长度 w*h
const boxBlur = (src: Float32Array, w: number, h: number, radius: number): Float32Array => {
  if (radius < 1) return src
  const r = Math.round(radius)
  let cur = src
  // 迭代 3 次以逼近高斯
  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Float32Array(w * h)
    // 水平
    for (let y = 0; y < h; y++) {
      const row = y * w
      let sum = 0
      for (let x = -r; x <= r; x++) {
        sum += cur[row + Math.min(w - 1, Math.max(0, x))]
      }
      const div = r * 2 + 1
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum / div
        const addIdx = row + Math.min(w - 1, x + r + 1)
        const subIdx = row + Math.max(0, x - r)
        sum += cur[addIdx] - cur[subIdx]
      }
    }
    const out = new Float32Array(w * h)
    // 垂直
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let y = -r; y <= r; y++) {
        sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
      }
      const div = r * 2 + 1
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / div
        const addIdx = Math.min(h - 1, y + r + 1) * w + x
        const subIdx = Math.max(0, y - r) * w + x
        sum += tmp[addIdx] - tmp[subIdx]
      }
    }
    cur = out
  }
  return cur
}

// 将一张图片转换为线稿，返回 dataURL
const toLineArt = (img: HTMLImageElement): string => {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  const n = w * h

  const gray = new Float32Array(n)
  const inv = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    const g = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    gray[i] = g
    inv[i] = 255 - g
  }

  const blurred = boxBlur(inv, w, h, config.radius)

  const k = config.strength
  for (let i = 0; i < n; i++) {
    const b = blurred[i]
    // 颜色减淡：base / (1 - blend)
    let v = b >= 255 ? 255 : (gray[i] * 255) / (255 - b)
    if (v > 255) v = 255
    // 线条强度：加深暗部
    let d = (255 - v) * k
    v = 255 - d
    if (v < 0) v = 0
    if (v > 255) v = 255
    if (config.invert) v = 255 - v
    const p = i * 4
    data[p] = data[p + 1] = data[p + 2] = v
    data[p + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

const processItem = (item: LineArtItem) => {
  item.processing = true
  // 让 UI 有机会渲染 loading 状态
  requestAnimationFrame(() => {
    try {
      item.resultUrl = toLineArt(item.img)
    } catch (e) {
      console.error('线稿转换失败:', e)
    } finally {
      item.processing = false
    }
  })
}

const reprocessAll = () => {
  items.value.forEach(processItem)
}

// —— 输入：文件 / 拖拽 / 粘贴 ——

const loadFile = (file: File) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    const item: LineArtItem = {
      id: genId(),
      name: file.name || `粘贴图片_${genId()}.png`,
      originalUrl: url,
      resultUrl: '',
      width: img.naturalWidth,
      height: img.naturalHeight,
      processing: true,
      img,
    }
    items.value.push(item)
    // 使用响应式代理对象进行处理，确保 processing/resultUrl 变更能触发视图更新
    processItem(items.value[items.value.length - 1])
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
  }
  img.src = url
}

const addFiles = (files: FileList | File[] | null) => {
  if (!files) return
  const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (imgs.length === 0) return
  imgs.forEach(loadFile)
}

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  addFiles(input.files)
  input.value = ''
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  addFiles(e.dataTransfer?.files || null)
}
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}
const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}

const onPaste = (e: ClipboardEvent) => {
  const itemsList = e.clipboardData?.items
  if (!itemsList) return
  const files: File[] = []
  for (let i = 0; i < itemsList.length; i++) {
    const it = itemsList[i]
    if (it.type.startsWith('image/')) {
      const f = it.getAsFile()
      if (f) files.push(f)
    }
  }
  if (files.length) {
    e.preventDefault()
    addFiles(files)
  }
}

// —— 输出 ——

const downloadItem = (item: LineArtItem) => {
  if (!item.resultUrl) return
  const link = document.createElement('a')
  link.href = item.resultUrl
  const base = item.name.replace(/\.[^.]+$/, '')
  link.download = `lineart_${base}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const downloadAll = () => {
  items.value.forEach((item) => item.resultUrl && downloadItem(item))
}

const removeItem = (id: string) => {
  const idx = items.value.findIndex((i) => i.id === id)
  if (idx !== -1) {
    URL.revokeObjectURL(items.value[idx].originalUrl)
    items.value.splice(idx, 1)
  }
}

const clearAll = () => {
  items.value.forEach((i) => URL.revokeObjectURL(i.originalUrl))
  items.value = []
}

onMounted(() => {
  document.addEventListener('paste', onPaste)
})
onUnmounted(() => {
  document.removeEventListener('paste', onPaste)
  items.value.forEach((i) => URL.revokeObjectURL(i.originalUrl))
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 上传区域 -->
      <div
        @drop="handleDrop"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        :class="[
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
        ]"
      >
        <div class="text-4xl mb-3">🖼️</div>
        <p class="text-body-lg font-medium text-gray-700 mb-1">拖拽图片到此处 / 点击选择 / Ctrl+V 粘贴</p>
        <p class="text-body-sm text-gray-500 mb-4">支持批量上传，JPG、PNG、WebP、GIF 等格式，纯本地处理不上传服务器</p>
        <input
          type="file"
          multiple
          accept="image/*"
          @change="onFileChange"
          class="hidden"
          id="lineArtFileInput"
        />
        <label
          for="lineArtFileInput"
          class="inline-block px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
        >
          选择图片
        </label>
      </div>

      <!-- 参数设置 -->
      <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">
            线条强度：{{ config.strength.toFixed(1) }}
          </label>
          <input
            v-model.number="config.strength"
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            class="w-full"
            @change="reprocessAll"
          />
          <p class="text-caption text-gray-500 mt-1">值越大线条越深</p>
        </div>
        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">
            线条粗细：{{ config.radius }}
          </label>
          <input
            v-model.number="config.radius"
            type="range"
            min="1"
            max="15"
            step="1"
            class="w-full"
            @change="reprocessAll"
          />
          <p class="text-caption text-gray-500 mt-1">值越大线条越柔和、细节越少</p>
        </div>
        <div class="flex items-center">
          <input
            v-model="config.invert"
            type="checkbox"
            id="lineArtInvert"
            class="mr-2"
            @change="reprocessAll"
          />
          <label for="lineArtInvert" class="text-body-sm font-medium text-gray-700">反色（黑底白线）</label>
        </div>
      </div>

      <!-- 结果区域 -->
      <div v-if="items.length > 0" class="mt-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-body-lg font-semibold">线稿结果（{{ items.length }}）</h3>
          <div class="flex gap-3">
            <button
              @click="downloadAll"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              批量下载
            </button>
            <button
              @click="clearAll"
              class="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              清空
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="item in items" :key="item.id" class="border rounded-lg p-3 relative">
            <button
              @click="removeItem(item.id)"
              class="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center bg-white/80 rounded-full text-red-500 hover:text-red-700 shadow"
            >
              ×
            </button>
            <div class="grid grid-cols-2 gap-2 mb-2">
              <div>
                <p class="text-caption text-gray-400 mb-1 text-center">原图</p>
                <el-image
                  :src="item.originalUrl"
                  :preview-src-list="[item.originalUrl]"
                  :initial-index="0"
                  preview-teleported
                  fit="contain"
                  class="w-full h-32 rounded bg-gray-50 border cursor-zoom-in"
                />
              </div>
              <div>
                <p class="text-caption text-gray-400 mb-1 text-center">线稿</p>
                <div class="w-full h-32 rounded bg-gray-50 border flex items-center justify-center overflow-hidden">
                  <div v-if="item.processing" class="flex items-center text-gray-500 text-body-sm">
                    <el-icon class="is-loading mr-1"><Loading /></el-icon>处理中
                  </div>
                  <el-image
                    v-else
                    :src="item.resultUrl"
                    :preview-src-list="[item.resultUrl]"
                    :initial-index="0"
                    preview-teleported
                    fit="contain"
                    class="w-full h-full cursor-zoom-in"
                  />
                </div>
              </div>
            </div>
            <p class="text-caption text-gray-500 truncate mb-2" :title="item.name">
              {{ item.name }}（{{ item.width }}×{{ item.height }}）
            </p>
            <button
              @click="downloadItem(item)"
              :disabled="item.processing"
              class="w-full px-4 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              下载
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <el-text>
        图片转线稿图工具采用铅笔素描算法（灰度反相 + 高斯模糊 + 颜色减淡混合），
        可将照片、插画一键转换为干净的黑白线稿。支持批量上传、拖拽以及 Ctrl+V 剪贴板粘贴，
        全部在浏览器本地处理，图片不会上传到服务器，保护隐私。可调节线条强度与粗细，
        并支持反色输出黑底白线效果。
      </el-text>
    </ToolDetail>

    <ToolDetail title="功能特点">
      <ul class="list-disc list-inside space-y-2 text-gray-700">
        <li>批量上传：一次选择或拖入多张图片同时转换</li>
        <li>多种输入方式：点击选择、拖拽、Ctrl+V 粘贴剪贴板图片</li>
        <li>参数可调：线条强度、线条粗细、反色（黑底白线）实时预览</li>
        <li>纯本地处理：基于 Canvas 前端运算，图片不上传服务器</li>
        <li>一键下载：单张下载或批量下载所有线稿</li>
      </ul>
    </ToolDetail>

    <ToolDetail title="使用说明">
      <ol class="list-decimal list-inside space-y-2 text-gray-700">
        <li>通过点击选择、拖拽或 Ctrl+V 粘贴添加一张或多张图片</li>
        <li>调整「线条强度」和「线条粗细」，结果会自动重新生成</li>
        <li>如需黑底白线效果，勾选「反色」</li>
        <li>点击单张「下载」或「批量下载」保存线稿图</li>
      </ol>
    </ToolDetail>
  </div>
</template>

<style scoped></style>

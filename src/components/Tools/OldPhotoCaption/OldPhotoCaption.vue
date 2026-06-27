<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { UploadProps, UploadRawFile, genFileId, ElMessage } from 'element-plus'
import { Download as DownloadIcon } from '@element-plus/icons-vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({ title: '老照片加字' })

// === 上传 ===
const fileList = ref()
const dataFileRef = ref()
const originalImage = ref<HTMLImageElement | null>(null)
const originalImageSrc = ref('')

// === 文字 ===
const year = ref('2026')
const season = ref('春')
const person = ref('同志')
const place = ref('北京')
const useUppercaseYear = ref(false)

const uppercaseDigits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const toUppercaseDigits = (s: string): string =>
  /^\d+$/.test(s) ? s.split('').map((c) => uppercaseDigits[+c]).join('') : s

const caption = computed(() => {
  const y = useUppercaseYear.value ? toUppercaseDigits(year.value) : year.value
  return `${y}年${season.value}，${person.value}同志在${place.value}留影`
})

// === 位置 ===
type Position = 'top' | 'bottom' | 'both'
const position = ref<Position>('both')

// === 样式预设 ===
type PresetKey = 'blackGold' | 'redGold' | 'yellowBlack' | 'custom'
const presetKey = ref<PresetKey>('blackGold')

const presets: Record<Exclude<PresetKey, 'custom'>, { bg: string; fg: string; label: string }> = {
  blackGold: { bg: '#000000', fg: '#FFD700', label: '经典黑金' },
  redGold: { bg: '#8B0000', fg: '#FFD700', label: '红底金字' },
  yellowBlack: { bg: '#FFC107', fg: '#000000', label: '黄底黑字' },
}

const bgColor = ref('#000000')
const textColor = ref('#FFD700')

// === 字体 ===
const fontFamily = ref<'SimSun' | 'KaiTi' | 'Microsoft YaHei'>('SimSun')
const fontSizeOptions = ['SimSun', 'KaiTi', 'Microsoft YaHei']
const fontSizeLabels: Record<string, string> = {
  SimSun: '宋体',
  KaiTi: '楷体',
  'Microsoft YaHei': '微软雅黑',
}

// === 手动微调（滑块）===
const fontSizeScale = ref(100) // 百分比，100 = 自动值
const bandHeightScale = ref(100) // 百分比，100 = 自动值

// === 预览 ===
const previewSrc = ref('')

// === 上传处理 ===
const updateDataFile = async (params: any) => {
  const file = params.file as File
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 10MB')
    return
  }
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.addEventListener('load', () => {
    const img = new Image()
    img.onload = () => {
      originalImage.value = img
      originalImageSrc.value = reader.result as string
    }
    img.src = reader.result as string
  }, false)
}

const handleExceed: UploadProps['onExceed'] = (files) => {
  dataFileRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  dataFileRef.value!.handleStart(file)
  dataFileRef.value!.submit()
}

// === 切换预设 ===
const applyPreset = (key: PresetKey) => {
  presetKey.value = key
  if (key !== 'custom') {
    bgColor.value = presets[key].bg
    textColor.value = presets[key].fg
  }
}

// === 计算条带高/字号 ===
const calcBandHeight = (img: HTMLImageElement) =>
  Math.max(20, Math.round(img.naturalWidth * 0.10))

const calcFontSize = (img: HTMLImageElement, bandH: number) =>
  Math.max(8, Math.min(bandH * 0.55, img.naturalWidth * 0.06))

// === 渲染 Canvas ===
const renderCanvas = () => {
  const img = originalImage.value
  if (!img) return

  const bandAutoH = calcBandHeight(img)
  const bandH = Math.round((bandAutoH * bandHeightScale.value) / 100)
  const topH = position.value === 'bottom' ? 0 : bandH
  const botH = position.value === 'top' ? 0 : bandH

  const totalW = img.naturalWidth
  const totalH = img.naturalHeight + topH + botH

  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let y = 0
  if (topH) {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, 0, totalW, topH)
    drawCaption(ctx, caption.value, 0, 0, totalW, topH, img, bandH)
    y = topH
  }
  ctx.drawImage(img, 0, y)
  y += img.naturalHeight
  if (botH) {
    ctx.fillStyle = bgColor.value
    ctx.fillRect(0, y, totalW, botH)
    drawCaption(ctx, caption.value, 0, y, totalW, botH, img, bandH)
  }

  previewSrc.value = canvas.toDataURL('image/png')
}

const drawCaption = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  img: HTMLImageElement,
  bandH: number
) => {
  const auto = calcFontSize(img, bandH)
  const fontSize = Math.max(8, Math.round((auto * fontSizeScale.value) / 100))
  ctx.fillStyle = textColor.value
  ctx.font = `bold ${fontSize}px "${fontFamily.value}", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
}

// === 监听任何变化重渲染 ===
watch(
  [
    originalImage,
    year,
    season,
    person,
    place,
    useUppercaseYear,
    position,
    bgColor,
    textColor,
    fontFamily,
    fontSizeScale,
    bandHeightScale,
  ],
  () => {
    if (originalImage.value) renderCanvas()
  }
)

// === 下载 ===
const downloadImage = () => {
  if (!previewSrc.value) return
  // previewSrc 是 dataURL; 从同一个 canvas 重新走 toBlob 拿原尺寸 PNG
  // 但 dataURL 已包含数据，直接转 blob 即可
  fetch(previewSrc.value)
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `old-photo-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white">
      <!-- 上传区域 -->
      <el-upload
        v-model:file-list="fileList"
        ref="dataFileRef"
        accept="image/*"
        :http-request="updateDataFile"
        :on-exceed="handleExceed"
        :limit="1"
        drag
        class="w-full"
      >
        <div class="el-upload__text">
          拖拽图片到此处或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">支持 JPG、PNG 等常见图片格式，大小不超过 10MB</div>
        </template>
      </el-upload>

      <!-- 主体：控制面板 + 预览 -->
      <div v-if="originalImageSrc" class="mt-4 flex flex-col lg:flex-row gap-4">
        <!-- 控制面板 -->
        <div class="w-full lg:w-80 shrink-0 space-y-3">
          <!-- 文字内容 -->
          <div class="p-3 bg-gray-50 rounded-lg space-y-2">
            <div class="text-sm font-medium text-gray-700">文字内容</div>
            <div class="flex items-center gap-2">
              <el-input v-model="year" placeholder="年份" size="small" class="!w-20" />
              <span class="text-sm text-gray-500">年</span>
              <el-input v-model="season" placeholder="季节" size="small" class="!w-16" />
              <el-checkbox v-model="useUppercaseYear" size="small" class="!text-xs">转大写</el-checkbox>
            </div>
            <div class="flex items-center gap-2">
              <el-input v-model="person" placeholder="人物" size="small" class="flex-1" />
              <span class="text-sm text-gray-500">同志</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">在</span>
              <el-input v-model="place" placeholder="地点" size="small" class="flex-1" />
              <span class="text-sm text-gray-500">留影</span>
            </div>
            <div class="text-xs text-gray-500 pt-1 border-t border-gray-200 mt-2">
              预览：<span class="text-gray-800">{{ caption }}</span>
            </div>
          </div>

          <!-- 位置 -->
          <div class="p-3 bg-gray-50 rounded-lg">
            <div class="text-sm font-medium text-gray-700 mb-2">位置</div>
            <el-radio-group v-model="position" class="flex flex-wrap">
              <el-radio-button value="top">仅上方</el-radio-button>
              <el-radio-button value="bottom">仅下方</el-radio-button>
              <el-radio-button value="both">上下都加</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 预设样式 -->
          <div class="p-3 bg-gray-50 rounded-lg">
            <div class="text-sm font-medium text-gray-700 mb-2">预设样式</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="(p, key) in presets"
                :key="key"
                type="button"
                class="px-2 py-2 rounded border-2 text-sm transition"
                :class="presetKey === key ? 'border-blue-500' : 'border-transparent hover:border-gray-300'"
                :style="{ background: p.bg, color: p.fg, fontWeight: 'bold' }"
                @click="applyPreset(key as PresetKey)"
              >
                {{ p.label }}
              </button>
              <button
                type="button"
                class="px-2 py-2 rounded border-2 text-sm transition bg-white text-gray-700"
                :class="presetKey === 'custom' ? 'border-blue-500' : 'border-gray-300 hover:border-gray-400'"
                @click="applyPreset('custom')"
              >
                自定义
              </button>
            </div>
          </div>

          <!-- 高级 -->
          <div class="p-3 bg-gray-50 rounded-lg space-y-2">
            <div class="text-sm font-medium text-gray-700">高级</div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">背景色</span>
              <el-color-picker v-model="bgColor" size="small" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">文字色</span>
              <el-color-picker v-model="textColor" size="small" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">字体</span>
              <el-select v-model="fontFamily" size="small" class="flex-1">
                <el-option v-for="f in fontSizeOptions" :key="f" :value="f" :label="fontSizeLabels[f]" />
              </el-select>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">条带高度</span>
              <el-slider v-model="bandHeightScale" :min="50" :max="200" :step="10" class="flex-1" />
              <span class="text-xs text-gray-500 w-10 text-right">{{ bandHeightScale }}%</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-14">字号</span>
              <el-slider v-model="fontSizeScale" :min="50" :max="200" :step="10" class="flex-1" />
              <span class="text-xs text-gray-500 w-10 text-right">{{ fontSizeScale }}%</span>
            </div>
          </div>
        </div>

        <!-- 预览 -->
        <div class="flex-1 min-w-0">
          <div class="bg-gray-100 border border-gray-300 rounded p-4 flex items-center justify-center min-h-[300px]">
            <img
              v-if="previewSrc"
              :src="previewSrc"
              class="max-w-full max-h-[70vh] object-contain"
              alt="预览"
            >
            <el-empty v-else description="等待图片加载..." :image-size="100" />
          </div>
          <div class="mt-3 flex justify-center">
            <el-button
              type="success"
              :icon="DownloadIcon"
              :disabled="!previewSrc"
              @click="downloadImage"
            >
              下载图片
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-3">
        <el-text tag="div">
          <strong>老照片加字</strong>可以在一张图片的上方、下方或上下方同时添加题字条带，
          经典模板为「2026年春，xx同志在xx地方留影」，适合制作怀旧老照片、纪念合影等。
        </el-text>
        <el-text tag="div"><strong>使用步骤：</strong></el-text>
        <ol class="list-decimal pl-5 space-y-1">
          <li>点击或拖拽上传一张图片</li>
          <li>在「文字内容」里自定义年份、人物、地点</li>
          <li>选择条带位置（仅上 / 仅下 / 上下都加）</li>
          <li>选择一个预设样式（黑金 / 红金 / 黄黑），或在「高级」里自定义颜色、字体、字号、条带高度</li>
          <li>右侧实时预览，满意后点击「下载图片」保存为 PNG</li>
        </ol>
        <el-text tag="div"><strong>常见用法：</strong></el-text>
        <ul class="list-disc pl-5 space-y-1">
          <li>怀旧老照片：黑底金字 + 宋体最有年代感</li>
          <li>纪念合影：红底金字喜庆又正式</li>
          <li>搞笑段子：自由配色 + 上下都加条带</li>
        </ul>
        <el-text tag="div" class="text-gray-500">
          <strong>隐私说明：</strong>所有处理均在浏览器本地完成，图片不会上传到服务器。
        </el-text>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
:deep(.el-upload-dragger) {
  width: 100% !important;
  height: auto !important;
  min-height: 120px;
  padding: 20px;
}
:deep(.el-upload-list__item) {
  width: 100%;
}
</style>
<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { UploadProps, UploadRawFile, genFileId } from 'element-plus'
import { Download, Plus, Delete } from '@element-plus/icons-vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "图片水印",
})

// 水印项接口
interface WatermarkItem {
  id: string
  type: 'text' | 'image'
  visible: boolean
  opacity: number
  // 文字水印专属
  content?: string
  color?: string
  fontSize?: number
  bold?: boolean
  // 图片水印专属
  imageSrc?: string
  naturalWidth?: number
  naturalHeight?: number
  scale?: number
  // 位置 (0-1 比例)
  x: number
  y: number
}

// 图片上传相关
const fileList = ref()
const dataFileRef = ref()
const baseImageSrc = ref('')
const previewContainerRef = ref<HTMLElement>()
const imageNaturalSize = ref({ width: 0, height: 0 })

// 水印列表
const watermarkList = ref<WatermarkItem[]>([])

// 当前编辑的水印ID
const editingWatermarkId = ref<string | null>(null)

// 输出尺寸选项
const outputSizeOptions = [
  { label: '保持原尺寸', value: 'original' },
  { label: '1080p (1920)', value: '1920' },
  { label: '720p (1280)', value: '1280' },
  { label: '480p (854)', value: '854' },
]
const outputSize = ref('original')

// 生成唯一ID
const generateId = () => Math.random().toString(36).substring(2, 11)

// 上传底图
const updateDataFile = async (params: any) => {
  let reader = new FileReader();
  reader.readAsDataURL(params.file);
  reader.addEventListener(
    'load',
    async () => {
      const imageTmp = new Image();
      imageTmp.onload = () => {
        baseImageSrc.value = reader.result as string;
        imageNaturalSize.value = {
          width: imageTmp.naturalWidth,
          height: imageTmp.naturalHeight
        };
      };
      imageTmp.src = reader.result as string;
    },
    false
  );
}

// 超出限制时的处理
const handleExceed: UploadProps['onExceed'] = (files) => {
  dataFileRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  dataFileRef.value!.handleStart(file)
  dataFileRef.value!.submit()
}

// 添加文字水印
const addTextWatermark = () => {
  const id = generateId()
  // 使用图片中心作为初始位置（如果图片已加载）
  const centerX = imageNaturalSize.value.width / 2
  const centerY = imageNaturalSize.value.height / 2
  watermarkList.value.push({
    id,
    type: 'text',
    visible: true,
    opacity: 0.6,
    content: '水印文字',
    color: '#000000',
    fontSize: 24,
    bold: false,
    x: centerX || 100,
    y: centerY || 100
  })
  editingWatermarkId.value = id
}

// 添加图片水印
const watermarkFileRef = ref()
const pendingWatermarkImage = ref<{ src: string, width: number, height: number } | null>(null)

const handleWatermarkFileExceed: UploadProps['onExceed'] = (files) => {
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  watermarkFileRef.value!.handleStart(file)
  watermarkFileRef.value!.submit()
}

const uploadWatermarkImage = async (params: any) => {
  let reader = new FileReader();
  reader.readAsDataURL(params.file);
  reader.addEventListener(
    'load',
    async () => {
      const imageTmp = new Image();
      imageTmp.onload = () => {
        pendingWatermarkImage.value = {
          src: reader.result as string,
          width: imageTmp.naturalWidth,
          height: imageTmp.naturalHeight
        }
      };
      imageTmp.src = reader.result as string;
    },
    false
  );
}

watch(pendingWatermarkImage, (newVal) => {
  if (newVal) {
    const id = generateId()
    // 使用图片中心作为初始位置（如果图片已加载）
    const centerX = imageNaturalSize.value.width / 2
    const centerY = imageNaturalSize.value.height / 2
    // 小图片默认 scale 为 1，大图片默认 0.15，确保水印可见
    const defaultScale = Math.min(newVal.width, newVal.height) < 100 ? 1 : 0.15
    watermarkList.value.push({
      id,
      type: 'image',
      visible: true,
      opacity: 0.5,
      imageSrc: newVal.src,
      naturalWidth: newVal.width,
      naturalHeight: newVal.height,
      scale: defaultScale,
      x: centerX || 100,
      y: centerY || 100
    })
    pendingWatermarkImage.value = null
    watermarkFileRef.value?.clearFiles()
    editingWatermarkId.value = id
  }
})

// 删除水印
const removeWatermark = (id: string) => {
  watermarkList.value = watermarkList.value.filter(w => w.id !== id)
  if (editingWatermarkId.value === id) {
    editingWatermarkId.value = null
  }
}

// 拖动相关
const draggingId = ref<string | null>(null)
const resizingId = ref<string | null>(null)

const handleMouseDown = (e: MouseEvent, item: WatermarkItem) => {
  e.preventDefault()
  e.stopPropagation()
  draggingId.value = item.id
  editingWatermarkId.value = item.id

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleResizeStart = (e: MouseEvent, item: WatermarkItem) => {
  e.preventDefault()
  e.stopPropagation()
  resizingId.value = item.id
  editingWatermarkId.value = item.id

  const startX = e.clientX
  const startY = e.clientY
  const startScale = item.type === 'image' ? (item.scale || 0.15) : (item.fontSize || 24)

  const handleResizeMove = (moveEvent: MouseEvent) => {
    if (resizingId.value !== item.id) return

    const deltaX = moveEvent.clientX - startX
    const deltaY = moveEvent.clientY - startY
    const delta = Math.max(deltaX, deltaY)

    if (item.type === 'image') {
      // 图片水印：每10px改变1%的缩放
      const scaleChange = delta / 500
      const newScale = Math.max(0.05, Math.min(1, startScale + scaleChange))
      item.scale = newScale
    } else {
      // 文字水印：每5px改变1px的字体大小
      const fontSizeChange = delta / 5
      const newFontSize = Math.max(12, Math.min(100, (startScale as number) + fontSizeChange))
      item.fontSize = newFontSize
    }
  }

  const handleResizeEnd = () => {
    resizingId.value = null
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
  }

  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', handleResizeEnd)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!draggingId.value || !previewContainerRef.value) return

  const img = previewContainerRef.value.querySelector('img')
  if (!img) return

  const imgRect = img.getBoundingClientRect()
  // 预览区域的缩放比例
  const scaleX = imgRect.width / imageNaturalSize.value.width
  const scaleY = imgRect.height / imageNaturalSize.value.height

  const item = watermarkList.value.find(w => w.id === draggingId.value)
  if (!item) return

  // 直接计算鼠标在原始图片尺寸下的坐标
  const rawX = (e.clientX - imgRect.left) / scaleX
  const rawY = (e.clientY - imgRect.top) / scaleY

  // 边界限制（防止拖出图片范围）
  const halfWidth = item.type === 'text'
    ? Math.max((item.fontSize || 24) * (item.content || '').length / 2, 20)
    : ((item.naturalWidth || 100) * (item.scale || 0.15)) / 2
  const halfHeight = item.type === 'text'
    ? Math.max((item.fontSize || 24) / 2, 10)
    : ((item.naturalHeight || 100) * (item.scale || 0.15)) / 2

  item.x = Math.max(halfWidth, Math.min(imageNaturalSize.value.width - halfWidth, rawX))
  item.y = Math.max(halfHeight, Math.min(imageNaturalSize.value.height - halfHeight, rawY))
}

const handleMouseUp = () => {
  draggingId.value = null
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 计算水印在预览区域的样式
const getWatermarkStyle = (item: WatermarkItem) => {
  if (!baseImageSrc.value) return {}

  const container = previewContainerRef.value
  if (!container) return {}

  const img = container.querySelector('img')
  if (!img) return {}

  const imgRect = img.getBoundingClientRect()
  const scaleX = imgRect.width / imageNaturalSize.value.width
  const scaleY = imgRect.height / imageNaturalSize.value.height

  let itemWidth = 0, itemHeight = 0
  if (item.type === 'text') {
    const tempCanvas = document.createElement('canvas')
    const ctx = tempCanvas.getContext('2d')
    if (ctx) {
      ctx.font = `${item.bold ? 'bold ' : ''}${item.fontSize}px sans-serif`
      itemWidth = ctx.measureText(item.content || '').width
      itemHeight = item.fontSize || 24
    }
  } else {
    itemWidth = (item.naturalWidth || 100) * (item.scale || 0.15)
    itemHeight = (item.naturalHeight || 100) * (item.scale || 0.15)
  }

  const style: any = {
    left: `${item.x * scaleX}px`,
    top: `${item.y * scaleY}px`,
    transform: 'translate(-50%, -50%)',
    opacity: item.opacity,
    display: item.visible ? 'block' : 'none',
    cursor: draggingId.value === item.id ? 'grabbing' : 'grab',
    zIndex: editingWatermarkId.value === item.id ? 100 : 10
  }

  if (item.type === 'text') {
    style.color = item.color
    style.fontSize = `${item.fontSize || 24}px`
    style.fontWeight = item.bold ? 'bold' : 'normal'
  } else {
    // 为图片水印添加宽高
    style.width = `${itemWidth}px`
    style.height = `${itemHeight}px`
  }

  // 为选中的水印添加边框和阴影效果
  if (editingWatermarkId.value === item.id) {
    style.boxShadow = '0 0 0 2px #3b82f6, 0 0 8px rgba(59, 130, 246, 0.4)'
    style.borderRadius = '2px'
    if (item.type === 'image') {
      style.border = '2px solid #3b82f6'
    }
  }

  return style
}

// 下载
const download = () => {
  if (!baseImageSrc.value) return

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 获取预览中图片的显示大小，用于计算缩放比例
  let previewScale = 1
  const container = previewContainerRef.value
  if (container) {
    const img = container.querySelector('img') as HTMLImageElement
    if (img) {
      const displayWidth = img.getBoundingClientRect().width
      previewScale = imageNaturalSize.value.width / displayWidth
    }
  }

  // 计算输出尺寸
  let outputWidth = imageNaturalSize.value.width
  let outputHeight = imageNaturalSize.value.height
  let outputScale = 1

  if (outputSize.value !== 'original') {
    const maxWidth = parseInt(outputSize.value)
    if (outputWidth > maxWidth) {
      outputScale = maxWidth / outputWidth
      outputWidth = maxWidth
      outputHeight = Math.round(imageNaturalSize.value.height * outputScale)
    }
  }

  canvas.width = outputWidth
  canvas.height = outputHeight

  // 预加载所有图片水印
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(img)
      img.src = src
    })
  }

  // 绘制底图
  const img = new Image()
  img.src = baseImageSrc.value
  img.onload = async () => {
    ctx.drawImage(img, 0, 0, outputWidth, outputHeight)

    // 收集所有图片水印的加载 Promise
    const imageWatermarks = watermarkList.value.filter(w => w.visible && w.type === 'image' && w.imageSrc)
    const loadedImages = await Promise.all(imageWatermarks.map(w => loadImage(w.imageSrc!)))

    // 建立 imageSrc 到加载后图片的映射
    const imageMap = new Map<string, HTMLImageElement>()
    imageWatermarks.forEach((w, i) => {
      imageMap.set(w.imageSrc!, loadedImages[i])
    })

    // 绘制所有水印（位置和字体需要缩放）
    watermarkList.value.forEach(item => {
      if (!item.visible) return

      ctx.save()
      ctx.globalAlpha = item.opacity

      if (item.type === 'text') {
        ctx.fillStyle = item.color || '#000000'
        // 字体大小根据预览缩放比例和输出缩放进行调整
        const fontSize = (item.fontSize || 24) * previewScale * outputScale
        ctx.font = `${item.bold ? 'bold ' : ''}${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(item.content || '', item.x * outputScale, item.y * outputScale)
      } else if (item.imageSrc && imageMap.has(item.imageSrc)) {
        const wmImg = imageMap.get(item.imageSrc)!
        // 图片水印根据预览缩放比例和输出缩放进行调整
        const w = wmImg.naturalWidth * (item.scale || 0.15) * previewScale * outputScale
        const h = wmImg.naturalHeight * (item.scale || 0.15) * previewScale * outputScale
        ctx.drawImage(wmImg, item.x * outputScale - w / 2, item.y * outputScale - h / 2, w, h)
      }

      ctx.restore()
    })

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `watermarked_${Date.now()}.png`
    link.click()
  }
}

// 监听水印变化，更新编辑状态
watch(watermarkList, () => {
  // 水印列表变化时不做特殊处理
}, { deep: true })

onMounted(() => {
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 上传底图 -->
      <el-upload
        v-model:file-list="fileList"
        class="dataFileRef flex flex-col md:flex-row gap-2 md:gap-3 w-full mb-3"
        ref="dataFileRef"
        accept="image/*"
        :http-request="updateDataFile"
        :on-exceed="handleExceed"
        :limit="1"
      >
        <el-button type="primary">请上传需要添加水印的图片</el-button>
      </el-upload>

      <!-- 添加水印按钮 -->
      <div class="flex gap-2 mb-3">
        <el-button type="primary" @click="addTextWatermark">
          <el-icon class="mr-1"><Plus /></el-icon>
          添加文字水印
        </el-button>
        <el-upload
          ref="watermarkFileRef"
          accept="image/*"
          :http-request="uploadWatermarkImage"
          :on-exceed="handleWatermarkFileExceed"
          :limit="1"
          :show-file-list="false"
        >
          <el-button type="primary">
            <el-icon class="mr-1"><Plus /></el-icon>
            添加图片水印
          </el-button>
        </el-upload>
      </div>

      <!-- 水印列表和预览区域左右排列 -->
      <div class="flex flex-col lg:flex-row gap-4">
        <!-- 左侧：水印列表 -->
        <div v-if="watermarkList.length > 0" class="w-full lg:w-72 border rounded-lg p-3 flex-shrink-0 overflow-y-auto max-h-[600px]">
          <div class="text-sm text-gray-500 mb-2">水印列表</div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="item in watermarkList"
              :key="item.id"
              class="flex items-center gap-2 bg-gray-100 rounded px-3 py-1 cursor-pointer transition-all w-full"
              :class="{ 'ring-2 ring-blue-500 bg-blue-50': editingWatermarkId === item.id }"
              @click="editingWatermarkId = item.id"
            >
              <el-checkbox v-model="item.visible" size="small" @click.stop />
              <span class="text-sm flex-1 truncate">
                {{ item.type === 'text' ? (item.content || '文字水印') : '图片水印' }}
              </span>
              <el-button size="small" type="danger" text @click.stop="removeWatermark(item.id)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>

          <!-- 编辑当前水印 -->
          <div v-if="editingWatermarkId" class="mt-3 pt-3 border-t">
            <template v-for="item in watermarkList" :key="item.id">
              <div v-if="editingWatermarkId === item.id" class="flex flex-wrap gap-3 items-start">
                <template v-if="item.type === 'text'">
                  <el-input v-model="item.content" placeholder="水印文字" class="!w-full" size="small" />
                  <el-color-picker v-model="item.color" size="small" />
                  <el-checkbox v-model="item.bold" size="small">加粗</el-checkbox>
                </template>
                <div class="flex items-center gap-1 w-full">
                  <span class="text-sm text-gray-500">透明度:</span>
                  <el-slider v-model="item.opacity" :min="0.05" :max="1" :step="0.05" :format-tooltip="(v: number) => `${Math.round(v * 100)}%`" class="flex-1" size="small" />
                </div>
                <template v-if="item.type === 'text'">
                  <div class="flex items-center gap-1 w-full">
                    <span class="text-sm text-gray-500">字体:</span>
                    <el-slider v-model="item.fontSize" :min="12" :max="100" class="flex-1" size="small" />
                  </div>
                </template>
                <template v-if="item.type === 'image'">
                  <div class="flex items-center gap-1 w-full">
                    <span class="text-sm text-gray-500">缩放:</span>
                    <el-slider v-model="item.scale" :min="0.05" :max="1" :step="0.05" :format-tooltip="(v: number) => `${Math.round(v * 100)}%`" class="flex-1" size="small" />
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>

        <!-- 右侧：预览区域 -->
        <div class="flex-1 flex flex-col gap-2">
          <!-- 预览控制条 -->
          <div class="flex justify-between items-center flex-wrap gap-2 bg-gray-50 rounded p-2">
            <el-text>预览（拖动水印调整位置）</el-text>
            <div class="flex items-center gap-2">
              <el-select v-model="outputSize" size="small" class="!w-36">
                <el-option v-for="opt in outputSizeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
              <el-button type="primary" size="small" @click="download" :disabled="!baseImageSrc">
                <el-icon class="mr-1"><Download /></el-icon>
                下载
              </el-button>
            </div>
          </div>

          <!-- 预览图片容器 -->
          <div class="flex-1 bg-gray-100 rounded flex items-center justify-center min-h-[400px] overflow-auto">
            <div
              ref="previewContainerRef"
              class="relative inline-block"
              :class="{ 'cursor-crosshair': baseImageSrc }"
            >
              <img
                v-if="baseImageSrc"
                :src="baseImageSrc"
                alt="底图"
                class="max-w-full max-h-[600px] h-auto block select-none"
                draggable="false"
              />

              <!-- 水印覆盖层 -->
              <template v-if="baseImageSrc">
                <div
                  v-for="item in watermarkList"
                  :key="item.id"
                  class="absolute select-none"
                  :class="{ 'pointer-events-none': !item.visible }"
                  :style="getWatermarkStyle(item)"
                  @mousedown="handleMouseDown($event, item)"
                >
                  <template v-if="item.type === 'text'">
                    <span
                      :style="{
                        color: item.color,
                        fontSize: 'inherit',
                        fontWeight: item.bold ? 'bold' : 'normal',
                        opacity: item.opacity,
                        whiteSpace: 'nowrap'
                      }"
                    >{{ item.content }}</span>
                  </template>
                  <template v-else>
                    <img
                      v-if="item.imageSrc"
                      :src="item.imageSrc"
                      :style="{ opacity: item.opacity }"
                      class="block object-contain"
                      draggable="false"
                    />
                  </template>

                  <!-- 选中水印时显示的resize handle -->
                  <div
                    v-if="editingWatermarkId === item.id"
                    class="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize transform translate-x-1/2 translate-y-1/2"
                    @mousedown.stop="handleResizeStart($event, item)"
                    :style="{ zIndex: 101 }"
                  />
                </div>
              </template>

              <el-empty v-if="!baseImageSrc" :image-size="100" description="上传图片后可预览水印效果" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <el-text>
        图片水印添加工具，支持添加多个文字水印和图片水印。<br>
        点击"添加文字水印"或"添加图片水印"可新增水印；<br>
        在预览区直接拖动水印到任意位置；<br>
        点击水印列表中的项目可编辑该水印的透明度、字体大小等属性；<br>
        勾选复选框可显示/隐藏单个水印。<br>
        纯前端处理，无需上传到服务器，保护您的隐私。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
:deep(.el-upload-list__item) {
  width: 100%;
}
:deep(.el-upload-list__item-name) {
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}
:deep(.el-slider) {
  min-width: 80px;
}
</style>

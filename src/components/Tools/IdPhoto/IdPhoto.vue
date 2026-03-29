<script setup lang="ts">
import { ref, computed, watch, onMounted, reactive, nextTick } from 'vue'
import { UploadProps, UploadRawFile, genFileId } from 'element-plus'
import { Download, RefreshLeft, ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: '证件照生成',
})

// 预设证件照尺寸
const presetSizes = [
  { name: '一寸', width: 295, height: 413 },
  { name: '二寸', width: 413, height: 579 },
  { name: '小一寸', width: 260, height: 378 },
  { name: '小二寸', width: 390, height: 567 },
  { name: '五寸', width: 891, height: 1181 },
  { name: '护照/签证', width: 330, height: 480 },
  { name: '身份证', width: 358, height: 441 },
  { name: '社保卡', width: 260, height: 378 },
  { name: '驾驶证', width: 260, height: 378 },
  { name: '教师资格证', width: 295, height: 413 },
  { name: '普通话水平测试', width: 390, height: 567 },
  { name: '公务员考试', width: 413, height: 579 },
  { name: '结婚登记照', width: 413, height: 579 },
  { name: '简历证件照', width: 295, height: 413 },
  { name: '社保照片', width: 295, height: 413 },
  { name: '港澳通行证', width: 441, height: 567 },
  { name: '台湾通行证', width: 441, height: 567 },
]

// 状态
const fileList = ref()
const dataFileRef = ref()
const originalImage = ref({} as any)
const uploadedImageSrc = ref('')
const croppedImageSrc = ref('')
const selectedPreset = ref('一寸')
const customWidth = ref(295)
const customHeight = ref(413)
const outputFormat = ref('png')
const imageQuality = ref(95)
const bgColor = ref('#ffffff')

// 裁剪相关
const cropMode = ref('rect')
const containerRef = ref<HTMLDivElement>()
const isDragging = ref(false)
const dragPoint = ref(-1)

// 图片缩放
const imageScale = ref(1)

// 容器尺寸
const containerSize = reactive({ width: 600, height: 400 })

// 矩形裁剪框（可拖动）
const rectCrop = reactive({
  x: 100,
  y: 100,
  width: 200,
  height: 200,
})

// 拖动裁剪框的起始位置
const dragStartCropPos = reactive({ x: 0, y: 0 })
const dragStartMousePos = reactive({ x: 0, y: 0 })

// 四边形裁剪点（固定在容器中心）
const quadPoints = reactive([
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
])

// 上传处理
const updateDataFile = async (params: any) => {
  const reader = new FileReader()
  reader.readAsDataURL(params.file)
  reader.addEventListener('load', async () => {
    const imageTmp = new Image()
    imageTmp.onload = async () => {
      originalImage.value = imageTmp
      uploadedImageSrc.value = reader.result as string
      // 等待 DOM 更新后再初始化
      await nextTick()
      setTimeout(() => resetImagePosition(), 50)
    }
    imageTmp.src = reader.result as string
  }, false)
}

const handleExceed: UploadProps['onExceed'] = (files) => {
  dataFileRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  dataFileRef.value!.handleStart(file)
  dataFileRef.value!.submit()
}

// 重置图片位置
const resetImagePosition = () => {
  if (!originalImage.value.src) return

  const container = containerRef.value
  if (!container) {
    setTimeout(() => resetImagePosition(), 50)
    return
  }

  // 获取父元素的实际可用宽度
  const parentElement = container.parentElement
  if (!parentElement) return

  const parentRect = parentElement.getBoundingClientRect()
  const availableWidth = parentRect.width

  // 计算图片比例
  const imgRatio = originalImage.value.naturalWidth / originalImage.value.naturalHeight

  // 计算容器宽度（不超过父元素宽度）
  let newWidth = availableWidth

  // 根据图片比例计算高度
  let newHeight = newWidth / imgRatio

  // 如果高度太大，限制最大高度为屏幕高度的60%
  const maxHeight = window.innerHeight * 0.6
  if (newHeight > maxHeight) {
    newHeight = maxHeight
    newWidth = newHeight * imgRatio
  }

  // 确保最小尺寸
  newWidth = Math.max(280, newWidth)
  newHeight = Math.max(280, newHeight)

  containerSize.width = newWidth
  containerSize.height = newHeight

  // 重置缩放为1（图片刚好适应容器）
  imageScale.value = 1

  initCropBox()
}

// 初始化裁剪框（可拖动的矩形框）
const initCropBox = () => {
  const outputRatio = customWidth.value / customHeight.value
  let cropWidth, cropHeight

  // 限制裁剪框最大尺寸
  const maxCropSize = Math.min(containerSize.width, containerSize.height) * 0.8

  if (outputRatio > 1) {
    cropWidth = Math.min(maxCropSize, 300)
    cropHeight = cropWidth / outputRatio
  } else {
    cropHeight = Math.min(maxCropSize, 300)
    cropWidth = cropHeight * outputRatio
  }

  // 矩形框位置居中
  rectCrop.width = cropWidth
  rectCrop.height = cropHeight
  rectCrop.x = (containerSize.width - cropWidth) / 2
  rectCrop.y = (containerSize.height - cropHeight) / 2

  // 四边形初始化为矩形
  const centerX = containerSize.width / 2
  const centerY = containerSize.height / 2
  const halfW = cropWidth / 2
  const halfH = cropHeight / 2

  quadPoints[0] = { x: centerX - halfW, y: centerY - halfH }
  quadPoints[1] = { x: centerX + halfW, y: centerY - halfH }
  quadPoints[2] = { x: centerX + halfW, y: centerY + halfH }
  quadPoints[3] = { x: centerX - halfW, y: centerY + halfH }
}

// 图片容器样式
const imageContainerStyle = computed(() => {
  const width = containerSize.width > 0 ? containerSize.width : 600
  const height = containerSize.height > 0 ? containerSize.height : 400
  return {
    width: width + 'px',
    height: height + 'px',
    maxWidth: '100%',
  }
})

// 图片样式（固定不移动，居中显示）
const imageStyle = computed(() => {
  if (!originalImage.value.naturalWidth || containerSize.width === 0) {
    return { width: '100%', height: '300px' }
  }

  // 计算图片适应容器的基础尺寸（此时 imageScale = 1）
  const imgRatio = originalImage.value.naturalWidth / originalImage.value.naturalHeight
  const containerRatio = containerSize.width / containerSize.height

  let baseWidth, baseHeight
  if (imgRatio > containerRatio) {
    // 图片更宽，以宽度为基准
    baseWidth = containerSize.width
    baseHeight = baseWidth / imgRatio
  } else {
    // 图片更高，以高度为基准
    baseHeight = containerSize.height
    baseWidth = baseHeight * imgRatio
  }

  // 应用缩放
  const scaledWidth = baseWidth * imageScale.value
  const scaledHeight = baseHeight * imageScale.value

  return {
    width: scaledWidth + 'px',
    height: scaledHeight + 'px',
    maxWidth: '100%',
    maxHeight: '100%',
  }
})

// 图片在容器中的偏移（因为图片居中显示）
const imageOffsetInContainer = computed(() => {
  if (!originalImage.value.naturalWidth || containerSize.width === 0) {
    return { x: 0, y: 0 }
  }

  const imgRatio = originalImage.value.naturalWidth / originalImage.value.naturalHeight
  const baseWidth = containerSize.width
  const baseHeight = baseWidth / imgRatio

  const scaledWidth = baseWidth * imageScale.value
  const scaledHeight = baseHeight * imageScale.value

  return {
    x: (containerSize.width - scaledWidth) / 2,
    y: (containerSize.height - scaledHeight) / 2,
  }
})

// 裁剪框位置（矩形框可拖动）
const cropBoxStyle = computed(() => ({
  left: rectCrop.x + 'px',
  top: rectCrop.y + 'px',
  width: rectCrop.width + 'px',
  height: rectCrop.height + 'px',
}))

// 鼠标事件处理 - 拖动裁剪框
const handleMouseDown = (e: MouseEvent, type: string, pointIndex?: number) => {
  if (!originalImage.value.src) return
  e.preventDefault()

  if (type === 'rect') {
    // 拖动矩形裁剪框
    isDragging.value = true
    dragStartCropPos.x = rectCrop.x
    dragStartCropPos.y = rectCrop.y
    dragStartMousePos.x = e.clientX
    dragStartMousePos.y = e.clientY
  } else if (type === 'quad') {
    // 拖动四边形裁剪点
    isDragging.value = true
    dragPoint.value = pointIndex !== undefined ? pointIndex : -1
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (!originalImage.value.src || !isDragging.value) return

  if (cropMode.value === 'rect') {
    // 拖动矩形框
    const dx = e.clientX - dragStartMousePos.x
    const dy = e.clientY - dragStartMousePos.y

    rectCrop.x = Math.max(0, Math.min(containerSize.width - rectCrop.width, dragStartCropPos.x + dx))
    rectCrop.y = Math.max(0, Math.min(containerSize.height - rectCrop.height, dragStartCropPos.y + dy))
  } else if (cropMode.value === 'quad' && dragPoint.value >= 0) {
    // 拖动四边形裁剪点
    const rect = containerRef.value?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    quadPoints[dragPoint.value] = {
      x: Math.max(0, Math.min(containerSize.width, x)),
      y: Math.max(0, Math.min(containerSize.height, y))
    }
  }
}

const handleMouseUp = () => {
  if (isDragging.value) {
    // 拖动结束时立即更新预览
    if (originalImage.value.src && containerSize.width > 0) {
      doCrop()
    }
  }
  isDragging.value = false
  dragPoint.value = -1
}

// 触摸事件支持
const handleTouchStart = (e: TouchEvent, type: string, pointIndex?: number) => {
  if (!originalImage.value.src) return

  if (type === 'rect') {
    isDragging.value = true
    dragStartCropPos.x = rectCrop.x
    dragStartCropPos.y = rectCrop.y
    const touch = e.touches[0]
    dragStartMousePos.x = touch.clientX
    dragStartMousePos.y = touch.clientY
  } else if (type === 'quad') {
    isDragging.value = true
    dragPoint.value = pointIndex !== undefined ? pointIndex : -1
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (!originalImage.value.src || !isDragging.value) return
  e.preventDefault()

  if (cropMode.value === 'rect') {
    const touch = e.touches[0]
    const dx = touch.clientX - dragStartMousePos.x
    const dy = touch.clientY - dragStartMousePos.y

    rectCrop.x = Math.max(0, Math.min(containerSize.width - rectCrop.width, dragStartCropPos.x + dx))
    rectCrop.y = Math.max(0, Math.min(containerSize.height - rectCrop.height, dragStartCropPos.y + dy))
  } else if (cropMode.value === 'quad' && dragPoint.value >= 0) {
    const rect = containerRef.value?.getBoundingClientRect()
    if (!rect) return

    const touch = e.touches[0]
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    quadPoints[dragPoint.value] = {
      x: Math.max(0, Math.min(containerSize.width, x)),
      y: Math.max(0, Math.min(containerSize.height, y))
    }
  }
}

const handleTouchEnd = () => {
  if (isDragging.value) {
    // 拖动结束时立即更新预览
    if (originalImage.value.src && containerSize.width > 0) {
      doCrop()
    }
  }
  isDragging.value = false
  dragPoint.value = -1
}

// 缩放控制
const zoomIn = () => {
  imageScale.value = Math.min(imageScale.value * 1.2, 5)
}

const zoomOut = () => {
  imageScale.value = Math.max(imageScale.value / 1.2, 0.2)
}

const resetZoom = () => {
  resetImagePosition()
}

// 预设尺寸变化
watch(selectedPreset, (val) => {
  const preset = presetSizes.find(p => p.name === val)
  if (preset) {
    customWidth.value = preset.width
    customHeight.value = preset.height
    initCropBox()
  }
})

watch([customWidth, customHeight], () => {
  initCropBox()
})

watch(cropMode, () => {
  initCropBox()
})

// 实时预览：监听非拖动的变化
watch(
  [imageScale, cropMode, customWidth, customHeight, bgColor, outputFormat, imageQuality, imageOffsetInContainer],
  () => {
    if (originalImage.value.src && containerSize.width > 0 && !isDragging.value) {
      doCrop()
    }
  },
  { deep: true }
)

// 拖动裁剪框时也监听，但不实时更新
watch(
  [rectCrop, quadPoints],
  () => {
    // 拖动过程中不更新，只在松开时更新
  },
  { deep: true }
)

// 执行裁剪
const doCrop = () => {
  if (!originalImage.value.src || containerSize.width === 0) return

  const outputCanvas = document.createElement('canvas')
  const ctx = outputCanvas.getContext('2d')
  if (!ctx) return

  outputCanvas.width = customWidth.value
  outputCanvas.height = customHeight.value

  // 填充背景色
  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height)

  // 计算从原始图像到显示的缩放比例
  const totalScale = (containerSize.width * imageScale.value) / originalImage.value.naturalWidth

  // 获取图片在容器中的偏移（因为图片居中显示）
  const offsetX = imageOffsetInContainer.value.x
  const offsetY = imageOffsetInContainer.value.y

  if (cropMode.value === 'rect') {
    // 矩形裁剪 - 减去图片偏移量
    const srcX = (rectCrop.x - offsetX) / totalScale
    const srcY = (rectCrop.y - offsetY) / totalScale
    const srcW = rectCrop.width / totalScale
    const srcH = rectCrop.height / totalScale

    ctx.drawImage(
      originalImage.value,
      srcX, srcY, srcW, srcH,
      0, 0, outputCanvas.width, outputCanvas.height
    )
  } else {
    // 四边形透视裁剪 - 减去图片偏移量
    const adjustedPoints = quadPoints.map(p => ({
      x: (p.x - offsetX) / totalScale,
      y: (p.y - offsetY) / totalScale
    }))

    perspectiveCrop(
      ctx,
      originalImage.value,
      adjustedPoints,
      outputCanvas.width,
      outputCanvas.height
    )
  }

  croppedImageSrc.value = outputCanvas.toDataURL(
    outputFormat.value === 'jpg' ? 'image/jpeg' : 'image/png',
    imageQuality.value / 100
  )
}

// 透视裁剪算法
const perspectiveCrop = (
  ctx: CanvasRenderingContext2D,
  img: any,
  srcPoints: { x: number; y: number }[],
  dstWidth: number,
  dstHeight: number
) => {
  const srcCorners = srcPoints
  const dstCorners = [
    { x: 0, y: 0 },
    { x: dstWidth, y: 0 },
    { x: dstWidth, y: dstHeight },
    { x: 0, y: dstHeight },
  ]

  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = img.naturalWidth
  tempCanvas.height = img.naturalHeight
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return
  tempCtx.drawImage(img, 0, 0)
  const srcData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)

  const dstData = ctx.createImageData(dstWidth, dstHeight)

  const matrix = computePerspectiveTransform(srcCorners, dstCorners)
  const inverseMatrix = invertMatrix(matrix)

  for (let dy = 0; dy < dstHeight; dy++) {
    for (let dx = 0; dx < dstWidth; dx++) {
      const result = transformPoint(dx, dy, inverseMatrix)
      const sx = result.x
      const sy = result.y

      if (sx >= 0 && sx < img.naturalWidth && sy >= 0 && sy < img.naturalHeight) {
        const x0 = Math.floor(sx)
        const y0 = Math.floor(sy)
        const x1 = Math.min(x0 + 1, img.naturalWidth - 1)
        const y1 = Math.min(y0 + 1, img.naturalHeight - 1)
        const fx = sx - x0
        const fy = sy - y0

        for (let c = 0; c < 4; c++) {
          const i00 = ((y0 * img.naturalWidth + x0) * 4) + c
          const i10 = ((y0 * img.naturalWidth + x1) * 4) + c
          const i01 = ((y1 * img.naturalWidth + x0) * 4) + c
          const i11 = ((y1 * img.naturalWidth + x1) * 4) + c

          const v00 = srcData.data[i00]
          const v10 = srcData.data[i10]
          const v01 = srcData.data[i01]
          const v11 = srcData.data[i11]

          const value =
            v00 * (1 - fx) * (1 - fy) +
            v10 * fx * (1 - fy) +
            v01 * (1 - fx) * fy +
            v11 * fx * fy

          dstData.data[((dy * dstWidth + dx) * 4) + c] = value
        }
        dstData.data[((dy * dstWidth + dx) * 4) + 3] = 255
      }
    }
  }

  ctx.putImageData(dstData, 0, 0)
}

const computePerspectiveTransform = (src: any[], dst: any[]) => {
  const A: number[][] = []
  const b: number[] = []

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x, sy = src[i].y
    const dx = dst[i].x, dy = dst[i].y

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy])
    b.push(dx)

    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy])
    b.push(dy)
  }

  const h = solveLinearSystem(A, b)
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1]
  ]
}

const solveLinearSystem = (A: number[][], b: number[]) => {
  const n = A.length
  const augmented = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]]

    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col]
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j]
      }
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n]
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j]
    }
    x[i] /= augmented[i][i]
  }

  return x
}

const invertMatrix = (m: number[][]) => {
  const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
               m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
               m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])

  if (Math.abs(det) < 1e-10) return m

  const invDet = 1 / det
  return [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invDet,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invDet,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invDet
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invDet,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invDet,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invDet
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invDet,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invDet,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invDet
    ]
  ]
}

const transformPoint = (x: number, y: number, matrix: number[][]) => {
  const w = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2]
  return {
    x: (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2]) / w,
    y: (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]) / w
  }
}

// 下载图片
const downloadImage = () => {
  if (!croppedImageSrc.value) return

  const link = document.createElement('a')
  link.href = croppedImageSrc.value
  link.download = `id-photo-${customWidth.value}x${customHeight.value}.${outputFormat.value}`
  link.click()
}

// 重置
const resetCrop = () => {
  resetImagePosition()
  croppedImageSrc.value = ''
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd)
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white">
      <!-- 上传区域 -->
      <el-upload
        v-model:file-list="fileList"
        class="w-full"
        ref="dataFileRef"
        accept="image/*"
        :http-request="updateDataFile"
        :on-exceed="handleExceed"
        :limit="1"
        drag
      >
        <div class="el-upload__text">
          拖拽图片到此处或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 JPG、PNG 等常见图片格式
          </div>
        </template>
      </el-upload>

      <!-- 设置区域 -->
      <div v-if="uploadedImageSrc" class="mt-4 space-y-3">
        <!-- 尺寸设置 -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <el-text class="whitespace-nowrap">预设尺寸:</el-text>
            <el-select v-model="selectedPreset" class="w-full sm:w-32">
              <el-option
                v-for="item in presetSizes"
                :key="item.name"
                :label="item.name"
                :value="item.name"
              />
            </el-select>
          </div>

          <div>
            <el-text class="whitespace-nowrap block mb-2 sm:hidden">自定义尺寸 (像素):</el-text>
            <div class="flex items-center gap-2">
              <el-text class="whitespace-nowrap hidden sm:inline">自定义尺寸 (像素):</el-text>
              <el-input-number v-model="customWidth" :min="50" :max="4000" />
              <el-text>×</el-text>
              <el-input-number v-model="customHeight" :min="50" :max="4000" />
            </div>
          </div>
        </div>

        <!-- 裁剪模式 -->
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div class="flex items-center gap-2">
            <el-text class="whitespace-nowrap">裁剪模式:</el-text>
            <el-radio-group v-model="cropMode">
              <el-radio-button value="rect">矩形</el-radio-button>
              <el-radio-button value="quad">四边形</el-radio-button>
            </el-radio-group>
          </div>

          <div class="flex items-center gap-2">
            <el-text class="whitespace-nowrap">背景色:</el-text>
            <el-color-picker v-model="bgColor" show-alpha />
          </div>
        </div>

        <!-- 输出设置 -->
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div class="flex items-center gap-2">
            <el-text class="whitespace-nowrap">输出格式:</el-text>
            <el-radio-group v-model="outputFormat">
              <el-radio-button value="png">PNG</el-radio-button>
              <el-radio-button value="jpg">JPG</el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="outputFormat === 'jpg'" class="flex items-center gap-2">
            <el-text class="whitespace-nowrap">质量:</el-text>
            <el-slider v-model="imageQuality" :min="50" :max="100" class="w-24 sm:w-32" />
            <el-text>{{ imageQuality }}%</el-text>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex flex-wrap gap-2">
          <el-button :icon="RefreshLeft" @click="resetCrop">重置</el-button>
          <el-button
            type="success"
            :icon="Download"
            @click="downloadImage"
            :disabled="!croppedImageSrc"
          >
            下载
          </el-button>
        </div>

        <!-- 图片预览区域 -->
        <div class="flex flex-col lg:flex-row gap-4">
          <!-- 原图编辑区 -->
          <div class="flex-1 w-full lg:w-auto">
            <div class="flex justify-between items-center mb-2">
              <el-text class="text-sm">拖动蓝色矩形框选择裁剪区域</el-text>
              <div class="flex gap-1">
                <el-button size="small" :icon="ZoomOut" @click="zoomOut">缩小</el-button>
                <el-button size="small" @click="resetZoom">重置</el-button>
                <el-button size="small" :icon="ZoomIn" @click="zoomIn">放大</el-button>
              </div>
            </div>
            <div class="text-sm text-gray-500 mb-2 flex justify-between">
              <span>原图: {{ originalImage.naturalWidth }} × {{ originalImage.naturalHeight }} 像素</span>
              <span>缩放: {{ (imageScale * 100).toFixed(0) }}%</span>
            </div>
            <div
              ref="containerRef"
              class="relative bg-gray-100 border border-gray-300 rounded overflow-hidden select-none mx-auto"
              :style="imageContainerStyle"
            >
              <!-- 图片容器（图片固定） -->
              <div
                class="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
                :style="{ width: '100%', height: '100%' }"
              >
                <img
                  :src="uploadedImageSrc"
                  class="max-w-none origin-center select-none"
                  :style="imageStyle"
                  alt="原图"
                >
              </div>

              <!-- 矩形裁剪框（可拖动） -->
              <div
                v-if="cropMode === 'rect'"
                class="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move"
                :style="cropBoxStyle"
                @mousedown="handleMouseDown($event, 'rect')"
                @touchstart="handleTouchStart($event, 'rect')"
              >
                <div class="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                <div class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                <div class="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                <!-- 十字线 -->
                <div class="absolute top-0 bottom-0 left-1/2 w-px bg-blue-400/50"></div>
                <div class="absolute left-0 right-0 top-1/2 h-px bg-blue-400/50"></div>
              </div>

              <!-- 四边形裁剪框 -->
              <template v-else>
                <svg class="absolute inset-0 w-full h-full pointer-events-none">
                  <polygon
                    :points="quadPoints.map(p => p.x + ',' + p.y).join(' ')"
                    fill="rgba(59, 130, 246, 0.15)"
                    stroke="#3b82f6"
                    stroke-width="2"
                  />
                  <line
                    v-for="(p, i) in quadPoints"
                    :key="'line-' + i"
                    :x1="p.x"
                    :y1="p.y"
                    :x2="quadPoints[(i + 1) % 4].x"
                    :y2="quadPoints[(i + 1) % 4].y"
                    stroke="#3b82f6"
                    stroke-width="2"
                  />
                </svg>
                <div
                  v-for="(p, i) in quadPoints"
                  :key="i"
                  class="absolute w-4 h-4 bg-blue-500 rounded-full cursor-move transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto border-2 border-white"
                  :style="{ left: p.x + 'px', top: p.y + 'px' }"
                  @mousedown.stop="handleMouseDown($event, 'quad', i)"
                  @touchstart.stop="handleTouchStart($event, 'quad', i)"
                ></div>
              </template>
            </div>
          </div>

          <!-- 预览区 -->
          <div class="w-full lg:w-80 shrink-0">
            <el-text class="mb-2 block">预览结果</el-text>
            <div class="bg-gray-100 border border-gray-300 rounded p-4 flex items-center justify-center min-h-[180px]">
              <img
                v-if="croppedImageSrc"
                :src="croppedImageSrc"
                class="max-w-full max-h-[300px] object-contain"
                alt="预览"
              >
              <el-empty v-else description="等待图片上传..." :image-size="100" />
            </div>

            <!-- 尺寸信息 -->
            <div v-if="croppedImageSrc" class="mt-2 text-sm text-gray-500 text-center">
              {{ customWidth }} × {{ customHeight }} 像素 | {{ outputFormat.toUpperCase() }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-3">
        <el-text tag="div">
          <strong>证件照生成工具</strong>可以帮助您快速裁剪和调整照片尺寸，满足各种证件照的要求。
        </el-text>

        <el-text tag="div">
          <strong>功能特点：</strong>
        </el-text>
        <ul class="list-disc pl-5 space-y-1">
          <li>支持多种预设证件照尺寸（一寸、二寸、护照、身份证等）</li>
          <li>支持自定义任意尺寸</li>
          <li>支持图片等比缩放，方便从大图中选择人脸区域</li>
          <li>支持拖动图片调整位置</li>
          <li>矩形裁剪模式：标准的矩形裁剪，适合正面对照照片</li>
          <li>四边形裁剪模式：支持透视裁剪，可纠正拍摄角度造成的变形</li>
          <li>支持 PNG（透明背景）和 JPG 格式输出</li>
          <li>JPG 格式可调节压缩质量（50%-100%）</li>
          <li>支持自定义背景色（适合 PNG 透明背景时使用）</li>
        </ul>

        <el-text tag="div">
          <strong>使用步骤：</strong>
        </el-text>
        <ol class="list-decimal pl-5 space-y-1">
          <li>上传或拖拽照片到上传区域</li>
          <li>选择预设尺寸或输入自定义尺寸</li>
          <li>选择裁剪模式（矩形/四边形）</li>
          <li>使用缩放按钮调整图片大小，拖动图片调整位置</li>
          <li>预览会实时自动更新，满意后点击"下载"保存图片</li>
        </ol>

        <el-text tag="div">
          <strong>常见证件照尺寸参考：</strong>
        </el-text>
        <ul class="list-disc pl-5 space-y-1">
          <li>一寸：295×413px（25×35mm）</li>
          <li>二寸：413×579px（35×49mm）</li>
          <li>小一寸：260×378px（22×32mm）</li>
          <li>小二寸：390×567px（33×48mm）</li>
          <li>护照/签证：330×480px（33×48mm）</li>
          <li>身份证：358×441px</li>
        </ul>
      </div>
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
:deep(.el-upload-dragger) {
  width: 100% !important;
  height: auto !important;
  min-height: 120px;
  padding: 20px;
}
</style>

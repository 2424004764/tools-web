<script setup lang="ts">
import { reactive, ref } from 'vue'
import { UploadProps, UploadRawFile, genFileId } from 'element-plus'
import { Download, Switch } from '@element-plus/icons-vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "PNG/JPG格式互转",
})

type TargetFormat = 'png' | 'jpeg'

const fileList = ref()
const uploadRef = ref()
const sourceFormat = ref<'png' | 'jpeg' | ''>('')
const targetFormat = ref<TargetFormat>('jpeg')
const originalSrc = ref('')
const originalSize = ref(0)
const convertedSrc = ref('')
const convertedSize = ref(0)
const jpegQuality = ref(0.92)
const converting = ref(false)

const formatLabel = (fmt: TargetFormat) => fmt === 'jpeg' ? 'JPG' : 'PNG'
const formatSize = (bytes: number) => {
  if (bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
const sizePercent = () => {
  if (originalSize.value === 0 || convertedSize.value === 0) return 0
  return Math.round((1 - convertedSize.value / originalSize.value) * 100)
}

const detectFormat = (file: File): 'png' | 'jpeg' => {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'png'
  return 'jpeg'
}

const doConvert = () => {
  if (!originalSrc.value) return
  converting.value = true

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    const mimeType = targetFormat.value === 'png' ? 'image/png' : 'image/jpeg'
    const quality = targetFormat.value === 'jpeg' ? jpegQuality.value : undefined
    const dataUrl = canvas.toDataURL(mimeType, quality)
    convertedSrc.value = dataUrl

    // 计算转换后的文件大小
    const base64 = dataUrl.split(',')[1]
    convertedSize.value = Math.round((base64.length * 3) / 4)

    converting.value = false
  }
  img.src = originalSrc.value
}

const handleUpload = async (params: any) => {
  const file = params.file as File
  sourceFormat.value = detectFormat(file)
  originalSize.value = file.size

  // 默认目标格式：PNG→JPG，JPG→PNG
  targetFormat.value = sourceFormat.value === 'png' ? 'jpeg' : 'png'

  const reader = new FileReader()
  reader.onload = () => {
    originalSrc.value = reader.result as string
    // 自动触发转换
    setTimeout(() => doConvert(), 100)
  }
  reader.readAsDataURL(file)
}

const handleExceed: UploadProps['onExceed'] = (files) => {
  uploadRef.value!.clearFiles()
  const file = files[0] as UploadRawFile
  file.uid = genFileId()
  uploadRef.value!.handleStart(file)
  uploadRef.value!.submit()
}

const switchFormat = () => {
  targetFormat.value = targetFormat.value === 'jpeg' ? 'png' : 'jpeg'
  doConvert()
}

const download = () => {
  if (!convertedSrc.value) return
  const a = document.createElement('a')
  a.href = convertedSrc.value
  a.download = `converted.${targetFormat.value === 'jpeg' ? 'jpg' : 'png'}`
  a.click()
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 上传区域 -->
      <el-upload
        v-model:file-list="fileList"
        ref="uploadRef"
        accept="image/png,image/jpeg,image/jpg"
        :http-request="handleUpload"
        :on-exceed="handleExceed"
        :limit="1"
        class="mb-4"
        drag
      >
        <el-button type="primary" size="large">
          上传 PNG 或 JPG 图片
        </el-button>
        <template #tip>
          <div class="el-upload__tip text-gray-400 mt-1">
            支持 PNG、JPG 格式，自动检测并转换
          </div>
        </template>
      </el-upload>

      <!-- 转换控制和预览 -->
      <div v-if="originalSrc" class="flex flex-col gap-4">
        <!-- 格式切换栏 -->
        <div class="flex items-center gap-3 flex-wrap bg-gray-50 rounded-lg p-3">
          <el-tag type="info" size="large">{{ sourceFormat.toUpperCase() }}</el-tag>
          <el-icon :size="18" class="text-gray-500"><Switch /></el-icon>
          <el-tag :type="targetFormat === 'jpeg' ? 'warning' : 'primary'" size="large">
            {{ formatLabel(targetFormat) }}
          </el-tag>
          <el-button size="small" @click="switchFormat" :icon="Switch" circle />

          <!-- JPG 质量滑块 -->
          <div v-if="targetFormat === 'jpeg'" class="flex items-center gap-2 ml-2">
            <span class="text-sm text-gray-500 whitespace-nowrap">质量:</span>
            <el-slider
              v-model="jpegQuality"
              :min="0.1"
              :max="1"
              :step="0.01"
              :format-tooltip="(v: number) => Math.round(v * 100) + '%'"
              class="!w-32"
              size="small"
              @change="doConvert"
            />
            <span class="text-sm text-gray-600 w-10">{{ Math.round(jpegQuality * 100) }}%</span>
          </div>

          <el-button type="primary" size="small" @click="download" :disabled="!convertedSrc">
            <el-icon class="mr-1"><Download /></el-icon>
            下载 {{ formatLabel(targetFormat) }}
          </el-button>
        </div>

        <!-- 预览对比区域 -->
        <div class="flex flex-col md:flex-row gap-4">
          <!-- 原图 -->
          <div class="flex-1 border rounded-lg overflow-hidden">
            <div class="bg-gray-100 px-3 py-2 text-sm font-medium flex justify-between items-center">
              <span>原图 ({{ sourceFormat.toUpperCase() }})</span>
              <span class="text-gray-500">{{ formatSize(originalSize) }}</span>
            </div>
            <div class="flex items-center justify-center bg-[repeating-conic-gradient(#eee_0%_25%,transparent_0%_50%)_50%/20px_20px] p-2 min-h-[200px]">
              <img :src="originalSrc" class="max-w-full max-h-[400px] object-contain" alt="原图" />
            </div>
          </div>

          <!-- 转换后 -->
          <div class="flex-1 border rounded-lg overflow-hidden" :class="{ 'opacity-50': converting }">
            <div class="bg-gray-100 px-3 py-2 text-sm font-medium flex justify-between items-center">
              <span>转换后 ({{ formatLabel(targetFormat) }})</span>
              <span class="flex items-center gap-2">
                <span v-if="sizePercent() > 0" class="text-green-600 text-xs">-{{ sizePercent() }}%</span>
                <span v-else-if="sizePercent() < 0" class="text-orange-500 text-xs">+{{ Math.abs(sizePercent()) }}%</span>
                <span class="text-gray-500">{{ formatSize(convertedSize) }}</span>
              </span>
            </div>
            <div class="flex items-center justify-center bg-[repeating-conic-gradient(#eee_0%_25%,transparent_0%_50%)_50%/20px_20px] p-2 min-h-[200px]">
              <img v-if="convertedSrc" :src="convertedSrc" class="max-w-full max-h-[400px] object-contain" alt="转换后" />
              <span v-else class="text-gray-400">转换中...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="flex items-center justify-center min-h-[200px]">
        <el-empty description="上传图片即可开始转换" :image-size="80" />
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>
        在线 PNG 与 JPG 格式互转工具。<br>
        上传 PNG 或 JPG 图片，自动识别格式并转换为目标格式；<br>
        转换 JPG 时可调节输出质量（10%~100%）；<br>
        预览区域对比原图与转换后效果，显示文件大小变化；<br>
        纯前端 Canvas 处理，无需上传服务器，保护隐私安全。
      </el-text>
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
</style>

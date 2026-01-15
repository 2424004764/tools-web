<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'

const info = reactive({
  title: "图片、Base64互转",
})

const base64Result = ref('')
const fileName = ref('')
const fileSize = ref('')
const isDragOver = ref(false)
const isLoading = ref(false)

// Base64 转 图片相关
const base64Input = ref('')
const imagePreview = ref('')
const imageFormat = ref('png')
const isImageValid = ref(false)

// 处理文件上传
const handleFileUpload = (file: File) => {
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }

  isLoading.value = true
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    base64Result.value = result
    fileName.value = file.name
    fileSize.value = formatFileSize(file.size)
    isLoading.value = false
    ElMessage.success('图片转换完成')
  }
  
  reader.onerror = () => {
    isLoading.value = false
    ElMessage.error('图片转换失败，请重试')
  }
  
  reader.readAsDataURL(file)
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 处理拖拽
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
  if (files && files.length > 0) {
    handleFileUpload(files[0])
  }
}

// 处理文件选择
const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    handleFileUpload(files[0])
  }
}

// 复制base64
const copyBase64 = async () => {
  if (base64Result.value) {
    await copy(base64Result.value)
    ElMessage.success('Base64编码已复制到剪贴板')
  }
}

// 清空结果
const clearResult = () => {
  base64Result.value = ''
  fileName.value = ''
  fileSize.value = ''
}

// Base64 转 图片功能
const convertBase64ToImage = () => {
  if (!base64Input.value.trim()) {
    imagePreview.value = ''
    isImageValid.value = false
    return
  }

  let base64Str = base64Input.value.trim()

  try {
    // 检查是否包含 data URI 前缀
    if (base64Str.includes('data:image/')) {
      // 已包含 data URI，直接使用
      imagePreview.value = base64Str

      // 提取图片格式
      const match = base64Str.match(/data:image\/(\w+);/)
      if (match) {
        imageFormat.value = match[1]
      }
      isImageValid.value = true
    } else {
      // 纯 Base64 字符串，需要添加前缀
      // 尝试自动检测格式
      let format = 'png'

      // 根据文件头判断格式
      const signature = base64Str.substring(0, 10)
      if (signature.startsWith('/9j/')) {
        format = 'jpeg'
      } else if (signature.startsWith('iVBORw')) {
        format = 'png'
      } else if (signature.startsWith('R0lGO')) {
        format = 'gif'
      } else if (signature.startsWith('UklGR')) {
        format = 'webp'
      } else if (signature.startsWith('PHN2Zw')) {
        format = 'svg+xml'
      }

      imageFormat.value = format
      imagePreview.value = `data:image/${format};base64,${base64Str}`

      // 验证是否是有效的图片
      const img = new Image()
      img.onload = () => {
        isImageValid.value = true
      }
      img.onerror = () => {
        isImageValid.value = false
      }
      img.src = imagePreview.value
    }
  } catch (e) {
    isImageValid.value = false
    imagePreview.value = ''
  }
}

// 下载转换后的图片
const downloadImage = () => {
  if (!imagePreview.value) return

  const link = document.createElement('a')
  link.href = imagePreview.value
  link.download = `image.${imageFormat.value === 'jpeg' ? 'jpg' : imageFormat.value}`
  link.click()
  ElMessage.success('图片下载成功')
}

// 从剪贴板粘贴 Base64
const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
    base64Input.value = text
    convertBase64ToImage()
    if (isImageValid.value) {
      ElMessage.success('Base64已粘贴并转换为图片')
    }
  } catch (err) {
    ElMessage.error('无法读取剪贴板，请手动粘贴')
  }
}

// 清空 Base64 转 图片
const clearBase64ToImage = () => {
  base64Input.value = ''
  imagePreview.value = ''
  isImageValid.value = false
  imageFormat.value = 'png'
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 上传区域 -->
      <div class="mb-6">
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors relative"
          :class="{ 'border-blue-500 bg-blue-50': isDragOver }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <!-- Loading遮罩 -->
          <div v-if="isLoading" class="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10 rounded-lg">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p class="text-gray-600">正在处理图片...</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <div class="text-gray-400">
              <svg class="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div>
              <p class="text-lg font-medium text-gray-900">拖拽图片到此处或点击上传</p>
              <p class="text-sm text-gray-500">支持 JPG、PNG、GIF、WebP 等格式</p>
            </div>
            <div>
              <label class="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" :class="{ 'opacity-50 cursor-not-allowed': isLoading }">
                选择图片
                <input type="file" accept="image/*" class="hidden" @change="handleFileSelect" :disabled="isLoading" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件信息 -->
      <div v-if="fileName" class="mb-4 p-4 bg-gray-50 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-gray-900">{{ fileName }}</p>
            <p class="text-sm text-gray-500">文件大小: {{ fileSize }}</p>
          </div>
          <button
            @click="clearResult"
            class="text-red-600 hover:text-red-800 text-sm"
            :disabled="isLoading"
          >
            清空
          </button>
        </div>
      </div>

      <!-- Base64结果 -->
      <div v-if="base64Result" class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900">Base64编码结果</h3>
          <button
            @click="copyBase64"
            class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            :disabled="isLoading"
          >
            复制Base64
          </button>
        </div>

        <div class="bg-gray-50 rounded-lg p-4">
          <textarea
            :value="base64Result"
            readonly
            class="w-full h-32 p-3 border border-gray-300 rounded-md bg-white resize-none"
            placeholder="Base64编码将显示在这里..."
          ></textarea>
        </div>

        <!-- 预览 -->
        <div class="mt-4">
          <h4 class="text-md font-medium text-gray-900 mb-2">图片预览</h4>
          <div class="border border-gray-300 rounded-lg p-4 bg-white">
            <img :src="base64Result" alt="预览图片" class="max-w-full max-h-64 mx-auto" />
          </div>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="my-8 border-t border-gray-200"></div>

      <!-- Base64 转 图片 -->
      <div class="space-y-4">
        <h3 class="text-xl font-semibold text-gray-900">Base64 转 图片</h3>
        <p class="text-sm text-gray-600">将 Base64 字符串转换为图片，支持自动识别图片格式</p>

        <!-- 输入区域 -->
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="mb-2 flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700">输入 Base64 字符串</label>
            <div class="flex gap-2">
              <button
                @click="pasteFromClipboard"
                class="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
              >
                从剪贴板粘贴
              </button>
              <button
                v-if="base64Input"
                @click="clearBase64ToImage"
                class="text-sm bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 transition-colors"
              >
                清空
              </button>
            </div>
          </div>
          <textarea
            v-model="base64Input"
            @input="convertBase64ToImage"
            class="w-full h-32 p-3 border border-gray-300 rounded-md bg-white resize-none"
            placeholder="在此粘贴 Base64 字符串，例如：iVBORw0KGgoAAAANS... 或 data:image/png;base64,iVBORw0KG..."
          ></textarea>
        </div>

        <!-- 转换按钮 -->
        <div class="flex gap-2">
          <button
            @click="convertBase64ToImage"
            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            :disabled="!base64Input"
          >
            转换为图片
          </button>
          <button
            v-if="imagePreview && isImageValid"
            @click="downloadImage"
            class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            下载图片
          </button>
        </div>

        <!-- 图片预览区域 -->
        <div v-if="base64Input">
          <div v-if="imagePreview && isImageValid" class="border border-gray-300 rounded-lg p-4 bg-white">
            <div class="mb-2 flex items-center justify-between">
              <h4 class="text-md font-medium text-gray-900">图片预览 (格式: {{ imageFormat.toUpperCase() }})</h4>
            </div>
            <img
              :src="imagePreview"
              alt="转换后的图片"
              class="max-w-full max-h-96 mx-auto rounded shadow-sm"
            />
          </div>

          <!-- 错误提示 -->
          <div v-else class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div class="flex">
              <svg class="h-5 w-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div class="text-sm text-yellow-700">
                无法生成图片预览，请检查 Base64 字符串是否正确。支持的格式：PNG、JPG、GIF、WebP、SVG
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="工具说明">
      <div class="space-y-3">
        <el-text>
          <strong>图片转 Base64：</strong>将图片文件转换为 Base64 编码格式。Base64 编码后的图片可以直接嵌入到 HTML、CSS 或 JavaScript 代码中使用，无需额外的文件请求。支持拖拽上传和点击上传，支持 JPG、PNG、GIF、WebP 等常见图片格式。
        </el-text>
        <el-divider />
        <el-text>
          <strong>Base64 转 图片：</strong>将 Base64 字符串还原为图片文件，支持自动识别图片格式（PNG、JPG、GIF、WebP、SVG），可以直接预览和下载。
        </el-text>
        <el-divider />
        <el-text>
          <strong>双向转换：</strong>本工具支持图片与 Base64 编码的双向互转，既可以将图片转为 Base64 用于网页开发，也可以将 Base64 字符串还原为图片文件。
        </el-text>
        <el-divider />
        <el-text>
          <strong>常见用途：</strong>
          <ul class="list-disc list-inside mt-2 ml-4">
            <li>HTML/CSS 中内嵌小图片</li>
            <li>邮件附件图片编码</li>
            <li>图片数据验证与调试</li>
            <li>移动端应用图标内嵌</li>
            <li>图片格式转换与备份</li>
          </ul>
        </el-text>
      </div>
    </ToolDetail>

  </div>
</template>

<style scoped>
</style>
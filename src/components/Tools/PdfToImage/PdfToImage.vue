<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'

// PDF.js 相关
let pdfjsLib: any = null

const info = reactive({
  title: "PDF转图片",
})

// 状态管理
const isLoading = ref(false)
const isDragging = ref(false)
const convertedImages = ref<string[]>([])
const currentPdfName = ref('')
const progressText = ref('')
const currentProgress = ref(0)

// 转换设置
const settings = reactive({
  dpi: 300, // 高分辨率设置
  format: 'png', // 输出格式
  quality: 1.0 // 质量设置
})

// 异步加载 PDF.js
const loadPDFJS = async () => {
  try {
    console.log('开始加载PDF.js...')
    const pdfjs = await import('pdfjs-dist')
    
    // 使用你放置的本地worker文件
    pdfjs.GlobalWorkerOptions.workerSrc = '/js/pdf.min.mjs'
    
    pdfjsLib = pdfjs
    console.log('PDF.js 加载成功, version:', pdfjs.version)
    
  } catch (error) {
    console.error('PDF.js 加载失败:', error)
    ElMessage.error('PDF.js 库加载失败，请刷新页面重试')
  }
}

// 组件挂载时加载库
onMounted(() => {
  loadPDFJS()
})

// 文件处理
const handleFileSelect = (files: FileList | null) => {
  if (!files || files.length === 0) return
  
  const file = files[0]
  if (file.type !== 'application/pdf') {
    ElMessage.error('请选择PDF文件')
    return
  }
  
  console.log('选择的PDF文件:', file.name, '大小:', file.size)
  currentPdfName.value = file.name
  convertPdfToImages(file)
}

// PDF转图片核心功能
const convertPdfToImages = async (file: File) => {
  if (!pdfjsLib) {
    ElMessage.error('PDF.js 库未加载完成，请稍后重试')
    return
  }
  
  isLoading.value = true
  convertedImages.value = []
  progressText.value = '正在读取PDF文件...'
  currentProgress.value = 0
  
  try {
    console.log('开始转换PDF...', file.name, file.size)
    const arrayBuffer = await file.arrayBuffer()
    console.log('PDF文件读取完成, 大小:', arrayBuffer.byteLength)
    
    progressText.value = '正在解析PDF结构...'
    console.log('开始解析PDF...')
    
    // 使用最简单的配置
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer
    }).promise
    
    const numPages = pdf.numPages
    console.log('PDF解析完成, 总页数:', numPages)
    ElMessage.success(`PDF加载成功，共${numPages}页，开始转换...`)
    
    // 转换每一页
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      progressText.value = `正在转换第 ${pageNum}/${numPages} 页...`
      currentProgress.value = Math.round((pageNum - 1) / numPages * 100)
      
      console.log(`开始转换第${pageNum}页`)
      
      const page = await pdf.getPage(pageNum)
      console.log(`第${pageNum}页获取成功`)
      
      // 设置分辨率
      const scale = settings.dpi / 72
      const viewport = page.getViewport({ scale })
      console.log(`第${pageNum}页视窗尺寸:`, viewport.width, 'x', viewport.height)
      
      // 创建canvas
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      console.log(`开始渲染第${pageNum}页到canvas`)
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      console.log(`第${pageNum}页渲染完成`)
      
      // 转换为图片
      const imageDataUrl = canvas.toDataURL(`image/${settings.format}`, settings.quality)
      convertedImages.value.push(imageDataUrl)
      console.log(`第${pageNum}页转换为图片完成`)
      
      // 更新进度
      currentProgress.value = Math.round(pageNum / numPages * 100)
      
      // 让UI有机会更新
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    progressText.value = '转换完成！'
    console.log('所有页面转换完成')
    ElMessage.success(`转换完成！共生成${numPages}张图片`)
    
  } catch (error) {
    console.error('PDF转换失败:', error)
    progressText.value = '转换失败'
    
    // 修复TypeScript错误：添加类型检查
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    ElMessage.error(`PDF转换失败: ${errorMessage}`)
  } finally {
    isLoading.value = false
    currentProgress.value = 0
    progressText.value = ''
  }
}

// 下载图片
const downloadImage = (imageDataUrl: string, index: number) => {
  const link = document.createElement('a')
  link.href = imageDataUrl
  link.download = `${currentPdfName.value.replace('.pdf', '')}_第${index + 1}页.${settings.format}`
  link.click()
}

// 下载所有图片
const downloadAllImages = () => {
  convertedImages.value.forEach((imageDataUrl, index) => {
    setTimeout(() => {
      downloadImage(imageDataUrl, index)
    }, index * 100)
  })
}

// 拖拽处理
const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  
  const files = e.dataTransfer?.files
  if (files) {
    handleFileSelect(files)
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

// 清除结果
const clearResults = () => {
  convertedImages.value = []
  currentPdfName.value = ''
}

// 修复文件选择函数的类型问题
const handleFileChange = (uploadFile: any) => {
  if (!uploadFile?.raw) return
  
  const file = uploadFile.raw as File
  if (file.type !== 'application/pdf') {
    ElMessage.error('请选择PDF文件')
    return
  }
  
  console.log('选择的PDF文件:', file.name, '大小:', file.size)
  currentPdfName.value = file.name
  convertPdfToImages(file)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white space-y-4">
      
      <!-- 转换设置 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">分辨率 (DPI)</label>
          <el-select v-model="settings.dpi" class="w-full">
            <el-option label="150 DPI (标准)" :value="150" />
            <el-option label="300 DPI (高清)" :value="300" />
            <el-option label="600 DPI (超高清)" :value="600" />
          </el-select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">输出格式</label>
          <el-select v-model="settings.format" class="w-full">
            <el-option label="PNG (推荐)" value="png" />
            <el-option label="JPG" value="jpeg" />
          </el-select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">图片质量</label>
          <el-select v-model="settings.quality" class="w-full">
            <el-option label="高质量" :value="1.0" />
            <el-option label="中等质量" :value="0.8" />
            <el-option label="压缩质量" :value="0.6" />
          </el-select>
        </div>
      </div>

      <!-- 文件上传区域 -->
      <div 
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors"
        :class="{ 'border-blue-500 bg-blue-50': isDragging }"
        @drop="handleDrop"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
      >
        <div class="flex flex-col items-center space-y-4">
          <el-icon class="text-6xl text-gray-400">
            <Document />
          </el-icon>
          <div>
            <p class="text-lg text-gray-600 mb-2">拖拽PDF文件到此处，或点击选择文件</p>
            <p class="text-sm text-gray-400">支持单个PDF文件，自动转换所有页面</p>
          </div>
          <el-upload
            class="upload-demo"
            :before-upload="() => false"
            :on-change="handleFileChange"
            :show-file-list="false"
            accept=".pdf"
            :disabled="isLoading"
          >
            <el-button type="primary" :loading="isLoading">选择PDF文件</el-button>
          </el-upload>
        </div>
      </div>

      <!-- 转换进度 -->
      <div v-if="isLoading" class="text-center py-8">
        <el-progress 
          :percentage="currentProgress" 
          :indeterminate="currentProgress === 0"
          :stroke-width="8"
          class="mb-4"
        />
        <p class="mt-2 text-gray-600">{{ progressText }}</p>
        <p class="text-sm text-gray-400 mt-1">首次转换可能需要较长时间加载...</p>
      </div>

      <!-- 当前PDF信息 -->
      <div v-if="currentPdfName && !isLoading" class="p-3 bg-blue-50 rounded-lg">
        <p class="text-sm text-blue-800">当前文件: {{ currentPdfName }}</p>
      </div>

      <!-- 转换结果 -->
      <div v-if="convertedImages.length > 0" class="space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold">转换结果 ({{ convertedImages.length }}张图片)</h3>
          <div class="space-x-2">
            <el-button @click="downloadAllImages" type="primary">
              <el-icon><Download /></el-icon>
              下载全部
            </el-button>
            <el-button @click="clearResults">清除结果</el-button>
          </div>
        </div>
        
        <!-- 图片列表 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="(imageUrl, index) in convertedImages" 
            :key="index"
            class="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div class="aspect-[3/4] bg-gray-100">
              <img 
                :src="imageUrl" 
                :alt="`第${index + 1}页`"
                class="w-full h-full object-contain"
              />
            </div>
            <div class="p-3 bg-white">
              <p class="text-sm text-gray-600 mb-2">第 {{ index + 1 }} 页</p>
              <el-button 
                @click="downloadImage(imageUrl, index)" 
                size="small" 
                type="primary" 
                class="w-full"
              >
                <el-icon><Download /></el-icon>
                下载此页
              </el-button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- 工具说明 -->
    <ToolDetail title="功能说明">
      <el-text>
        <ul class="space-y-2 text-gray-700">
          <li>• <strong>高清转换</strong>：支持150-600 DPI分辨率，确保图片清晰度</li>
          <li>• <strong>多页处理</strong>：自动转换PDF中的所有页面</li>
          <li>• <strong>格式选择</strong>：支持PNG和JPG格式输出</li>
          <li>• <strong>质量控制</strong>：可调节图片质量，平衡文件大小和清晰度</li>
          <li>• <strong>批量下载</strong>：支持单页下载和批量下载</li>
          <li>• <strong>本地处理</strong>：所有转换在浏览器本地完成，保护文件隐私</li>
        </ul>
      </el-text>
    </ToolDetail>

    <ToolDetail title="使用说明">
      <el-text>
        <ol class="space-y-2 text-gray-700">
          <li>1. 选择转换设置（分辨率、格式、质量）</li>
          <li>2. 拖拽或点击上传PDF文件</li>
          <li>3. 等待自动转换完成</li>
          <li>4. 预览转换结果</li>
          <li>5. 下载单页图片或批量下载所有图片</li>
        </ol>
      </el-text>
    </ToolDetail>

    <ToolDetail title="注意事项">
      <el-text>
        <ul class="space-y-1 text-gray-600 text-sm">
          <li>• 首次使用需要加载PDF.js库，可能需要等待几秒</li>
          <li>• 大文件或高分辨率转换需要较长时间，请耐心等待</li>
          <li>• 暂不支持密码保护的PDF文件</li>
          <li>• 建议使用现代浏览器以获得最佳体验</li>
        </ul>
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.upload-demo :deep(.el-upload) {
  border: none;
}

.upload-demo :deep(.el-upload-dragger) {
  border: none;
  background: transparent;
  width: auto;
  height: auto;
}
</style>

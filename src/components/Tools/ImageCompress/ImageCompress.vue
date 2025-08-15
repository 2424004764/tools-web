<script setup lang="ts">
import { ref, reactive, onUnmounted, onMounted } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

// 先尝试动态导入Compressor.js，避免导入问题
let Compressor: any = null

// 异步加载Compressor.js
const loadCompressor = async () => {
  try {
    const module = await import('compressorjs')
    Compressor = module.default || module
    console.log('Compressor.js 加载成功:', Compressor)
  } catch (error) {
    console.error('Compressor.js 加载失败:', error)
    alert('图片压缩库加载失败，请刷新页面重试')
  }
}

// 组件挂载时加载库
onMounted(() => {
  loadCompressor()
})

// 修改压缩配置，移除尺寸限制
const compressionConfig = reactive({
  quality: 0.6, // 降低默认质量，确保有压缩效果
  convertSize: 1000000,
  convertToWebP: false,
  retainExif: false,
  smartCompression: true,
})

// 状态
const isDragging = ref(false)
const isCompressing = ref(false)
const originalImages = ref<File[]>([])
const compressedImages = ref<CompressedImage[]>([])
const debugInfo = ref<string[]>([]) // 添加调试信息

// 文件处理
const handleFileSelect = (files: FileList | null) => {
  if (!files) return
  
  const imageFiles = Array.from(files).filter(file => 
    file.type.startsWith('image/')
  )
  
  if (imageFiles.length === 0) {
    alert('请选择图片文件')
    return
  }
  
  originalImages.value = [...originalImages.value, ...imageFiles]
  addDebugInfo(`添加了 ${imageFiles.length} 张图片`)
}

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

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}

// 添加调试信息
const addDebugInfo = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  debugInfo.value.push(`[${timestamp}] ${message}`)
  console.log(message)
}

// 压缩图片
const compressImages = async () => {
  if (originalImages.value.length === 0) return
  
  if (!Compressor) {
    alert('图片压缩库未加载，请刷新页面重试')
    return
  }
  
  isCompressing.value = true
  compressedImages.value = []
  addDebugInfo('开始压缩图片...')
  
  try {
    for (const file of originalImages.value) {
      await compressSingleImage(file)
    }
  } catch (error) {
    console.error('压缩失败:', error)
    addDebugInfo(`压缩失败: ${error}`)
    alert('压缩过程中出现错误，请重试')
  } finally {
    isCompressing.value = false
    addDebugInfo('压缩完成')
  }
}

// 修改压缩函数，移除尺寸调整逻辑
const compressSingleImage = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    addDebugInfo(`开始压缩: ${file.name} (${formatFileSize(file.size)})`)
    
    // 获取图片原始尺寸
    const img = new Image()
    img.onload = () => {
      addDebugInfo(`原图尺寸: ${img.width}×${img.height}`)
      
      // 智能压缩参数调整
      let quality = compressionConfig.quality
      
      if (compressionConfig.smartCompression) {
        // 根据文件大小调整质量
        const sizeMB = file.size / (1024 * 1024)
        if (sizeMB > 5) {
          quality = Math.min(quality, 0.5)
        } else if (sizeMB > 2) {
          quality = Math.min(quality, 0.6)
        }
        addDebugInfo(`调整后质量: ${Math.round(quality * 100)}%`)
      }
      
      addDebugInfo(`压缩参数: 质量=${Math.round(quality * 100)}%, 保持原尺寸`)
      
      // 执行压缩，不设置尺寸限制
      new Compressor(file, {
        quality: quality,
        convertSize: compressionConfig.convertSize,
        convertToWebP: compressionConfig.convertToWebP,
        retainExif: compressionConfig.retainExif,
        success: (result: File) => {
          const compressionRatio = ((file.size - result.size) / file.size * 100)
          addDebugInfo(`压缩完成: ${file.name} -> ${formatFileSize(result.size)} (压缩率: ${compressionRatio.toFixed(1)}%)`)
          
          const compressedImage: CompressedImage = {
            id: Date.now().toString() + Math.random(),
            originalFile: file,
            compressedFile: result,
            originalSize: file.size,
            compressedSize: result.size,
            compressionRatio: compressionRatio,
            url: URL.createObjectURL(result),
            actualQuality: quality,
            actualMaxWidth: img.width, // 显示原图尺寸
            actualMaxHeight: img.height
          }
          
          compressedImages.value.push(compressedImage)
          resolve()
        },
        error: (error: any) => {
          addDebugInfo(`压缩失败: ${file.name} - ${error.message || error}`)
          console.error('压缩失败:', error)
          reject(error)
        }
      })
    }
    
    img.onerror = () => {
      addDebugInfo(`无法读取图片: ${file.name}`)
      reject(new Error('无法读取图片'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}

// 修改接口定义，移除尺寸相关字段
interface CompressedImage {
  id: string
  originalFile: File
  compressedFile: File
  originalSize: number
  compressedSize: number
  compressionRatio: number
  url: string
  actualQuality?: number
  actualMaxWidth?: number // 改为显示原图尺寸
  actualMaxHeight?: number
}

const info = reactive({
  title: "图片压缩",
})

// 下载压缩后的图片
const downloadImage = (image: CompressedImage) => {
  const link = document.createElement('a')
  link.href = image.url
  link.download = `compressed_${image.originalFile.name}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 批量下载
const downloadAll = () => {
  compressedImages.value.forEach(image => {
    downloadImage(image)
  })
}

// 清空所有图片
const clearAll = () => {
  originalImages.value = []
  compressedImages.value.forEach(image => {
    URL.revokeObjectURL(image.url)
  })
  compressedImages.value = []
  debugInfo.value = []
}

// 移除单张图片
const removeImage = (index: number) => {
  const image = originalImages.value[index]
  originalImages.value.splice(index, 1)
  
  // 同时移除对应的压缩结果
  const compressedIndex = compressedImages.value.findIndex(
    comp => comp.originalFile === image
  )
  if (compressedIndex !== -1) {
    const compressed = compressedImages.value[compressedIndex]
    URL.revokeObjectURL(compressed.url)
    compressedImages.value.splice(compressedIndex, 1)
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 获取压缩建议
const getCompressionSuggestion = (file: File) => {
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > 5) {
    return '建议：大文件推荐质量0.5以下，最大尺寸1200×800'
  } else if (sizeMB > 2) {
    return '建议：中等文件推荐质量0.6以下，最大尺寸1200×800'
  } else if (sizeMB > 1) {
    return '建议：小文件推荐质量0.7以下，最大尺寸1200×800'
  } else {
    return '建议：小文件可以保持较高质量，但建议关闭EXIF保留'
  }
}

// 组件卸载时清理URL
onUnmounted(() => {
  compressedImages.value.forEach(image => {
    URL.revokeObjectURL(image.url)
  })
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 压缩配置 -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-4">压缩设置</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- 智能压缩开关 -->
          <div class="flex items-center col-span-full">
            <input
              v-model="compressionConfig.smartCompression"
              type="checkbox"
              id="smartCompression"
              class="mr-2"
            />
            <label for="smartCompression" class="text-sm font-medium text-gray-700">
              智能压缩（根据文件大小自动优化质量参数）
            </label>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">压缩质量</label>
            <div class="flex items-center space-x-2">
              <input
                v-model="compressionConfig.quality"
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                class="flex-1"
              />
              <span class="text-sm text-gray-600 w-12">{{ Math.round(compressionConfig.quality * 100) }}%</span>
            </div>
            <p class="text-xs text-gray-600 mt-1">
              图片将保持原始尺寸，仅调整压缩质量
            </p>
          </div>
          
          <!-- 移除最大宽度和最大高度配置 -->
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              转换阈值
              <span class="text-xs text-gray-500 ml-1">(超过此大小的图片自动转换为WebP格式)</span>
            </label>
            <div class="space-y-2">
              <input
                v-model="compressionConfig.convertSize"
                type="range"
                min="100000"
                max="10000000"
                step="100000"
                class="w-full"
              />
              <div class="flex justify-between text-xs text-gray-500">
                <span>100KB</span>
                <span>{{ formatFileSize(compressionConfig.convertSize) }}</span>
                <span>10MB</span>
              </div>
              <p class="text-xs text-gray-600">
                当前设置：当图片超过 {{ formatFileSize(compressionConfig.convertSize) }} 时，自动转换为WebP格式以获得更好的压缩效果
              </p>
            </div>
          </div>
          
          <div class="flex items-center">
            <input
              v-model="compressionConfig.convertToWebP"
              type="checkbox"
              id="convertToWebP"
              class="mr-2"
            />
            <label for="convertToWebP" class="text-sm font-medium text-gray-700">转换为WebP格式</label>
          </div>
          
          <div class="flex items-center">
            <input
              v-model="compressionConfig.retainExif"
              type="checkbox"
              id="retainExif"
              class="mr-2"
            />
            <label for="retainExif" class="text-sm font-medium text-gray-700">保留EXIF信息</label>
          </div>
        </div>
      </div>

      <!-- 调试信息 -->
      <div v-if="debugInfo.length > 0" class="mb-6 p-4 bg-gray-100 rounded-lg">
        <h4 class="font-medium mb-2">调试信息:</h4>
        <div class="text-xs text-gray-600 max-h-32 overflow-y-auto">
          <div v-for="(info, index) in debugInfo" :key="index" class="mb-1">
            {{ info }}
          </div>
        </div>
      </div>

      <!-- 文件上传区域 -->
      <div class="mb-6">
        <div
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          :class="[
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          <div class="text-4xl mb-4">️</div>
          <p class="text-lg font-medium text-gray-700 mb-2">拖拽图片到此处或点击选择</p>
          <p class="text-sm text-gray-500 mb-4">支持 JPG、PNG、WebP、GIF 等格式</p>
          <input
            type="file"
            multiple
            accept="image/*"
            @change="(e) => handleFileSelect((e.target as HTMLInputElement).files)"
            class="hidden"
            id="fileInput"
          />
          <label
            for="fileInput"
            class="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
          >
            选择图片
          </label>
        </div>
      </div>

      <!-- 原始图片列表 -->
      <div v-if="originalImages.length > 0" class="mb-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">待压缩图片 ({{ originalImages.length }})</h3>
          <button
            @click="compressImages"
            :disabled="isCompressing || !Compressor"
            class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="!isCompressing">开始压缩</span>
            <span v-else class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              压缩中...
            </span>
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="(file, index) in originalImages"
            :key="index"
            class="border rounded-lg p-4 relative"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700 truncate">{{ file.name }}</span>
              <button
                @click="removeImage(index)"
                class="text-red-500 hover:text-red-700 text-lg"
              >
                ×
              </button>
            </div>
            <div class="text-xs text-gray-500 mb-2">{{ formatFileSize(file.size) }}</div>
            <div class="text-xs text-gray-500 mb-2">{{ file.type }}</div>
            <!-- 压缩建议 -->
            <div class="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              {{ getCompressionSuggestion(file) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 压缩结果 -->
      <div v-if="compressedImages.length > 0" class="mb-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">压缩结果 ({{ compressedImages.length }})</h3>
          <button
            @click="downloadAll"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            批量下载
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="image in compressedImages"
            :key="image.id"
            class="border rounded-lg p-4"
          >
            <div class="mb-3">
              <img
                :src="image.url"
                :alt="image.originalFile.name"
                class="w-full h-32 object-cover rounded border"
              />
            </div>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">原始大小:</span>
                <span class="font-medium">{{ formatFileSize(image.originalSize) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">压缩后:</span>
                <span class="font-medium">{{ formatFileSize(image.compressedSize) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">压缩率:</span>
                <span class="font-medium text-green-600">{{ image.compressionRatio.toFixed(1) }}%</span>
              </div>
            </div>
            
            <!-- 显示实际使用的压缩参数 -->
            <div v-if="image.actualQuality" class="text-xs text-gray-500 border-t pt-2 mt-2">
              <div>实际质量: {{ Math.round(image.actualQuality * 100) }}%</div>
              <div>图片尺寸: {{ image.actualMaxWidth }}×{{ image.actualMaxHeight }}</div>
            </div>
            
            <button
              @click="downloadImage(image)"
              class="w-full mt-3 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              下载
            </button>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end space-x-3">
        <button
          @click="clearAll"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          清空所有
        </button>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <el-text>
        图片压缩工具使用先进的Compressor.js库，支持多种图片格式的在线压缩。
        可以调节压缩质量、最大尺寸等参数，在保持图片质量的同时有效减小文件大小。
        支持批量处理，适合网站优化、邮件发送等场景。
      </el-text> 
    </ToolDetail>

    <ToolDetail title="功能特点">
      <ul class="list-disc list-inside space-y-2 text-gray-700">
        <li>支持多种格式：JPG、PNG、WebP、GIF等</li>
        <li>可调节压缩质量：0.1-1.0，平衡文件大小和质量</li>
        <li>智能转换：大文件自动转换为WebP格式</li>
        <li>保留EXIF：可选择保留图片的元数据信息</li>
        <li>批量处理：支持多张图片同时压缩</li>
        <li>实时预览：压缩前后对比，显示压缩率</li>
        <li>拖拽上传：支持拖拽文件到页面</li>
        <li>保持原尺寸：图片压缩后保持原始宽度和高度</li>
      </ul>
    </ToolDetail>

    <ToolDetail title="使用说明">
      <ol class="list-decimal list-inside space-y-2 text-gray-700">
        <li>调整压缩参数：设置质量、尺寸等参数</li>
        <li>上传图片：拖拽或点击选择图片文件</li>
        <li>开始压缩：点击"开始压缩"按钮</li>
        <li>查看结果：对比压缩前后的文件大小和压缩率</li>
        <li>下载图片：单张下载或批量下载压缩后的图片</li>
      </ol>
    </ToolDetail>

    <ToolDetail title="为什么有的图片越压缩越大？">
      <div class="space-y-3 text-gray-700">
        <p class="text-sm leading-relaxed">
          图片压缩后文件变大是一个常见现象，主要原因如下：
        </p>
        
        <div class="space-y-2">
          <h4 class="font-medium text-gray-800">1. 压缩质量设置过高</h4>
          <p class="text-sm text-gray-600 pl-4">
            如果压缩质量设置为1.0（100%），实际上没有进行任何压缩，反而可能因为格式转换导致文件变大。
          </p>
          
          <h4 class="font-medium text-gray-800">2. 尺寸限制设置不当</h4>
          <p class="text-sm text-gray-600 pl-4">
            如果设置的最大宽度/高度比原图尺寸还大，图片不会被缩小，反而可能因为重新编码而增大。
          </p>
          
          <h4 class="font-medium text-gray-800">3. 格式转换问题</h4>
          <p class="text-sm text-gray-600 pl-4">
            某些格式转换（如PNG转JPG）可能会增加文件大小，特别是当原图包含大量透明区域或简单图形时。
          </p>
          
          <h4 class="font-medium text-gray-800">4. EXIF信息保留</h4>
          <p class="text-sm text-gray-600 pl-4">
            保留EXIF信息（相机参数、GPS位置等）会增加文件大小，建议关闭此选项以获得更好的压缩效果。
          </p>
          
          <h4 class="font-medium text-gray-800">5. 原图已经高度压缩</h4>
          <p class="text-sm text-gray-600 pl-4">
            如果原图已经是高度压缩的格式（如低质量JPG），再次压缩可能无法获得更好的效果。
          </p>
        </div>
        
        <div class="bg-blue-50 p-3 rounded-lg">
          <h4 class="font-medium text-blue-800 mb-2">💡 压缩建议</h4>
          <ul class="text-sm text-blue-700 space-y-1">
            <li>• 大文件（>5MB）：质量0.5以下，最大尺寸1200×800</li>
            <li>• 中等文件（2-5MB）：质量0.6以下，最大尺寸1200×800</li>
            <li>• 小文件（<2MB）：质量0.7以下，关闭EXIF保留</li>
            <li>• 开启"智能压缩"选项，让工具自动优化参数</li>
            <li>• 对于PNG图片，考虑转换为WebP格式以获得更好的压缩效果</li>
          </ul>
        </div>
        
        <div class="bg-yellow-50 p-3 rounded-lg">
          <h4 class="font-medium text-yellow-800 mb-2">⚠️ 注意事项</h4>
          <ul class="text-sm text-yellow-700 space-y-1">
            <li>• 压缩质量越低，文件越小，但图片质量也越差</li>
            <li>• 尺寸压缩会改变图片分辨率，影响显示效果</li>
            <li>• 某些特殊格式的图片可能不适合压缩</li>
            <li>• 建议先压缩少量图片测试效果，再批量处理</li>
          </ul>
        </div>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 自定义旋转动画 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>

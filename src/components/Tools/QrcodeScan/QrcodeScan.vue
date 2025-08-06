<script setup lang="ts">
import { reactive, ref } from 'vue'
import { QrcodeStream, QrcodeDropZone, QrcodeCapture } from 'qrcode-reader-vue3'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { Camera, Upload, CopyDocument, Delete } from '@element-plus/icons-vue'

const info = reactive({
  title: "二维码识别",
  scanResult: '',
  isScanning: false,
  activeTab: 'upload', // 改为默认显示图片识别
})

// 识别结果
const scanResult = ref('')
const isScanning = ref(false)

// 识别二维码功能
const handleScan = (result: string) => {
  scanResult.value = result
  ElMessage.success('二维码识别成功！')
  isScanning.value = false
}

const handleError = (error: any) => {
  console.error('扫描错误:', error)
  ElMessage.error('扫描失败，请重试')
}

const startScan = () => {
  isScanning.value = true
}

const stopScan = () => {
  isScanning.value = false
}

// 复制结果
const copyResult = async () => {
  if (!scanResult.value) {
    ElMessage.warning('没有可复制的内容')
    return
  }
  
  try {
    await navigator.clipboard.writeText(scanResult.value)
    ElMessage.success('复制成功！')
  } catch (error) {
    ElMessage.error('复制失败，请手动复制')
  }
}

// 清空结果
const clearResult = () => {
  scanResult.value = ''
  ElMessage.success('已清空结果')
}

// 打开链接
const openLink = (url: string) => {
  window.open(url, '_blank')
}
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-6 rounded-2xl bg-white shadow-sm">
      <!-- 识别方式选择 -->
      <el-tabs v-model="info.activeTab" class="mb-6">
        <el-tab-pane label="图片识别" name="upload">
          <div class="text-center">
            <h3 class="text-lg font-medium text-gray-900 mb-4">图片识别</h3>
            
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 max-w-md mx-auto">
              <!-- 使用 QrcodeCapture 处理文件上传 -->
              <QrcodeCapture
                @decode="handleScan"
                @error="handleError"
                class="w-full"
              >
                <!-- 自定义上传界面 -->
                <div class="text-center py-8">
                  <el-icon class="text-4xl text-gray-400 mb-4">
                    <Upload />
                  </el-icon>
                  <div class="text-gray-500">
                    <p>点击选择图片或拖拽图片到此处</p>
                    <p class="text-sm">支持 PNG、JPG、JPEG 等格式</p>
                  </div>
                </div>
              </QrcodeCapture>
              
              <!-- 拖拽区域 -->
              <QrcodeDropZone
                @decode="handleScan"
                @error="handleError"
                class="w-full h-32 mt-4 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center"
              >
                <div class="text-center">
                  <p class="text-gray-500 text-sm">或拖拽图片到此处</p>
                </div>
              </QrcodeDropZone>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="摄像头扫描" name="camera">
          <div class="text-center">
            <h3 class="text-lg font-medium text-gray-900 mb-4">摄像头扫描识别</h3>
            
            <!-- 扫描区域 -->
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4 max-w-md mx-auto">
              <QrcodeStream
                v-if="isScanning"
                @decode="handleScan"
                @error="handleError"
                class="w-full"
              />
              <div v-else class="text-center py-8">
                <el-icon class="text-4xl text-gray-400 mb-4">
                  <Camera />
                </el-icon>
                <p class="text-gray-500">点击开始扫描按钮开始识别二维码</p>
              </div>
            </div>

            <!-- 控制按钮 -->
            <div class="space-x-4">
              <el-button 
                type="primary" 
                @click="startScan"
                :disabled="isScanning"
              >
                开始扫描
              </el-button>
              <el-button 
                @click="stopScan"
                :disabled="!isScanning"
              >
                停止扫描
              </el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- 识别结果 -->
      <div v-if="scanResult" class="border-t pt-6">
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-lg font-medium text-gray-900">识别结果：</h4>
          <div class="space-x-2">
            <el-button 
              size="small" 
              @click="clearResult"
              type="danger"
            >
              <el-icon><Delete /></el-icon>
              清空结果
            </el-button>
            <el-button 
              size="small" 
              type="primary"
              @click="copyResult"
            >
              <el-icon><CopyDocument /></el-icon>
              复制结果
            </el-button>
          </div>
        </div>
        
        <div class="bg-gray-50 rounded-lg p-4">
          <p class="text-sm text-gray-700 break-all whitespace-pre-wrap">{{ scanResult }}</p>
        </div>
        
        <!-- 如果是链接，提供打开链接的按钮 -->
        <div v-if="scanResult.startsWith('http')" class="mt-4">
          <el-button 
            type="success" 
            @click="openLink(scanResult)"
          >
            打开链接
          </el-button>
        </div>
      </div>
    </div>

    <!-- 工具详情 -->
    <ToolDetail title="描述">
      <el-text>
        二维码识别工具，支持多种识别方式：<br><br>
        
        摄像头扫描：实时扫描识别二维码，适用于手机、电脑等设备<br>
        图片识别：支持点击上传或拖拽图片进行识别<br><br>
        
        支持识别各种类型的二维码内容，包括网址、文本、联系方式等。识别结果支持复制和直接打开链接。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 拖拽区域样式 */
.border-dashed:hover {
  border-color: #409eff;
  background-color: #f0f9ff;
}
</style> 
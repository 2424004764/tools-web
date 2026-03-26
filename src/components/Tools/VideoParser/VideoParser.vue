<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'

const videoUrl = ref('')
const parseUrl = ref('')
const loading = ref(false)

const parseApi = 'https://jx.xmflv.com/?url='

const isValidUrl = computed(() => {
  return videoUrl.value.trim().length > 0
})

const handleParse = () => {
  const url = videoUrl.value.trim()
  if (!url) {
    ElMessage.warning('请输入视频地址')
    return
  }
  if (!url.startsWith('http')) {
    ElMessage.warning('请输入有效的视频地址（以http://或https://开头）')
    return
  }
  loading.value = true
  parseUrl.value = parseApi + encodeURIComponent(url)
  setTimeout(() => {
    loading.value = false
  }, 500)
}

const handleClear = () => {
  videoUrl.value = ''
  parseUrl.value = ''
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader title="VIP视频解析"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 输入区域 -->
      <div class="mb-4">
        <el-input
          v-model="videoUrl"
          size="large"
          placeholder="请粘贴视频播放地址，如：https://v.qq.com/x/cover/..."
          clearable
          @keyup.enter="handleParse"
        >
          <template #prepend>视频地址</template>
        </el-input>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3 mb-4">
        <el-button
          type="primary"
          size="large"
          :disabled="!isValidUrl"
          :loading="loading"
          @click="handleParse"
        >
          开始解析
        </el-button>
        <el-button
          size="large"
          @click="handleClear"
        >
          清空
        </el-button>
      </div>

      <!-- 视频播放区域 -->
      <div v-if="parseUrl" class="relative w-full bg-black rounded-xl overflow-hidden" style="aspect-ratio: 16/9;">
        <iframe
          :src="parseUrl"
          class="w-full h-full"
          frameborder="0"
          allowfullscreen
          allow="autoplay; fullscreen"
          scrolling="no"
        ></iframe>
      </div>

      <!-- 默认提示 -->
      <div
        v-else
        class="flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-8"
        style="aspect-ratio: 16/9; min-height: 300px;"
      >
        <svg class="w-20 h-20 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-gray-500 text-lg">粘贴视频地址后点击"开始解析"即可观看</p>
      </div>
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <div class="space-y-3">
        <el-text tag="div" class="block">
          <span class="font-semibold text-gray-700">1. 获取视频地址：</span>
          打开腾讯视频、爱奇艺、优酷等视频平台，找到想观看的视频页面，复制浏览器地址栏中的链接。
        </el-text>
        <el-text tag="div" class="block">
          <span class="font-semibold text-gray-700">2. 解析观看：</span>
          将复制的视频链接粘贴到上方输入框中，点击"开始解析"按钮即可免费观看VIP内容。
        </el-text>
        <el-text tag="div" class="block">
          <span class="font-semibold text-gray-700">3. 支持平台：</span>
          腾讯视频、爱奇艺、优酷、芒果TV、PPTV、搜狐视频等主流视频平台。
        </el-text>
        <el-text tag="div" class="block text-orange-500">
          <span class="font-semibold">温馨提示：</span>
          本工具仅供学习交流使用，解析服务由第三方提供，请勿用于商业用途。
        </el-text>
      </div>
    </ToolDetail>

    <!-- 常见问题 -->
    <ToolDetail title="常见问题">
      <div class="space-y-3">
        <el-text tag="div" class="block">
          <span class="font-semibold text-gray-700">Q: 解析失败怎么办？</span>
          <br>A: 部分视频可能因为版权或解析接口更新导致无法解析，请尝试其他视频或稍后再试。
        </el-text>
        <el-text tag="div" class="block">
          <span class="font-semibold text-gray-700">Q: 有广告怎么办？</span>
          <br>A: 解析接口为第三方免费服务，可能会有广告，请耐心等待或关闭广告弹窗。
        </el-text>
        <el-text tag="div" class="block">
          <span class="font-semibold text-gray-700">Q: 手机上能用吗？</span>
          <br>A: 可以的，本工具完美支持PC端和移动端使用。
        </el-text>
      </div>
    </ToolDetail>
  </div>
</template>

<style scoped>
:deep(.el-input-group__prepend) {
  background-color: #f5f7fa;
  font-weight: 500;
}
</style>

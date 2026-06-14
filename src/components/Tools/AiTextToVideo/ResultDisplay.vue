<template>
  <div>
    <!-- 阶段进度 -->
    <div v-if="currentStage > 0" class="mb-4 p-4 bg-gray-50 rounded-lg">
      <!-- 优化阶段 -->
      <div v-if="showOptimizeStage" class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
            currentStage >= 1 ? (currentStage > 1 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white') : 'bg-gray-300 text-gray-500']">
            {{ currentStage > 1 ? '✓' : '1' }}
          </div>
          <span class="text-sm font-medium">{{ optimizeStageLabel }}</span>
        </div>
        <div v-if="scriptGenerateTime > 0 && activeTab === 'text-to-video'" class="text-xs text-gray-600">
          {{ formatTime(scriptGenerateTime) }}
        </div>
      </div>

      <!-- 生成阶段 -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
            currentStage >= 2 ? (currentStage > 2 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white') : 'bg-gray-300 text-gray-500']">
            {{ currentStage > 2 ? '✓' : (showOptimizeStage ? '2' : '1') }}
          </div>
          <span class="text-sm font-medium">{{ generateStageLabel }}</span>
        </div>
        <div v-if="generateTime > 0" class="text-xs text-gray-600">
          {{ formatTime(generateTime) }}
        </div>
      </div>
    </div>

    <!-- 进度提示 -->
    <div v-if="currentStep" class="mb-4 p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
      {{ currentStep }}
    </div>

    <!-- 生成的文案 -->
    <div v-if="generatedScript && activeTab === 'text-to-video' && showScript" class="mb-6 p-4 bg-gray-50 rounded-lg">
      <h3 class="text-sm font-semibold mb-2">生成的文案</h3>
      <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ generatedScript }}</p>
    </div>

    <!-- 生成的图片 -->
    <div v-if="generatedImages.length > 0" class="mb-6">
      <h3 class="text-sm font-semibold mb-2">生成的图片 ({{ generatedImages.length }}张)</h3>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="(img, index) in generatedImages" :key="index" class="relative group">
          <img
            :src="img"
            class="w-full rounded-lg shadow cursor-pointer hover:opacity-90 transition-opacity"
            @click="$emit('show-image-modal', img, index)"
          />
          <button
            @click="$emit('download-image', img, index)"
            class="absolute bottom-2 right-2 px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            下载
          </button>
        </div>
      </div>
    </div>

    <!-- 生成的视频 -->
    <div v-if="generatedVideoUrl">
      <h3 class="text-sm font-semibold mb-2">生成的视频</h3>
      <div class="flex items-start gap-3">
        <div class="relative">
          <video
            ref="videoRef"
            :src="generatedVideoUrl"
            class="w-[200px] rounded-lg shadow cursor-pointer hover:opacity-80 transition-opacity"
            muted
            loop
            @click="$emit('show-video-modal')"
            @loadedmetadata="$emit('video-loaded')"
            @timeupdate="$emit('video-timeupdate')"
            @mouseenter="$emit('video-mouseenter')"
            @mouseleave="$emit('video-mouseleave')"
          />
          <!-- 时长标签 -->
          <div v-if="videoDuration > 0" class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            {{ videoDuration }}秒
          </div>
          <!-- 播放进度条 -->
          <div v-if="isVideoPlaying" class="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 bg-opacity-50">
            <div
              class="h-full bg-blue-500 transition-all duration-100"
              :style="{ width: videoProgress + '%' }"
            ></div>
          </div>
        </div>
        <div class="flex-1">
          <button
            @click="$emit('download-video')"
            class="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm mb-2"
          >
            下载视频
          </button>
          <button
            @click="$emit('show-video-modal')"
            class="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            全屏预览
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  activeTab: string
  currentStage: number
  currentStep: string
  generatedScript: string
  generatedImages: string[]
  generatedVideoUrl: string
  scriptGenerateTime: number
  generateTime: number
  videoDuration: number
  videoProgress: number
  isVideoPlaying: boolean
  autoOptimize: boolean
  autoOptimizeImage: boolean
}

const props = defineProps<Props>()

const showOptimizeStage = computed(() => {
  return (props.autoOptimize && props.activeTab === 'text-to-video') ||
         (props.autoOptimizeImage && props.activeTab === 'image-to-video')
})

const showScript = computed(() => {
  return props.autoOptimize
})

const optimizeStageLabel = computed(() => {
  return props.activeTab === 'text-to-video' ? '生成文案' : '优化描述'
})

const generateStageLabel = computed(() => {
  if (props.activeTab === 'text-to-video' || props.activeTab === 'image-to-video') {
    return '生成视频'
  }
  return '生成图片'
})

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
}

defineEmits<{
  'download-image': [url: string, index: number]
  'show-image-modal': [url: string, index: number]
  'download-video': []
  'show-video-modal': []
  'video-loaded': []
  'video-timeupdate': []
  'video-mouseenter': []
  'video-mouseleave': []
}>()
</script>

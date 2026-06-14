<template>
  <div class="flex flex-col lg:flex-row gap-6">
    <!-- 左侧：表单 -->
    <div class="lg:w-1/2">
      <ImageToVideoForm
        v-model:imageMode="localImageMode"
        v-model:videoPrompt="localVideoPrompt"
        v-model:duration="localDuration"
        v-model:aspectRatio="localAspectRatio"
        v-model:autoOptimize="localAutoOptimize"
        :uploadedImages="uploadedImages"
        :disabled="isGenerating"
        :isUploading="isUploading"
        @upload="$emit('upload', $event)"
        @remove-image="$emit('remove-image', $event)"
        @add-preset="$emit('add-preset', $event)"
        @random-prompt="$emit('random-prompt')"
        @generate="$emit('generate')"
      />
    </div>

    <!-- 右侧：结果 -->
    <div class="lg:w-1/2">
      <ResultDisplay
        activeTab="image-to-video"
        :currentStage="currentStage"
        :currentStep="currentStep"
        :generatedScript="''"
        :generatedImages="[]"
        :generatedVideoUrl="generatedVideoUrl"
        :scriptGenerateTime="0"
        :generateTime="videoGenerateTime"
        :videoDuration="videoDuration"
        :videoProgress="videoProgress"
        :isVideoPlaying="isVideoPlaying"
        :autoOptimize="false"
        :autoOptimizeImage="localAutoOptimize"
        @download-video="$emit('download-video')"
        @show-video-modal="$emit('show-video-modal')"
        @video-loaded="$emit('video-loaded')"
        @video-timeupdate="$emit('video-timeupdate')"
        @video-mouseenter="$emit('video-mouseenter')"
        @video-mouseleave="$emit('video-mouseleave')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import ImageToVideoForm from './ImageToVideoForm.vue'
import ResultDisplay from './ResultDisplay.vue'

interface Props {
  imageMode: 'single' | 'double'
  uploadedImages: string[]
  videoPrompt: string
  duration: number
  aspectRatio: string
  autoOptimize: boolean
  isGenerating: boolean
  isUploading: boolean
  currentStage: number
  currentStep: string
  generatedVideoUrl: string
  videoGenerateTime: number
  videoDuration: number
  videoProgress: number
  isVideoPlaying: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:imageMode': [value: 'single' | 'double']
  'update:videoPrompt': [value: string]
  'update:duration': [value: number]
  'update:aspectRatio': [value: string]
  'update:autoOptimize': [value: boolean]
  'upload': [event: Event]
  'remove-image': [index: number]
  'add-preset': [url: string]
  'random-prompt': []
  'generate': []
  'download-video': []
  'show-video-modal': []
  'video-loaded': []
  'video-timeupdate': []
  'video-mouseenter': []
  'video-mouseleave': []
}>()

const localImageMode = ref(props.imageMode)
const localVideoPrompt = ref(props.videoPrompt)
const localDuration = ref(props.duration)
const localAspectRatio = ref(props.aspectRatio)
const localAutoOptimize = ref(props.autoOptimize)

watch(() => props.imageMode, (val) => localImageMode.value = val)
watch(() => props.videoPrompt, (val) => localVideoPrompt.value = val)
watch(() => props.duration, (val) => localDuration.value = val)
watch(() => props.aspectRatio, (val) => localAspectRatio.value = val)
watch(() => props.autoOptimize, (val) => localAutoOptimize.value = val)

watch(localImageMode, (val) => emit('update:imageMode', val))
watch(localVideoPrompt, (val) => emit('update:videoPrompt', val))
watch(localDuration, (val) => emit('update:duration', val))
watch(localAspectRatio, (val) => emit('update:aspectRatio', val))
watch(localAutoOptimize, (val) => emit('update:autoOptimize', val))

// 组件挂载时，如果提示词为空则自动随机一个
onMounted(() => {
  if (!props.videoPrompt || props.videoPrompt.trim() === '') {
    emit('random-prompt')
  }
})
</script>

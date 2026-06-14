<template>
  <div class="flex flex-col lg:flex-row gap-6">
    <!-- 左侧：表单 -->
    <div class="lg:w-1/2">
      <TextToVideoForm
        v-model="localTopic"
        v-model:duration="localDuration"
        v-model:aspectRatio="localAspectRatio"
        v-model:autoOptimize="localAutoOptimize"
        :disabled="isGenerating"
        @random="$emit('random-topic')"
        @generate="handleGenerate"
      />
    </div>

    <!-- 右侧：结果 -->
    <div class="lg:w-1/2">
      <ResultDisplay
        activeTab="text-to-video"
        :currentStage="currentStage"
        :currentStep="currentStep"
        :generatedScript="generatedScript"
        :generatedImages="[]"
        :generatedVideoUrl="generatedVideoUrl"
        :scriptGenerateTime="scriptGenerateTime"
        :generateTime="videoGenerateTime"
        :videoDuration="videoDuration"
        :videoProgress="videoProgress"
        :isVideoPlaying="isVideoPlaying"
        :autoOptimize="localAutoOptimize"
        :autoOptimizeImage="false"
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
import TextToVideoForm from './TextToVideoForm.vue'
import ResultDisplay from './ResultDisplay.vue'

interface Props {
  topic: string
  duration: number
  aspectRatio: string
  autoOptimize: boolean
  isGenerating: boolean
  currentStage: number
  currentStep: string
  generatedScript: string
  generatedVideoUrl: string
  scriptGenerateTime: number
  videoGenerateTime: number
  videoDuration: number
  videoProgress: number
  isVideoPlaying: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:topic': [value: string]
  'update:duration': [value: number]
  'update:aspectRatio': [value: string]
  'update:autoOptimize': [value: boolean]
  'random-topic': []
  'generate': []
  'download-video': []
  'show-video-modal': []
  'video-loaded': []
  'video-timeupdate': []
  'video-mouseenter': []
  'video-mouseleave': []
}>()

const localTopic = ref(props.topic)
const localDuration = ref(props.duration)
const localAspectRatio = ref(props.aspectRatio)
const localAutoOptimize = ref(props.autoOptimize)

watch(() => props.topic, (val) => localTopic.value = val)
watch(() => props.duration, (val) => localDuration.value = val)
watch(() => props.aspectRatio, (val) => localAspectRatio.value = val)
watch(() => props.autoOptimize, (val) => localAutoOptimize.value = val)

watch(localTopic, (val) => emit('update:topic', val))
watch(localDuration, (val) => emit('update:duration', val))
watch(localAspectRatio, (val) => emit('update:aspectRatio', val))
watch(localAutoOptimize, (val) => emit('update:autoOptimize', val))

const handleGenerate = () => {
  emit('generate')
}

// 组件挂载时，如果主题为空则自动随机一个
onMounted(() => {
  if (!props.topic || props.topic.trim() === '') {
    emit('random-topic')
  }
})
</script>

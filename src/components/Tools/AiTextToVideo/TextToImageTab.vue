<template>
  <div class="flex flex-col lg:flex-row gap-6">
    <!-- 左侧：表单 -->
    <div class="lg:w-1/2">
      <TextToImageForm
        v-model:model="localModel"
        v-model:prompt="localPrompt"
        v-model:aspectRatio="localAspectRatio"
        v-model:count="localCount"
        :disabled="isGenerating"
        @random="$emit('random')"
        @generate="$emit('generate')"
      />
    </div>

    <!-- 右侧：结果 -->
    <div class="lg:w-1/2">
      <ResultDisplay
        activeTab="text-to-image"
        :currentStage="0"
        :currentStep="currentStep"
        :generatedScript="''"
        :generatedImages="generatedImages"
        :generatedVideoUrl="''"
        :scriptGenerateTime="0"
        :generateTime="generateTime"
        :videoDuration="0"
        :videoProgress="0"
        :isVideoPlaying="false"
        :autoOptimize="false"
        :autoOptimizeImage="false"
        @download-image="(url, index) => $emit('download-image', url, index)"
        @show-image-modal="(url, index) => $emit('show-image-modal', url, index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import TextToImageForm from './TextToImageForm.vue'
import ResultDisplay from './ResultDisplay.vue'

interface Props {
  model: string
  prompt: string
  aspectRatio: string
  count: number
  isGenerating: boolean
  currentStep: string
  generatedImages: string[]
  generateTime: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:model': [value: string]
  'update:prompt': [value: string]
  'update:aspectRatio': [value: string]
  'update:count': [value: number]
  'random': []
  'generate': []
  'download-image': [url: string, index: number]
  'show-image-modal': [url: string, index: number]
}>()

const localModel = ref(props.model)
const localPrompt = ref(props.prompt)
const localAspectRatio = ref(props.aspectRatio)
const localCount = ref(props.count)

watch(() => props.model, (val) => localModel.value = val)
watch(() => props.prompt, (val) => localPrompt.value = val)
watch(() => props.aspectRatio, (val) => localAspectRatio.value = val)
watch(() => props.count, (val) => localCount.value = val)

watch(localModel, (val) => emit('update:model', val))
watch(localPrompt, (val) => emit('update:prompt', val))
watch(localAspectRatio, (val) => emit('update:aspectRatio', val))
watch(localCount, (val) => emit('update:count', val))

// 组件挂载时，如果提示词为空则自动随机一个
onMounted(() => {
  if (!props.prompt || props.prompt.trim() === '') {
    emit('random')
  }
})
</script>

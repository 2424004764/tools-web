<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import GenerationHistoryView from './GenerationHistoryView.vue'

// 父级（AiImageEdit.vue）会接管缩略图点击 → 在父组件根级渲染 el-image-viewer，
// 彻底避开 dialog 栈上下文对预览图层的覆盖问题
const props = defineProps<{
  onPreview?: (url: string) => void
}>()

const visible = ref(false)
const viewRef = ref<InstanceType<typeof GenerationHistoryView> | null>(null)

// 桌面端弹窗自适应（手机端改走独立页面 /ai-image-edit/history）
const isDesktop = ref(true)
const DESKTOP_MIN_WIDTH = 640
const updateIsDesktop = () => {
  isDesktop.value = typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN_WIDTH
}

const open = () => {
  visible.value = true
  // 打开时主动重拉一次（可能用户切回 tab 后状态有变）
  viewRef.value?.load?.()
}

defineExpose({ open })

onMounted(() => {
  updateIsDesktop()
  window.addEventListener('resize', updateIsDesktop)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateIsDesktop)
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="我的生成历史"
    :width="isDesktop ? '880px' : '92vw'"
    :close-on-click-modal="true"
    append-to-body
  >
    <GenerationHistoryView ref="viewRef" :on-preview="props.onPreview" />
  </el-dialog>
</template>
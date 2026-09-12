<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import Download from '~icons/ep/download'

const props = defineProps<{ modelValue: boolean; imageUrl: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; closed: [] }>()
const previewRef = ref<HTMLElement>()
const resetScroll = () => {
  const reset = () => previewRef.value?.scrollTo({ top: 0, left: 0 })
  reset(); requestAnimationFrame(() => { reset(); requestAnimationFrame(reset) }); window.setTimeout(reset, 120)
}
const download = () => {
  if (!props.imageUrl) return
  const a = document.createElement('a'); a.href = props.imageUrl; a.download = '每月固定开销.png'; document.body.appendChild(a); a.click(); a.remove(); ElMessage.success('图片已下载')
}
watch(() => props.modelValue, value => { if (value) nextTick(resetScroll) })
defineExpose({ resetScroll })
</script>
<template>
  <el-dialog :model-value="modelValue" title="分析汇总预览" width="92%" align-center class="fe-share-preview-dialog" destroy-on-close @update:model-value="emit('update:modelValue', $event)" @closed="emit('closed')" @opened="resetScroll">
    <div ref="previewRef" class="fe-share-preview"><img v-if="imageUrl" :src="imageUrl" alt="固定开销分析汇总" class="fe-share-preview-image" /></div>
    <template #footer><el-button type="primary" @click="download"><el-icon><Download /></el-icon> 下载图片</el-button></template>
  </el-dialog>
</template>
<style scoped>
:deep(.fe-share-preview-dialog){max-width:calc(100vw - 24px)!important;margin:12px auto}:deep(.fe-share-preview-dialog .fe-share-preview){width:100%;max-height:72vh;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:12px;background:#f8fafc;box-sizing:border-box}:deep(.fe-share-preview-dialog .fe-share-preview-image){display:block;width:min(750px,100%);max-width:100%;height:auto;object-fit:contain}
</style>

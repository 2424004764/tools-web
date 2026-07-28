<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CreditTransactionsView from './CreditTransactionsView.vue'

/**
 * 公共：用户积分流水弹窗（薄壳包装）
 *
 * 用法：
 *   <CreditTransactionsDialog v-model="visible" />
 *   <CreditTransactionsDialog v-model="visible" tool-url="/ai-image-edit/" title="AI 图片编辑消耗明细" />
 *
 * Props:
 *   modelValue: 是否显示（v-model）
 *   title?: 弹窗标题，默认 "积分消耗明细"
 *   toolUrl?: 可选。若指定，则只展示该工具的流水
 *   pageSize?: 每页条数，默认 15
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    toolUrl?: string
    pageSize?: number
  }>(),
  {
    title: '积分消耗明细',
    toolUrl: '',
    pageSize: 15,
  },
)

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// 仅用于桌面端的弹窗高度自适应（手机端改走独立页面 /me/credits）
const isDesktop = ref(true)
const DESKTOP_MIN_WIDTH = 640
const updateIsDesktop = () => {
  isDesktop.value = typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN_WIDTH
}
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
    :title="title"
    :width="isDesktop ? '880px' : '92vw'"
    :close-on-click-modal="true"
    align-center
    destroy-on-close
  >
    <CreditTransactionsView :tool-url="toolUrl" :page-size="pageSize" />
  </el-dialog>
</template>
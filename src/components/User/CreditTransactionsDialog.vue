<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CreditTransactionsView from './CreditTransactionsView.vue'
import StorageQuotaCard from './StorageQuotaCard.vue'
import TopRight from '~icons/ep/topRight'

/**
 * 公共：用户积分流水弹窗（薄壳包装）
 *
 * 用法：
 *   <CreditTransactionsDialog v-model="visible" />
 *   <CreditTransactionsDialog v-model="visible" tool-url="/ai-image-edit/" title="AI 图片编辑消耗明细" />
 *
 * Props:
 *   modelValue: 是否显示（v-model）
 *   title?: 弹窗标题，默认 "积分与存储空间"
 *   toolUrl?: 可选。若指定，则只展示该工具的流水
 *   pageSize?: 每页条数，默认 15
 *
 * 通用模式（无 toolUrl）下标题旁提供「独立页面」按钮，可跳转 /me/credits 独立页
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    toolUrl?: string
    pageSize?: number
  }>(),
  {
    title: '积分与存储空间',
    toolUrl: '',
    pageSize: 15,
  },
)

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
}>()

const router = useRouter()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// 跳转独立页：先关弹窗再导航，避免返回时弹窗又出现
const goStandalonePage = () => {
  visible.value = false
  router.push('/me/credits')
}

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
    :width="isDesktop ? '880px' : '92vw'"
    :close-on-click-modal="true"
    align-center
    destroy-on-close
  >
    <template #header>
      <div class="flex items-center gap-3 pr-6 min-w-0">
        <span class="text-[18px] font-semibold text-ink-900 leading-6">{{ title }}</span>
        <button
          v-if="!toolUrl"
          type="button"
          class="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border-subtle text-caption text-ink-500 hover:text-accent-600 hover:border-accent-400 hover:bg-accent-50 transition-colors shrink-0"
          title="在独立页面打开（可收藏/分享链接）"
          @click="goStandalonePage"
        >
          <el-icon :size="13"><TopRight /></el-icon>
          独立页面
        </button>
      </div>
    </template>
    <div v-if="!toolUrl" class="mb-3">
      <StorageQuotaCard />
    </div>
    <CreditTransactionsView :tool-url="toolUrl" :page-size="pageSize" />
  </el-dialog>
</template>

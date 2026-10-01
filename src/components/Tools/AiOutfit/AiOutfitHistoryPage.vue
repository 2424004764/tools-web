<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import GenerationHistoryView from '@/components/Tools/AiImageEdit/GenerationHistoryView.vue'
import ArrowLeft from '~icons/ep/arrowLeft'

const router = useRouter()
const userStore = useUserStore()

onMounted(() => {
  if (!userStore.isLoggedIn) {
    router.replace(
      `/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`,
    )
  }
})

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/ai-outfit')
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <div class="flex items-center gap-3 rounded-2xl bg-white border border-border-subtle p-4 mb-3">
      <button
        type="button"
        @click="goBack"
        class="flex items-center gap-2 text-ink-700 hover:text-accent-600 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-accent-50"
        aria-label="返回"
      >
        <el-icon :size="20"><ArrowLeft /></el-icon>
        <span class="text-body-sm font-medium">返回</span>
      </button>
      <h1 class="text-h3 font-semibold text-ink-900 flex-1 min-w-0 truncate">
        我的穿搭生成历史
      </h1>
    </div>

    <div class="p-4 rounded-2xl bg-white">
      <GenerationHistoryView />
    </div>
  </div>
</template>

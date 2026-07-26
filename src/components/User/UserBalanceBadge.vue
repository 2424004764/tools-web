<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useUserStore } from '@/store/modules/user'
import CreditTransactionsDialog from './CreditTransactionsDialog.vue'

const userStore = useUserStore()

// 本地 ref 副本 + $subscribe：Pinia 每次 mutation 都同步，不依赖 Vue 响应式追踪
const balanceDisplay = ref(userStore.credits.balance)
const creditsLoadedDisplay = ref(userStore.creditsLoaded)
const refreshKey = ref(0)

userStore.$subscribe(() => {
  const newBalance = userStore.credits.balance
  if (balanceDisplay.value !== newBalance) {
    balanceDisplay.value = newBalance
    refreshKey.value++
  }
  creditsLoadedDisplay.value = userStore.creditsLoaded
})

// 余额低时强调颜色
const tone = computed(() => {
  const b = balanceDisplay.value
  if (b === 0) return 'danger'
  if (b < 5) return 'warn'
  return 'normal'
})

const formattedBalance = computed(() => balanceDisplay.value.toLocaleString('zh-CN'))

onMounted(() => {
  if (userStore.isLoggedIn) {
    userStore.fetchCredits()
  }
})

// 登录态变化时重新拉
watch(() => userStore.isLoggedIn, (v) => {
  if (v) userStore.fetchCredits()
})

// 弹窗控制
const dialogVisible = ref(false)
const openDialog = () => {
  dialogVisible.value = true
}
</script>

<template>
  <template v-if="userStore.isLoggedIn">
    <button
      type="button"
      @click="openDialog"
      class="flex items-center gap-1.5 px-3 py-2 rounded-lg select-none transition-all duration-200 hover:scale-105"
      :class="{
        'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 hover:ring-emerald-300': tone === 'normal',
        'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 hover:ring-amber-300': tone === 'warn',
        'bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 hover:ring-rose-300': tone === 'danger',
      }"
      :title="`总获得 ${userStore.credits.total_earned} · 总消费 ${userStore.credits.total_spent}（点击查看明细）`"
    >
      <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd" />
      </svg>
      <!-- v-text + :key 双保险：v-text 直接操作 textContent -->
      <span
        :key="refreshKey"
        v-text="`${formattedBalance} `"
        class="text-body-sm font-semibold tabular-nums"
      ></span>
      <span v-if="!creditsLoadedDisplay" class="text-caption opacity-60">…</span>
    </button>
    <CreditTransactionsDialog v-model="dialogVisible" />
  </template>
</template>
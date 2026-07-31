<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import CreditTransactionsDialog from './CreditTransactionsDialog.vue'

const router = useRouter()
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

// 响应式：< 640px 视为手机端 → "积分消耗明细"直接跳独立页面
const MOBILE_BREAKPOINT = 640
const isMobile = ref(false)
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

onMounted(() => {
  if (userStore.isLoggedIn) {
    userStore.fetchCredits()
  }
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
  document.removeEventListener('click', handleClickOutside)
})

// 登录态变化时重新拉
watch(() => userStore.isLoggedIn, (v) => {
  if (v) userStore.fetchCredits()
})

// ============ 下拉菜单 ============
const menuVisible = ref(false)
const menuRef = ref<HTMLElement | null>(null)

const toggleMenu = () => {
  menuVisible.value = !menuVisible.value
}
const closeMenu = () => {
  menuVisible.value = false
}
const handleClickOutside = (event: Event) => {
  if (!menuRef.value) return
  if (!menuRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

// 菜单项：充值
const goRecharge = () => {
  closeMenu()
  router.push('/me/recharge')
}

// 菜单项：积分消耗明细（保留原桌面/移动分流逻辑）
const dialogVisible = ref(false)
const openTransactionsDialog = () => {
  closeMenu()
  dialogVisible.value = true
}
const goTransactionsPage = () => {
  closeMenu()
  router.push('/me/credits')
}
const openTransactions = () => {
  if (isMobile.value) goTransactionsPage()
  else openTransactionsDialog()
}
</script>

<template>
  <template v-if="userStore.isLoggedIn">
    <div ref="menuRef" class="relative inline-block">
      <button
        type="button"
        @click="toggleMenu"
        class="flex items-center gap-1.5 px-3 py-2 rounded-lg select-none transition-all duration-200 hover:scale-105"
        :class="{
          'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 hover:ring-emerald-300': tone === 'normal',
          'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 hover:ring-amber-300': tone === 'warn',
          'bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 hover:ring-rose-300': tone === 'danger',
        }"
        :title="`总获得 ${userStore.credits.total_earned} · 总消费 ${userStore.credits.total_spent}（点击打开积分菜单）`"
        :aria-haspopup="'menu'"
        :aria-expanded="menuVisible"
        aria-label="积分菜单"
      >
        <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd" />
        </svg>
        <span
          :key="refreshKey"
          v-text="`${formattedBalance} `"
          class="text-body-sm font-semibold tabular-nums"
        ></span>
        <span v-if="!creditsLoadedDisplay" class="text-caption opacity-60">…</span>
        <svg
          class="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
          :class="{ 'rotate-180': menuVisible }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
      </button>

      <!-- 下拉菜单 -->
      <div
        v-show="menuVisible"
        role="menu"
        aria-label="积分菜单"
        class="absolute top-full right-0 mt-1 bg-surface-1 border border-border-default rounded-lg shadow-lg py-2 min-w-[160px] z-50"
      >
        <div
          role="menuitem"
          tabindex="0"
          class="px-4 py-2 hover:bg-accent-50 cursor-pointer text-ink-700 hover:text-accent-700 flex items-center gap-2"
          @click="goRecharge"
          @keyup.enter="goRecharge"
          @keyup.space.prevent="goRecharge"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          充值
        </div>
        <div
          role="menuitem"
          tabindex="0"
          class="px-4 py-2 hover:bg-accent-50 cursor-pointer text-ink-700 hover:text-accent-700 flex items-center gap-2"
          @click="openTransactions"
          @keyup.enter="openTransactions"
          @keyup.space.prevent="openTransactions"
        >
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          积分消耗明细
        </div>
      </div>

      <CreditTransactionsDialog v-model="dialogVisible" />
    </div>
  </template>
</template>
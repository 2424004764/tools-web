<template>
  <transition name="pwa-toast">
    <div
      v-if="show"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-gray-800 px-5 py-3 text-white shadow-2xl"
    >
      <span class="text-sm">应用已更新，点击刷新加载最新版本</span>
      <button
        class="rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        @click="reload"
      >
        刷新
      </button>
      <button
        class="text-gray-400 hover:text-white transition-colors"
        @click="show = false"
      >
        ✕
      </button>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const show = ref(false)

function reload() {
  window.location.reload()
}

onMounted(() => {
  if ('serviceWorker' in navigator) {
    let refreshing = false
    // 监听 SW 控制权变更（新 SW 激活后触发）
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      show.value = true
    })
  }
})
</script>

<style scoped>
.pwa-toast-enter-active,
.pwa-toast-leave-active {
  transition: all 0.3s ease;
}
.pwa-toast-enter-from,
.pwa-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>

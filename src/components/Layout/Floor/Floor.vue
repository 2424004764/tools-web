<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
const appDesc = ref(import.meta.env.VITE_APP_DESC || '')
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')

// ===== 构建时间（由 vite build 注入） =====
// dev 模式 __BUILD_TIME__ / __BUILD_TIME_LOCAL__ 为空串
const buildTimeLocal = __BUILD_TIME_LOCAL__
const buildTimeISO = __BUILD_TIME__
const hasBuildTime = computed(() => !!buildTimeLocal)

// 距上次构建多久（每分钟自动刷新一次）
const now = ref(Date.now())
let tickId: number | null = null
onMounted(() => {
  tickId = window.setInterval(() => { now.value = Date.now() }, 60_000)
})
onUnmounted(() => {
  if (tickId !== null) window.clearInterval(tickId)
})

const elapsedText = computed(() => {
  if (!buildTimeISO) return '开发模式'
  const ms = now.value - new Date(buildTimeISO).getTime()
  if (ms < 0) return '刚刚'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec} 秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month} 个月前`
  return `${Math.floor(month / 12)} 年前`
})
</script>

<template>
    <div class="w-full rounded-2xl z-10 p-5 text-center">
        <div class="copyright text-body-sm text-gray-600 leading-relaxed">
            <div class="mb-2">
                {{ appDesc }} © 2019 - 2025 BY Bucaicai
            </div>
            <div class="flex flex-col sm:flex-row justify-center items-center gap-2 text-caption">
                <a href="https://beian.miit.gov.cn/" target="_blank" class="text-ink-700 hover:text-accent-600 transition-colors">
                    湘ICP备16007032号-1
                </a>
                <span class="hidden sm:inline">|</span>
                <a href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=43030202001052&token=2be051c1-22dd-44ec-9f4b-d41155f2d855"
                   target="_blank" class="text-ink-700 hover:text-accent-600 transition-colors">
                    湘公安网备43030202001052号
                </a>
                <span class="hidden sm:inline">|</span>
                <a :href="gitUrl" target="_blank" class="text-ink-700 hover:text-accent-600 transition-colors">Tools-Web</a>
                <span class="hidden sm:inline">|</span>
                <a :href="gitUrl + '/issues/new'" target="_blank" class="text-ink-700 hover:text-accent-600 transition-colors">反馈建议</a>
            </div>
            <!-- 构建时间（pnpm build:pro 时由 vite.config.ts 注入） -->
            <div class="mt-2 text-caption text-ink-500">
                <el-tooltip v-if="hasBuildTime" :content="`UTC: ${buildTimeISO}`" placement="top">
                    <span class="cursor-help">
                        上次更新：<span class="font-mono">{{ buildTimeLocal }}</span>
                        <span class="text-ink-400">（{{ elapsedText }}）</span>
                    </span>
                </el-tooltip>
                <span v-else class="font-mono text-ink-400">开发模式（未构建）</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
</style>
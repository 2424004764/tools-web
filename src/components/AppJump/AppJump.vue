<script setup lang="ts">
/**
 * 产品跳转中间页：/app-jump/:key
 *
 * 职责：
 *   1. 按 key 在产品白名单（products.ts）中校验，拒绝任意 URL —— 防开放重定向
 *   2. 上报一条使用记录（复用 POST /api/me/tool-usage，落 tool_usage_records 表，
 *      后台「工具使用记录」即可看到时间/用户/IP/来源），与平台工具记录完全同款
 *   3. 品牌化过渡 UI + 倒计时自动出站跳转（location.replace，返回键回到主站）
 *
 * 记录口径：与 recordToolUsage 一致，30 秒 sessionStorage 去重，避免刷新重复计数。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { PRODUCTS } from '@/components/Layout/Header/products'
import { postToolUsage } from '@/api/me/tool-usage'
import { detectSource } from '@/utils/source'

const APP_TITLE = (import.meta.env.VITE_APP_TITLE as string) || '一方工具箱'
const route = useRoute()

const key = computed(() => String(route.params.key || '').trim().toLowerCase())
const product = computed(() => PRODUCTS.find((p) => p.key === key.value) || null)
const invalid = computed(() => !product.value)

const countdown = ref(2)
let timer: number | null = null
let jumped = false

/** 出站跳转：replace 掉中间页，浏览器返回键直接回主站 */
function go() {
  if (jumped || !product.value) return
  jumped = true
  stopTimer()
  window.location.replace(product.value.url)
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

/** 上报一次产品跳转；30 秒内同产品去重（与 utils/tool-usage.ts 口径一致） */
function recordAppJump() {
  if (!product.value) return
  try {
    const dedupeKey = 'appjump_' + product.value.key
    const last = Number(sessionStorage.getItem(dedupeKey) || '0')
    const now = Date.now()
    if (last && now - last < 30_000) return
    sessionStorage.setItem(dedupeKey, String(now))
  } catch {
    // 隐私模式 sessionStorage 可能抛错；不阻断跳转
  }
  // fire-and-forget：失败仅告警，绝不影响跳转（与工具埋点兜底策略一致）
  void postToolUsage(`/app-jump/${product.value.key}/`, product.value.name, detectSource()).catch(
    (err) => console.warn('[app-jump] record failed:', err?.message || err),
  )
}

onMounted(() => {
  // 工具页：不参与 SEO 收录与预渲染
  document.title = product.value
    ? `正在前往「${product.value.name}」 | ${APP_TITLE}`
    : `页面不存在 | ${APP_TITLE}`
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (!robots) {
    robots = document.createElement('meta')
    robots.name = 'robots'
    document.head.appendChild(robots)
  }
  robots.content = 'noindex, nofollow'

  if (invalid.value) return

  recordAppJump()
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) go()
  }, 1000)
})

onUnmounted(stopTimer)
</script>

<template>
  <!-- 无效 key：白名单外的路径一律回首页，不透露产品配置 -->
  <div v-if="invalid" class="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
    <div class="w-14 h-14 rounded-2xl bg-surface-2 dark:bg-surface-3 flex items-center justify-center text-2xl" aria-hidden="true">🧭</div>
    <h1 class="text-h3 font-bold text-ink-800 m-0">页面不存在或已下线</h1>
    <p class="text-body-sm text-ink-500 m-0">你要找的产品不在列表里，回工具箱看看其他工具吧</p>
    <router-link
      to="/"
      class="mt-2 px-5 py-2 rounded-full bg-brand-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity"
    >
      返回工具箱
    </router-link>
  </div>

  <!-- 过渡卡片 -->
  <div v-else-if="product" class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="w-full max-w-sm bg-surface-0 dark:bg-surface-0 border border-border-subtle rounded-[20px] shadow-sm shadow-ink-950/5 px-8 py-10 text-center">
      <img
        :src="product.logo"
        :alt="product.name + '图标'"
        class="w-16 h-16 rounded-2xl mx-auto shadow-sm shadow-ink-950/10"
      />
      <h1 class="mt-5 text-h3 font-bold text-ink-800 m-0">正在前往「{{ product.name }}」</h1>
      <p class="mt-2 text-body-sm text-ink-500">
        {{ countdown > 0 ? `${countdown} 秒后自动跳转到外部站点` : '正在跳转…' }}
      </p>

      <!-- 进度条：与倒计时同步的轻量动效 -->
      <div class="mt-5 h-1 rounded-full bg-surface-2 dark:bg-surface-3 overflow-hidden" aria-hidden="true">
        <div
          class="h-full rounded-full bg-brand-gradient transition-[width] duration-1000 ease-linear"
          :style="{ width: (countdown / 2) * 100 + '%' }"
        ></div>
      </div>

      <div class="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          class="px-5 py-2 rounded-full bg-brand-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer border-0"
          @click="go"
        >
          立即前往
        </button>
        <router-link
          to="/"
          class="px-5 py-2 rounded-full border border-border-subtle text-ink-600 dark:text-ink-300 text-sm hover:border-accent-300 hover:text-accent-600 transition-colors"
        >
          取消并返回
        </router-link>
      </div>

      <p class="mt-5 text-xs text-ink-400 leading-5">
        即将访问：<span class="break-all">{{ product.url }}</span>
        <br />
        该页面属于一方工具箱产品矩阵，使用问题可在对应站点反馈
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 产品跳转：/app-jump/:key
 *
 * 职责：
 *   1. 按 key 在产品白名单（站点配置中 enabled 的产品）中校验，拒绝任意 URL —— 防开放重定向
 *   2. 上报一条使用记录（复用 POST /api/me/tool-usage，落 tool_usage_records 表）
 *   3. 校验通过后直接 location.replace 出站，不设中间页（返回键回到主站）
 *
 * 记录口径：与 recordToolUsage 一致，30 秒 sessionStorage 去重，避免刷新重复计数。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { ProductInfo } from '@/components/Layout/Header/products'
import { fetchProductsConfig } from '@/api/site-config'
import { postToolUsage } from '@/api/me/tool-usage'
import { detectSource } from '@/utils/source'

const APP_TITLE = (import.meta.env.VITE_APP_TITLE as string) || '一方工具箱'
const route = useRoute()

const key = computed(() => String(route.params.key || '').trim().toLowerCase())
// 产品白名单来自站点配置（仅含 enabled 的产品）：后台下线的产品与未知 key 一样按「已下线」处理
const product = ref<ProductInfo | null>(null)
const loading = ref(true)
const invalid = computed(() => !loading.value && !product.value)

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

onMounted(async () => {
  // 工具页：不参与 SEO 收录与预渲染
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (!robots) {
    robots = document.createElement('meta')
    robots.name = 'robots'
    document.head.appendChild(robots)
  }
  robots.content = 'noindex, nofollow'

  try {
    const list = await fetchProductsConfig()
    product.value = list.find((p) => p.key === key.value) || null
  } finally {
    loading.value = false
  }

  if (!product.value) {
    document.title = `页面不存在 | ${APP_TITLE}`
    return
  }

  document.title = `正在前往「${product.value.name}」 | ${APP_TITLE}`
  recordAppJump()
  window.location.replace(product.value.url)
})
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

  <!-- 有效 key：校验通过后立即 replace 出站，这里只是跳转瞬间的空态 -->
  <div v-else class="min-h-[60vh]"></div>
</template>

<script setup lang="ts">
/**
 * 评论入口组件：按后台「站点设置 → 评论系统」配置自动切换
 * - giscus（GitHub Discussions 评论，默认，兼容历史行为）
 * - custom（自建评论系统，需审核，见 CustomComments.vue）
 * - disabled（关闭全部评论：不渲染评论区）
 */
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { fetchCommentSystem, fetchGiscusConfig } from '@/api/site-config'
import CustomComments from './CustomComments.vue'

const route = useRoute()
const giscusLoaded = ref(false)
// giscus 主题跟随站点暗色模式（transparent_dark 让 iframe 底色融入卡片）
const { isDark } = useTheme()
const giscusTheme = () => (isDark.value ? 'transparent_dark' : 'light')

/** loading = 配置拉取中；giscus / custom = 后台配置的评论系统；disabled = 后台已关闭评论 */
const mode = ref<'loading' | 'giscus' | 'custom' | 'disabled'>('loading')

// 从环境变量获取配置（后台未配置 giscus repo 时的回退）
const gitUrl = import.meta.env.VITE_GIT_URL || ''
// 从 GitHub URL 中提取 owner 和 repo
// 格式: https://github.com/owner/repo
const match = gitUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
const fallbackRepo = match ? `${match[1]}/${match[2]}` : ''

// giscus 实际生效配置（后台 site-config 优先，缺省回退环境变量/旧硬编码）
const giscusAttrs = ref<Record<string, string | boolean>>({})

const buildGiscusAttrs = (cfg: {
  repo: string
  repo_id: string
  category: string
  category_id: string
  mapping: string
}) => ({
  src: 'https://giscus.app/client.js',
  'data-repo': cfg.repo || fallbackRepo,
  'data-repo-id': cfg.repo_id || 'R_kgDOPUcsXg',
  'data-category': cfg.category || 'General',
  'data-category-id': cfg.category_id || 'DIC_kwDOPUcsXs4C1Y2z',
  'data-mapping': cfg.mapping || 'title',
  'data-strict': '1',
  'data-reactions-enabled': '1',
  'data-emit-metadata': '0',
  'data-input-position': 'bottom',
  'data-theme': giscusTheme(),
  'data-lang': 'zh-CN',
  'data-loading': 'lazy',
  crossorigin: 'anonymous',
  async: true,
})

// 加载 giscus 脚本
const loadGiscus = () => {
  if (giscusLoaded.value) return

  const script = document.createElement('script')
  Object.entries(giscusAttrs.value).forEach(([key, value]) => {
    if (key === 'src') {
      script.src = value as string
    } else if (key === 'async') {
      script.async = value as boolean
    } else if (key === 'crossorigin') {
      script.crossOrigin = value as string
    } else {
      script.setAttribute(key, value as string)
    }
  })

  const container = document.getElementById('giscus-container')
  if (container) {
    container.innerHTML = ''
    container.appendChild(script)
    giscusLoaded.value = true
  }
}

// 重置 giscus（用于路由切换时更新评论）
const resetGiscus = () => {
  const container = document.getElementById('giscus-container')
  if (container) {
    container.innerHTML = ''
    giscusLoaded.value = false
    loadGiscus()
  }
}

onMounted(async () => {
  // 两段式按需请求：先拿评论系统类型，是 giscus 时再拉 giscus 配置（均有模块级缓存，失败内部回退）
  const commentSystem = await fetchCommentSystem()
  if (commentSystem === 'disabled') {
    mode.value = 'disabled'
    return
  }
  if (commentSystem === 'custom') {
    mode.value = 'custom'
    return
  }
  giscusAttrs.value = buildGiscusAttrs(await fetchGiscusConfig())
  mode.value = 'giscus'
  loadGiscus()
})

// 主题切换时通知 giscus iframe 热更新，避免整块重载
watch(isDark, () => {
  if (mode.value !== 'giscus') return
  const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
  iframe?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme: giscusTheme() } } },
    'https://giscus.app',
  )
})

// 监听路由变化，更新评论（自建评论由 CustomComments 内部自行监听）
watch(() => route.path, () => {
  if (mode.value === 'giscus') {
    resetGiscus()
  }
})
</script>

<template>
  <!-- 后台关闭评论时不渲染任何内容 -->
  <div v-if="mode !== 'disabled'" class="giscus-wrapper mt-8">
    <div class="bg-white dark:bg-surface-0 rounded-2xl border border-border-subtle p-6 shadow-sm">
      <h3 class="text-body-lg font-bold text-ink-900 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 2.5A1.5 1.5 0 0 1 3 1h10a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 13 15H3a1.5 1.5 0 0 1-1.5-1.5v-11zM3 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-11A.5.5 0 0 0 13 2H3z"/>
          <path d="M5 5.5A.5.5 0 0 1 5.5 5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 5.5zm0 3A.5.5 0 0 1 5.5 8h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 8.5zm0 3A.5.5 0 0 1 5.5 11.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
        </svg>
        评论交流
      </h3>

      <!-- 自建评论系统 -->
      <template v-if="mode === 'custom'">
        <CustomComments />
      </template>

      <!-- giscus（默认） -->
      <template v-else>
        <p class="text-body-sm text-ink-500 mb-4">
          欢迎在下方留言讨论，如有问题或建议请提交
          <a :href="gitUrl + '/issues'" target="_blank" class="text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300">GitHub Issue</a>
        </p>
        <div v-show="mode === 'giscus'" id="giscus-container"></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.giscus-wrapper {
  min-height: 200px;
}

/* giscus 主题适配 */
:deep(.giscus),
:deep(.giscus-frame) {
  width: 100%;
}

:deep(.giscus-frame) {
  border-radius: 8px;
}
</style>

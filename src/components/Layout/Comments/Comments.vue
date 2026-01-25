<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const giscusLoaded = ref(false)

// 从环境变量获取配置
const gitUrl = import.meta.env.VITE_GIT_URL || ''
// 从 GitHub URL 中提取 owner 和 repo
// 格式: https://github.com/owner/repo
const match = gitUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
const repoOwner = match ? match[1] : ''
const repoName = match ? match[2] : ''

// giscus 配置
const giscusConfig = {
  src: 'https://giscus.app/client.js',
  'data-repo': `${repoOwner}/${repoName}`,
  'data-repo-id': 'R_kgDOPUcsXg', // 需要替换为实际的 repo-id
  'data-category': 'General', // 需要替换为实际的 category
  'data-category-id': 'DIC_kwDOPUcsXs4C1Y2z', // 需要替换为实际的 category-id
  'data-mapping': 'pathname',
  'data-strict': '0',
  'data-reactions-enabled': '1',
  'data-emit-metadata': '0',
  'data-input-position': 'bottom',
  'data-theme': 'light',
  'data-lang': 'zh-CN',
  'data-loading': 'lazy',
  crossorigin: 'anonymous',
  async: true
}

// 加载 giscus 脚本
const loadGiscus = () => {
  if (giscusLoaded.value) return

  const script = document.createElement('script')
  Object.entries(giscusConfig).forEach(([key, value]) => {
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

onMounted(() => {
  loadGiscus()
})

// 监听路由变化，更新评论
watch(() => route.path, () => {
  resetGiscus()
})
</script>

<template>
  <div class="giscus-wrapper mt-8">
    <div class="bg-white rounded-2xl p-6 shadow-sm">
      <h3 class="text-lg font-bold text-warm-800 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 2.5A1.5 1.5 0 0 1 3 1h10a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 13 15H3a1.5 1.5 0 0 1-1.5-1.5v-11zM3 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-11A.5.5 0 0 0 13 2H3z"/>
          <path d="M5 5.5A.5.5 0 0 1 5.5 5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 5.5zm0 3A.5.5 0 0 1 5.5 8h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 8.5zm0 3A.5.5 0 0 1 5.5 11.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
        </svg>
        评论交流
      </h3>
      <p class="text-sm text-gray-500 mb-4">
        欢迎在下方留言讨论，如有问题或建议请提交
        <a :href="gitUrl + '/issues'" target="_blank" class="text-warm-600 hover:text-warm-700">GitHub Issue</a>
      </p>
      <div id="giscus-container"></div>
    </div>
  </div>
</template>

<style scoped>
.giscus-wrapper {
  min-height: 200px;
}

/* giscus 主题适配 */
:deep(.giscus-frame) {
  border-radius: 8px;
}
</style>

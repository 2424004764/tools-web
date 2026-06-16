<template>
  <div class="space-y-4">
    <!-- 应用列表 -->
    <div v-if="!currentApp">
      <h2 class="text-xl font-bold text-gray-800">AI应用中心</h2>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="text-gray-500">加载中...</div>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="error" class="py-8 text-center text-red-500">
        {{ error }}
      </div>

      <!-- 应用网格 -->
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-4">
        <!-- 动态渲染应用卡片 -->
        <div
          v-for="app in apps"
          :key="app.id"
          @click="$emit('select-app', app.name)"
          :class="[
            'p-4 rounded-xl border-2 border-transparent cursor-pointer transition-all hover:shadow-lg',
            `bg-gradient-to-br from-${app.gradient_from} to-${app.gradient_to}`,
            `hover:border-${app.border_color}`
          ]"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="text-2xl">{{ app.icon }}</div>
            <h3 class="text-base font-bold text-gray-800">{{ app.title }}</h3>
          </div>
          <p class="text-xs text-gray-600">{{ app.description }}</p>
        </div>
      </div>
    </div>

    <!-- 当前应用内容 -->
    <div v-else>
      <button
        @click="$emit('back-to-list')"
        class="mb-4 px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
      >
        <span>←</span>
        <span>返回应用列表</span>
      </button>

      <slot :app="currentApp"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Props {
  currentApp: string | null
}

interface AiApp {
  id: string
  name: string
  icon: string
  title: string
  description: string
  category: string
  gradient_from: string
  gradient_to: string
  border_color: string
  sort_order: number
}

defineProps<Props>()

defineEmits<{
  'select-app': [app: string]
  'back-to-list': []
}>()

const apps = ref<AiApp[]>([])
const loading = ref(true)
const error = ref('')

// 加载AI应用列表
const loadApps = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch('/api/ai-apps')
    const result = await response.json()

    if (result.success) {
      apps.value = result.data
    } else {
      error.value = result.error || '加载应用列表失败'
    }
  } catch (err: any) {
    console.error('加载应用列表失败:', err)
    error.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadApps()
})
</script>

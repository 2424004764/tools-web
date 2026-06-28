<template>
  <div class="space-y-4">
    <!-- 应用列表 -->
    <div v-if="!currentApp">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-800">AI应用中心</h2>
        <button
          v-if="isLoggedIn && activeCategory === 'custom'"
          @click="showCreateDialog = true"
          class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          ➕ 创建应用
        </button>
      </div>

      <!-- 分类菜单：系统应用 / 我的应用 / 收藏 -->
      <div class="flex items-center gap-1 mb-4 border-b border-gray-200">
        <button
          @click="activeCategory = 'system'"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeCategory === 'system'
              ? 'text-blue-600 border-blue-500'
              : 'text-gray-600 border-transparent hover:text-gray-800'
          ]"
        >
          系统应用
          <span class="ml-1 text-xs text-gray-400">({{ systemApps.length }})</span>
        </button>
        <button
          @click="activeCategory = 'custom'"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeCategory === 'custom'
              ? 'text-blue-600 border-blue-500'
              : 'text-gray-600 border-transparent hover:text-gray-800'
          ]"
        >
          我的应用
          <span class="ml-1 text-xs text-gray-400">({{ customApps.length }})</span>
        </button>
        <button
          @click="activeCategory = 'favorites'"
          :class="[
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeCategory === 'favorites'
              ? 'text-blue-600 border-blue-500'
              : 'text-gray-600 border-transparent hover:text-gray-800'
          ]"
        >
          <span class="mr-1">♥</span>收藏
          <span class="ml-1 text-xs text-gray-400">({{ favoriteApps.length }})</span>
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="text-gray-500">加载中...</div>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="error" class="py-8 text-center text-red-500">
        {{ error }}
      </div>

      <!-- 应用网格 -->
      <div v-else>
        <!-- 系统应用 -->
        <div v-if="activeCategory === 'system'">
          <div v-if="systemApps.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <div
              v-for="app in systemApps"
              :key="app.id"
              @click="selectApp(app)"
              :class="[
                'relative p-4 rounded-xl border-2 border-transparent cursor-pointer transition-all hover:shadow-lg',
                `bg-gradient-to-br from-${app.gradient_from} to-${app.gradient_to}`,
                `hover:border-${app.border_color}`
              ]"
            >
              <!-- 收藏按钮 -->
              <button
                @click.stop="toggleFavorite(app)"
                :disabled="favoriteLoading[app.id]"
                :class="[
                  'absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center leading-none text-base transition-all',
                  isFavorited(app.id)
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-white/70 text-gray-500 hover:bg-white hover:text-red-500'
                ]"
                :title="isFavorited(app.id) ? '取消收藏' : '收藏'"
              >
                <span v-if="favoriteLoading[app.id]" class="block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <svg
                  v-else
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    v-if="isFavorited(app.id)"
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  />
                  <path
                    v-else
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z"
                  />
                </svg>
              </button>
              <div class="flex items-center gap-2 mb-2 pr-8">
                <div class="text-2xl leading-none">{{ app.icon }}</div>
                <h3 class="text-base font-bold text-gray-800">{{ app.title }}</h3>
              </div>
              <p class="text-xs text-gray-600">{{ app.description }}</p>
            </div>
          </div>
          <div v-else class="py-12 text-center text-gray-500 text-sm">
            暂无系统应用
          </div>
        </div>

        <!-- 我的应用 -->
        <div v-else-if="activeCategory === 'custom'">
          <div v-if="customApps.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <div
              v-for="app in customApps"
              :key="app.id"
              :class="[
                'p-4 rounded-xl border-2 border-transparent cursor-pointer transition-all hover:shadow-lg relative group',
                `bg-gradient-to-br from-${app.gradient_from} to-${app.gradient_to}`,
                `hover:border-${app.border_color}`
              ]"
            >
              <div @click="selectApp(app)">
                <div class="flex items-center gap-2 mb-2">
                  <div class="text-2xl leading-none">{{ app.icon }}</div>
                  <h3 class="text-base font-bold text-gray-800">{{ app.title }}</h3>
                </div>
                <p class="text-xs text-gray-600">{{ app.description }}</p>
              </div>
              <!-- 收藏按钮（始终可见） -->
              <button
                @click.stop="toggleFavorite(app)"
                :disabled="favoriteLoading[app.id]"
                :class="[
                  'absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center leading-none text-base transition-all',
                  isFavorited(app.id)
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-white/70 text-gray-500 hover:bg-white hover:text-red-500',
                  'opacity-0 group-hover:opacity-100'
                ]"
                :title="isFavorited(app.id) ? '取消收藏' : '收藏'"
              >
                <span v-if="favoriteLoading[app.id]" class="block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <svg
                  v-else
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    v-if="isFavorited(app.id)"
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  />
                  <path
                    v-else
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z"
                  />
                </svg>
              </button>
              <!-- 操作按钮 -->
              <div class="absolute top-9 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click.stop="editApp(app)"
                  class="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-600"
                  title="编辑"
                >
                  ✎
                </button>
                <button
                  @click.stop="deleteApp(app.id)"
                  class="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  title="删除"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
          <div v-else class="py-12 text-center text-gray-500 text-sm">
            <template v-if="!isLoggedIn">登录后可以创建自己的AI应用</template>
            <template v-else>还没有创建过应用，点击右上角「➕ 创建应用」开始吧</template>
          </div>
        </div>

        <!-- 收藏应用 -->
        <div v-else-if="activeCategory === 'favorites'">
          <div v-if="!isLoggedIn" class="py-12 text-center text-gray-500 text-sm">
            登录后查看你的收藏应用
          </div>
          <div v-else-if="favoriteApps.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <div
              v-for="app in favoriteApps"
              :key="app.id"
              :class="[
                'relative p-4 rounded-xl border-2 border-transparent cursor-pointer transition-all hover:shadow-lg group',
                `bg-gradient-to-br from-${app.gradient_from} to-${app.gradient_to}`,
                `hover:border-${app.border_color}`
              ]"
            >
              <div @click="selectApp(app)">
                <div class="flex items-center gap-2 mb-2 pr-8">
                  <div class="text-2xl leading-none">{{ app.icon }}</div>
                  <h3 class="text-base font-bold text-gray-800">{{ app.title }}</h3>
                </div>
                <p class="text-xs text-gray-600">{{ app.description }}</p>
              </div>
              <button
                @click.stop="toggleFavorite(app)"
                :disabled="favoriteLoading[app.id]"
                class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center leading-none text-base hover:bg-red-600 transition-all"
                title="取消收藏"
              >
                <span v-if="favoriteLoading[app.id]" class="block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                <svg
                  v-else
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            </div>
          </div>
          <div v-else class="py-12 text-center text-gray-500 text-sm">
            还没有收藏任何应用，点击系统应用或我的应用右上角的 ♡ 进行收藏
          </div>
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

    <!-- 创建/编辑应用对话框 -->
    <div v-if="showCreateDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click="closeDialog">
      <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
        <h3 class="text-xl font-bold text-gray-800 mb-4">
          {{ isEditMode ? '编辑AI应用' : '创建自定义AI应用' }}
        </h3>

        <div class="space-y-4">
          <!-- 应用标题 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">应用标题 *</label>
            <input
              v-model="newApp.title"
              type="text"
              placeholder="例如：AI写作助手"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <!-- 图标和分类 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">图标 (Emoji) *</label>
              <div class="relative">
                <input
                  v-model="newApp.icon"
                  type="text"
                  placeholder="🤖"
                  readonly
                  @click="showIconPicker = !showIconPicker"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                />
                <!-- 图标选择器 -->
                <div v-if="showIconPicker" class="absolute z-10 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-h-64 overflow-y-auto">
                  <div class="grid grid-cols-8 gap-2">
                    <button
                      v-for="icon in iconPresets"
                      :key="icon"
                      @click="selectIcon(icon)"
                      :class="[
                        'text-2xl p-2 rounded hover:bg-gray-100 transition-colors',
                        newApp.icon === icon ? 'bg-blue-100' : ''
                      ]"
                      type="button"
                    >
                      {{ icon }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">分类 *</label>
              <select
                v-model="newApp.category"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="general">通用</option>
                <option value="life">生活</option>
                <option value="travel">旅行</option>
                <option value="image">图像</option>
                <option value="text">文本</option>
                <option value="health">健康</option>
                <option value="legal">法律</option>
              </select>
            </div>
          </div>

          <!-- 应用描述 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">应用描述 *</label>
            <textarea
              v-model="newApp.description"
              placeholder="简单描述这个应用的功能"
              rows="2"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></textarea>
          </div>

          <!-- AI系统提示词 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">AI系统提示词 *</label>
            <textarea
              v-model="newApp.system_prompt"
              placeholder="告诉AI它的角色和任务，例如：你是一位专业的写作助手，擅长创作各类文章..."
              rows="4"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></textarea>
          </div>

          <!-- 配色方案 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">配色方案</label>
            <div class="grid grid-cols-3 gap-2">
              <div
                v-for="color in colorPresets"
                :key="color.name"
                @click="selectColor(color)"
                :class="[
                  'p-3 rounded-lg cursor-pointer border-2 transition-all',
                  `bg-gradient-to-br from-${color.gradient_from} to-${color.gradient_to}`,
                  newApp.gradient_from === color.gradient_from ? 'border-blue-500' : 'border-transparent'
                ]"
              >
                <div class="text-xs text-center text-gray-700 font-medium">{{ color.name }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 按钮 -->
        <div class="flex gap-3 mt-6">
          <button
            @click="closeDialog"
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
          <button
            @click="saveApp"
            :disabled="isCreating || !isFormValid"
            class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {{ isCreating ? (isEditMode ? '保存中...' : '创建中...') : (isEditMode ? '保存' : '创建应用') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { getLocalToken } from '@/utils/user'

interface Props {
  currentApp: string | null
  initialAppId?: string | null
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
  app_type: 'system' | 'custom'
  system_prompt?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'select-app': [app: string, appData?: AiApp]
  'back-to-list': []
}>()

const userStore = useUserStore()
const apps = ref<AiApp[]>([])
const loading = ref(true)
const error = ref('')
const showCreateDialog = ref(false)
const isCreating = ref(false)
const showIconPicker = ref(false)
const isEditMode = ref(false)
const editingAppId = ref('')
const activeCategory = ref<'system' | 'custom' | 'favorites'>('system')

// 收藏相关
const favoriteIds = ref<Set<string>>(new Set())
const favoriteLoading = ref<Record<string, boolean>>({})

// 是否已登录
const isLoggedIn = computed(() => !!userStore.user?.uid)

// 判断应用是否已收藏
const isFavorited = (appId: string) => favoriteIds.value.has(appId)

// 加载当前用户的收藏ID列表
const loadFavoriteIds = async () => {
  const token = getLocalToken()
  if (!token) {
    favoriteIds.value = new Set()
    return
  }

  try {
    const response = await fetch('/api/favorite-apps?ids=1', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const result = await response.json()
    if (result.success && Array.isArray(result.data)) {
      favoriteIds.value = new Set(result.data)
    }
  } catch (err) {
    console.error('加载收藏列表失败:', err)
  }
}

// 切换收藏状态
const toggleFavorite = async (app: AiApp) => {
  if (!isLoggedIn.value) {
    ElMessage.warning('请先登录后再收藏')
    return
  }

  const token = getLocalToken()
  if (!token) return

  const wasFavorited = isFavorited(app.id)
  favoriteLoading.value[app.id] = true

  // 乐观更新
  const next = new Set(favoriteIds.value)
  if (wasFavorited) {
    next.delete(app.id)
  } else {
    next.add(app.id)
  }
  favoriteIds.value = next

  try {
    if (wasFavorited) {
      // 取消收藏
      const response = await fetch(`/api/favorite-apps?app_id=${encodeURIComponent(app.id)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error || '取消收藏失败')
    } else {
      // 添加收藏
      const response = await fetch('/api/favorite-apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ app_id: app.id })
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error || '收藏失败')
    }
  } catch (err: any) {
    // 回滚乐观更新
    const rollback = new Set(favoriteIds.value)
    if (wasFavorited) {
      rollback.add(app.id)
    } else {
      rollback.delete(app.id)
    }
    favoriteIds.value = rollback
    ElMessage.error(err.message || '操作失败')
  } finally {
    favoriteLoading.value[app.id] = false
  }
}

// 系统应用和自建应用
const systemApps = computed(() => apps.value.filter(app => app.app_type === 'system'))
const customApps = computed(() => apps.value.filter(app => app.app_type === 'custom'))
const favoriteApps = computed(() =>
  apps.value.filter(app => favoriteIds.value.has(app.id))
)

// 图标预设
const iconPresets = [
  // 常用
  '🤖', '💡', '⚡', '🎯', '✨', '🔥', '💎', '🎨',
  // 表情
  '😀', '😊', '🤗', '😎', '🥳', '😍', '🤩', '😇',
  // 动物
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄',
  // 自然
  '🌙', '⭐', '☀️', '🌈', '🌸', '🌺', '🌻', '🌹',
  '🌷', '🌴', '🌲', '🍀', '🍁', '🍂', '🌾', '🌿',
  // 食物
  '🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍰', '🎂',
  '🍪', '🍩', '🍫', '🍬', '🍭', '🍮', '🍯', '🍎',
  // 物品
  '📱', '💻', '⌚', '📷', '🎮', '🎧', '🎤', '🎬',
  '📚', '📖', '✏️', '📝', '🎒', '👑', '💼', '🔨',
  // 交通
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑',
  '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵',
  // 建筑
  '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨',
  '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '🗼',
  // 符号
  '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍',
  '⚡', '🔥', '💫', '✨', '⭐', '🌟', '💥', '💢',
  '💨', '💦', '💧', '🎈', '🎉', '🎊', '🎁', '🏆',
  // 工具
  '🔧', '🔨', '⚒️', '🛠️', '⚙️', '🔩', '⚗️', '🔬',
  '💉', '💊', '🩹', '🩺', '🌡️', '🧪', '🧬', '🔭'
]

// 新应用表单
const newApp = ref({
  title: '',
  icon: '🤖',
  description: '',
  category: 'general',
  system_prompt: '',
  gradient_from: 'blue-50',
  gradient_to: 'indigo-50',
  border_color: 'blue-400'
})

// 表单验证
const isFormValid = computed(() => {
  return newApp.value.title.trim() &&
         newApp.value.icon.trim() &&
         newApp.value.description.trim() &&
         newApp.value.system_prompt.trim()
})

// 配色方案预设
const colorPresets = [
  { name: '蓝色', gradient_from: 'blue-50', gradient_to: 'indigo-50', border_color: 'blue-400' },
  { name: '紫色', gradient_from: 'purple-50', gradient_to: 'blue-50', border_color: 'purple-400' },
  { name: '绿色', gradient_from: 'green-50', gradient_to: 'emerald-50', border_color: 'green-400' },
  { name: '粉色', gradient_from: 'pink-50', gradient_to: 'rose-50', border_color: 'pink-400' },
  { name: '红色', gradient_from: 'red-50', gradient_to: 'pink-50', border_color: 'red-400' },
  { name: '橙色', gradient_from: 'orange-50', gradient_to: 'amber-50', border_color: 'orange-400' },
  { name: '青色', gradient_from: 'sky-50', gradient_to: 'cyan-50', border_color: 'sky-400' },
  { name: '黄色', gradient_from: 'yellow-50', gradient_to: 'lime-50', border_color: 'yellow-400' },
  { name: '灰色', gradient_from: 'gray-50', gradient_to: 'slate-50', border_color: 'gray-400' }
]

// 选择配色
const selectColor = (color: typeof colorPresets[0]) => {
  newApp.value.gradient_from = color.gradient_from
  newApp.value.gradient_to = color.gradient_to
  newApp.value.border_color = color.border_color
}

// 选择图标
const selectIcon = (icon: string) => {
  newApp.value.icon = icon
  showIconPicker.value = false
}

// 关闭对话框
const closeDialog = () => {
  showCreateDialog.value = false
  showIconPicker.value = false
  isEditMode.value = false
  editingAppId.value = ''
  // 重置表单
  newApp.value = {
    title: '',
    icon: '🤖',
    description: '',
    category: 'general',
    system_prompt: '',
    gradient_from: 'blue-50',
    gradient_to: 'indigo-50',
    border_color: 'blue-400'
  }
}

// 编辑应用
const editApp = (app: AiApp) => {
  isEditMode.value = true
  editingAppId.value = app.id
  newApp.value = {
    title: app.title,
    icon: app.icon,
    description: app.description,
    category: app.category,
    system_prompt: '', // 需要从API获取
    gradient_from: app.gradient_from,
    gradient_to: app.gradient_to,
    border_color: app.border_color
  }

  // 获取完整的应用信息（包括system_prompt）
  loadAppDetail(app.id)

  showCreateDialog.value = true
}

// 加载应用详情（包括system_prompt）
const loadAppDetail = async (appId: string) => {
  const token = getLocalToken()
  if (!token) return

  try {
    const response = await fetch(`/api/ai-apps?id=${appId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    const result = await response.json()

    if (result.success && result.data) {
      newApp.value.system_prompt = result.data.system_prompt || ''
    }
  } catch (err) {
    console.error('加载应用详情失败:', err)
  }
}

// 加载AI应用列表
const loadApps = async () => {
  loading.value = true
  error.value = ''

  try {
    const token = getLocalToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }

    // 如果有token，添加到请求头
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch('/api/ai-apps', { headers })
    const result = await response.json()

    if (result.success) {
      apps.value = result.data

      // 加载当前用户的收藏ID列表
      loadFavoriteIds()

      // 刷新后恢复：URL 里指定的 app，加载完后自动选中
      if (props.initialAppId) {
        const found = apps.value.find((a: AiApp) => a.name === props.initialAppId)
        if (found) {
          // 异步执行 selectApp，不阻塞 loadApps 返回
          selectApp(found)
        } else {
          // URL 里的 app 不存在，回到列表
          emit('back-to-list')
        }
      }
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

// 保存应用（创建或编辑）
const saveApp = async () => {
  if (!isFormValid.value) {
    ElMessage.warning('请填写完整信息')
    return
  }

  const token = getLocalToken()
  if (!token) {
    ElMessage.warning('请先登录')
    return
  }

  isCreating.value = true

  try {
    const method = isEditMode.value ? 'PUT' : 'POST'
    const url = isEditMode.value ? `/api/ai-apps?id=${editingAppId.value}` : '/api/ai-apps'

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newApp.value)
    })

    const result = await response.json()

    if (result.success) {
      ElMessage.success(isEditMode.value ? '应用更新成功' : '应用创建成功')
      closeDialog()
      // 重新加载列表
      await loadApps()
    } else {
      ElMessage.error(result.error || (isEditMode.value ? '更新失败' : '创建失败'))
    }
  } catch (err: any) {
    console.error('保存应用失败:', err)
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    isCreating.value = false
  }
}

// 删除应用
const deleteApp = async (appId: string) => {
  if (!confirm('确定要删除这个应用吗？')) {
    return
  }

  const token = getLocalToken()
  if (!token) {
    ElMessage.warning('请先登录')
    return
  }

  try {
    const response = await fetch(`/api/ai-apps?id=${appId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const result = await response.json()

    if (result.success) {
      ElMessage.success('应用已删除')
      // 本地收藏集合中同步移除（无需调DELETE，后端已级联或该app_id已失效）
      const next = new Set(favoriteIds.value)
      next.delete(appId)
      favoriteIds.value = next
      await loadApps()
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch (err: any) {
    console.error('删除应用失败:', err)
    ElMessage.error('网络错误，请稍后重试')
  }
}

// 选择应用
const selectApp = async (app: AiApp) => {
  // 如果是自建应用，先加载完整信息（包括system_prompt）
  if (app.app_type === 'custom') {
    const token = getLocalToken()
    if (!token) {
      ElMessage.warning('请先登录')
      return
    }

    try {
      const response = await fetch(`/api/ai-apps?id=${app.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const result = await response.json()

      if (result.success && result.data) {
        // 使用完整的应用信息
        emit('select-app', app.name, result.data)
      } else {
        ElMessage.error('加载应用失败')
      }
    } catch (err) {
      console.error('加载应用详情失败:', err)
      ElMessage.error('网络错误')
    }
  } else {
    // 系统应用：列表接口已返回 system_prompt，直接传递
    emit('select-app', app.name, app)
  }
}

onMounted(() => {
  loadApps()
})
</script>

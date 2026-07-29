<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'
import {
  fetchAiMediaWorks,
  fetchAiMediaCategories,
  fetchAiMediaWork,
  type AiMediaWork,
  type AiMediaCategory,
} from '@/api/ai-media-works'

const info = reactive({ title: 'AI 媒体作品' })

// ============ 状态 ============
const loading = ref(false)
const list = ref<AiMediaWork[]>([])
const categories = ref<AiMediaCategory[]>([])

// 当前筛选：null = 全部
const activeCategory = ref<string>('') // 空串 = 全部
const activeType = ref<'' | 'image' | 'video'>('') // 用 type 切换 tab

const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 24,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

// ============ 详情弹窗 ============
const detailVisible = ref(false)
const selected = ref<AiMediaWork | null>(null)
const detailLoading = ref(false)

const openDetail = async (row: AiMediaWork) => {
  selected.value = row // 先用列表数据即时显示
  detailVisible.value = true
  detailLoading.value = true
  try {
    const full = await fetchAiMediaWork(row.id)
    selected.value = full
  } catch (e) {
    // 失败保持列表数据
  } finally {
    detailLoading.value = false
  }
}

const closeDetail = () => {
  detailVisible.value = false
  selected.value = null
}

// ============ 加载 ============
const loadCategories = async () => {
  try {
    categories.value = await fetchAiMediaCategories()
  } catch (e) {
    // 失败不阻塞
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const result = await fetchAiMediaWorks({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      category: activeCategory.value || undefined,
      type: activeType.value || undefined,
    })
    list.value = result.list
    pagination.value = result.pagination
  } catch (e) {
    console.error('load ai-media-works fail', e)
  } finally {
    loading.value = false
  }
}

const handleCategoryChange = (name: string) => {
  activeCategory.value = name
  pagination.value.page = 1
  loadList()
}

const handleTypeChange = (t: '' | 'image' | 'video') => {
  activeType.value = t
  pagination.value.page = 1
  loadList()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  loadList()
  // 滚到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ============ 展示辅助 ============
const formatTime = (s: string) => {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return d.toLocaleDateString('zh-CN')
}

const formatDuration = (sec: number | null) => {
  if (!sec || sec <= 0) return ''
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

// 给图片做兜底（外链失效时显示占位）
const onImageError = (e: Event) => {
  const img = e.target as HTMLImageElement
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  img.src =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f3f4f6"/><text x="200" y="155" font-size="18" fill="#9ca3af" text-anchor="middle" font-family="sans-serif">图片加载失败</text></svg>',
    )
}

// 类型切换时的标签
const typeTabs: { value: '' | 'image' | 'video'; label: string; icon: string }[] = [
  { value: '', label: '全部', icon: '✦' },
  { value: 'image', label: '图片', icon: '🖼' },
  { value: 'video', label: '视频', icon: '🎬' },
]

const currentCategoryName = computed(() => {
  if (!activeCategory.value) return '全部分类'
  const c = categories.value.find((c) => c.name === activeCategory.value)
  return c ? c.name : activeCategory.value
})

// 开启弹窗时 body 锁滚动
watch(detailVisible, (v) => {
  if (typeof window.document === 'undefined') return
  window.document.body.style.overflow = v ? 'hidden' : ''
})

onMounted(() => {
  loadCategories()
  loadList()
})

onUnmounted(() => {
  if (typeof window.document !== 'undefined') {
    window.document.body.style.overflow = ''
  }
})

function copyLink(item: any) {
  navigator.clipboard?.writeText(item.media_url)
  ElMessage.success('已复制链接')
}

function openOriginal(item: any) {
  const a = document.createElement('a')
  a.href = item.media_url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.click()
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <!-- 顶部说明卡 -->
    <div class="px-4">
      <div class="rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-4 border border-indigo-100">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-2xl">🎨</span>
          <h2 class="text-base font-semibold text-gray-800">AI 媒体作品画廊</h2>
        </div>
        <p class="text-sm text-gray-600 leading-relaxed">
          汇集由免费 AI 工具（Agnes 等）生成的作品，
          每天定时更新。点击任意作品查看完整提示词与原图。
        </p>
      </div>
    </div>

    <!-- 类型切换 -->
    <div class="px-4 mt-3">
      <div class="rounded-2xl bg-white p-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm text-gray-500 mr-2">类型</span>
          <button
            v-for="t in typeTabs"
            :key="t.value"
            class="px-3 py-1.5 rounded-lg text-sm transition-all"
            :class="
              activeType === t.value
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            "
            @click="handleTypeChange(t.value)"
          >
            <span class="mr-1">{{ t.icon }}</span>{{ t.label }}
          </button>

          <span class="ml-auto text-xs text-gray-400">
            共 {{ pagination.total }} 个作品
          </span>
        </div>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div v-if="categories.length > 0" class="px-4 mt-3">
      <div class="rounded-2xl bg-white p-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm text-gray-500">分类</span>
          <span class="text-xs text-gray-400">当前：{{ currentCategoryName }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1 rounded-full text-xs transition-all"
            :class="
              !activeCategory
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            "
            @click="handleCategoryChange('')"
          >
            全部
          </button>
          <button
            v-for="c in categories"
            :key="c.name"
            class="px-3 py-1 rounded-full text-xs transition-all"
            :class="
              activeCategory === c.name
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            "
            @click="handleCategoryChange(c.name)"
          >
            {{ c.name }}
            <span class="opacity-60 ml-1">{{ c.count }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="px-4 mt-3">
      <div v-loading="loading" class="rounded-2xl bg-white p-4">
        <div
          v-if="list.length === 0 && !loading"
          class="py-16 text-center text-gray-400"
        >
          <div class="text-5xl mb-2">📭</div>
          <p>暂无作品</p>
        </div>

        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          <div
            v-for="item in list"
            :key="item.id"
            class="group cursor-pointer rounded-xl overflow-hidden border border-gray-100 hover:border-indigo-300 hover:shadow-lg transition-all"
            @click="openDetail(item)"
          >
            <!-- 媒体预览 -->
            <div class="relative aspect-square bg-gray-100 overflow-hidden">
              <img
                v-if="item.media_type === 'image'"
                :src="item.thumbnail_url || item.media_url"
                :alt="item.prompt"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                @error="onImageError"
              />
              <video
                v-else
                :src="item.media_url"
                :poster="item.thumbnail_url || undefined"
                class="w-full h-full object-cover"
                muted
                preload="metadata"
                @mouseenter="(e) => (e.target as HTMLVideoElement).play().catch(() => {})"
                @mouseleave="(e) => {
                  const v = e.target as HTMLVideoElement
                  v.pause()
                  v.currentTime = 0
                }"
              />
              <!-- 视频角标 -->
              <div
                v-if="item.media_type === 'video'"
                class="absolute top-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded"
              >
                ▶ {{ formatDuration(item.duration) || '视频' }}
              </div>
              <!-- 分类角标 -->
              <div
                class="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs px-1.5 py-0.5 rounded"
              >
                {{ item.category }}
              </div>
            </div>

            <!-- 文字信息 -->
            <div class="p-2">
              <p
                class="text-xs text-gray-700 line-clamp-2 leading-snug"
                :title="item.prompt"
              >
                {{ item.prompt }}
              </p>
              <div class="flex items-center justify-between mt-1.5">
                <span class="text-xs text-gray-400">{{ formatTime(item.created_at) }}</span>
                <span v-if="item.model_name" class="text-xs text-indigo-500 truncate ml-2 max-w-[60%]">
                  {{ item.model_name }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="pagination.totalPages > 1" class="flex justify-center mt-6">
          <el-pagination
            :current-page="pagination.page"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            :page-count="pagination.totalPages"
            layout="prev, pager, next, jumper"
            :background="true"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :show-close="false"
      width="min(960px, 96vw)"
      align-center
      destroy-on-close
      class="!p-0"
      @close="closeDetail"
    >
      <div v-if="selected" v-loading="detailLoading" class="flex flex-col md:flex-row max-h-[88vh]">
        <!-- 媒体区 -->
        <div class="md:flex-1 bg-black flex items-center justify-center min-h-[280px] md:min-h-[60vh]">
          <img
            v-if="selected.media_type === 'image'"
            :src="selected.media_url"
            :alt="selected.prompt"
            class="max-w-full max-h-[88vh] object-contain"
            @error="onImageError"
          />
          <video
            v-else
            :src="selected.media_url"
            :poster="selected.thumbnail_url || undefined"
            controls
            autoplay
            loop
            class="max-w-full max-h-[88vh]"
          />
        </div>

        <!-- 信息区 -->
        <div class="md:w-80 shrink-0 p-5 overflow-y-auto bg-white">
          <div class="flex items-center justify-between mb-3">
            <el-tag size="small" type="primary" effect="plain">{{ selected.category }}</el-tag>
            <el-tag v-if="selected.media_type === 'video'" size="small" type="warning" effect="plain">
              🎬 视频
            </el-tag>
            <el-tag v-else size="small" type="success" effect="plain">🖼 图片</el-tag>
          </div>

          <h3 class="text-sm font-semibold text-gray-800 mb-2">提示词（Prompt）</h3>
          <div
            class="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 mb-4 whitespace-pre-wrap break-words"
          >
            {{ selected.prompt }}
          </div>

          <el-descriptions :column="1" border size="small" class="mb-4">
            <el-descriptions-item v-if="selected.model_name" label="模型">
              {{ selected.model_name }}
            </el-descriptions-item>
            <el-descriptions-item label="分类">
              {{ selected.category }}
            </el-descriptions-item>
            <el-descriptions-item v-if="selected.width && selected.height" label="尺寸">
              {{ selected.width }} × {{ selected.height }}
            </el-descriptions-item>
            <el-descriptions-item v-if="selected.duration" label="时长">
              {{ formatDuration(selected.duration) }}
            </el-descriptions-item>
            <el-descriptions-item label="浏览">
              {{ selected.view_count }} 次
            </el-descriptions-item>
            <el-descriptions-item label="时间">
              {{ formatTime(selected.created_at) }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="flex gap-2">
            <el-button
              type="primary"
              size="small"
              class="!flex-1"
              @click="copyLink(selected)"
            >
              复制链接
            </el-button>
            <el-button
              size="small"
              class="!flex-1"
              @click="openOriginal(selected)"
            >
              打开原图
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <ToolDetail title="关于">
      <el-text>
        本页面展示由免费 AI 模型（如 Agnes 等）自动生成的图片与视频。
        作品由后台定时任务每日推送，所有数据存储在 Cloudflare D1 中。
        如对作品有意见，请通过页脚联系方式反馈。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

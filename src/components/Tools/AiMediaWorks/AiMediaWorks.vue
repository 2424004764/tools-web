<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage } from 'element-plus'
import {
  fetchAiMediaWorks,
  fetchAiMediaCategories,
  fetchAiMediaWork,
  fetchAiMediaCounts,
  type AiMediaWork,
  type AiMediaCategory,
} from '@/api/ai-media-works'

const info = reactive({ title: 'AI 媒体作品' })

// ============ 状态 ============
const loading = ref(false)
const list = ref<AiMediaWork[]>([])
const loadedCoverIds = reactive(new Set<number>())
const categories = ref<AiMediaCategory[]>([])
// 全局视频/图片总数（与当前筛选无关，挂在 tab 行展示）
const totalCounts = ref<{ total: number; video: number; image: number }>({
  total: 0,
  video: 0,
  image: 0,
})

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

// 拉取全局视频/图片总数（用于顶部 tab 旁的展示）
const loadTotalCounts = async () => {
  try {
    totalCounts.value = await fetchAiMediaCounts()
  } catch (e) {
    // 失败不阻塞，保持 0
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
    loadedCoverIds.clear()
    failedCoverIds.clear()
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

const markCoverLoaded = (id: number) => {
  loadedCoverIds.add(id)
}

// 是否支持真实 hover（触屏设备为 false，避免移动端触发 hover 播放）
const canHover = ref(true)

// 响应式：< 640px 视为手机端。手机端分页要简化（去掉 jumper、缩小按钮、限制页码按钮数），
// 否则页码太长会撑破容器出现整页横向滚动条。
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

// 视频封面 src：加 #t=0.1 让浏览器直接渲染视频首帧作为静态封面，
// 这样没有 thumbnail_url 的视频也能正常显示画面（而不是 CSS 占位）。
const videoCoverSrc = (item: AiMediaWork) => {
  if (!item.media_url || item.media_url.includes('#')) return item.media_url
  return `${item.media_url}#t=0.1`
}

const handleVideoEnter = (e: Event) => {
  if (!canHover.value) return
  ;(e.target as HTMLVideoElement).play().catch(() => {})
}

const handleVideoLeave = (e: Event) => {
  if (!canHover.value) return
  const v = e.target as HTMLVideoElement
  v.pause()
  v.currentTime = 0
}

// 视频 src 真的彻底失败时（外链失效、iOS 黑屏等），用独立的失败集合触发 CSS 占位
const failedCoverIds = reactive(new Set<number>())

const onCoverError = (_e: Event, id: number) => {
  failedCoverIds.add(id)
  markCoverLoaded(id) // 让骨架消失
}

// 给图片做兜底（外链失效时显示占位）
const onImageError = (e: Event, coverId?: number) => {
  const img = e.target as HTMLImageElement
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  if (coverId) markCoverLoaded(coverId)
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
  if (typeof window.matchMedia === 'function') {
    canHover.value = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  loadCategories()
  loadTotalCounts()
  loadList()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
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
            共 {{ totalCounts.total }} 个作品 ·
            <span class="text-indigo-500">🎬 视频 {{ totalCounts.video }}</span>
            ·
            <span class="text-emerald-500">🖼 图片 {{ totalCounts.image }}</span>
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
              <!-- 图片：<img> 标签 -->
              <img
                v-if="item.media_type === 'image'"
                :src="item.thumbnail_url || item.media_url"
                :alt="item.prompt"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-105 transition-[transform,opacity] duration-300"
                :class="loadedCoverIds.has(item.id) ? 'opacity-100' : 'opacity-0'"
                @load="markCoverLoaded(item.id)"
                @error="onImageError($event, item.id)"
              />

              <!-- 视频：<video> 标签做静态封面（#t=0.1 让浏览器渲染首帧），
                   hover 时自动播放，离开时暂停回 0，hover-leave 仍能看到首帧 -->
              <video
                v-else
                :src="videoCoverSrc(item)"
                :poster="item.thumbnail_url || undefined"
                class="w-full h-full object-cover transition-opacity duration-300"
                :class="loadedCoverIds.has(item.id) ? 'opacity-100' : 'opacity-0'"
                muted
                playsinline
                webkit-playsinline
                disablepictureinpicture
                preload="metadata"
                @loadedmetadata="markCoverLoaded(item.id)"
                @loadeddata="markCoverLoaded(item.id)"
                @error="onCoverError($event, item.id)"
                @mouseenter="handleVideoEnter"
                @mouseleave="handleVideoLeave"
              />

              <!-- 视频 src 彻底失败时的 CSS 占位兜底 -->
              <div
                v-if="item.media_type === 'video' && failedCoverIds.has(item.id)"
                class="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
              >
                <div
                  class="w-14 h-14 rounded-full bg-white/15 backdrop-blur flex items-center justify-center mb-2 shadow-lg ring-1 ring-white/10"
                >
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="white" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span class="text-[10px] tracking-[0.2em] text-white/60">VIDEO</span>
              </div>

              <!-- 加载骨架（资源还没回来的时候显示） -->
              <div
                v-if="!loadedCoverIds.has(item.id)"
                class="cover-skeleton absolute inset-0 flex items-center justify-center pointer-events-none"
                aria-hidden="true"
              >
                <span class="cover-loading-dot"></span>
                <span class="ml-2 text-xs font-medium text-gray-400">封面加载中</span>
              </div>

              <!-- 视频时长角标 -->
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

        <!-- 分页：移动端简化布局（去掉 jumper、缩小按钮、限制页码按钮数到 5），
             并用 overflow-x-auto 兜底，避免页码过多时把整个页面撑出横向滚动条 -->
        <div v-if="pagination.totalPages > 1" class="mt-6 px-1 overflow-x-auto">
          <div class="flex justify-center min-w-fit">
            <el-pagination
              :current-page="pagination.page"
              :page-size="pagination.pageSize"
              :total="pagination.total"
              :page-count="pagination.totalPages"
              :pager-count="5"
              :layout="isMobile ? 'prev, pager, next' : 'prev, pager, next, jumper'"
              :small="isMobile"
              :background="true"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :show-close="false"
      width="min(960px, 92vw)"
      align-center
      destroy-on-close
      class="aimw-dialog !p-0"
      @close="closeDetail"
    >
      <div
        v-if="selected"
        v-loading="detailLoading"
        class="relative flex flex-col md:flex-row h-[82vh] md:h-[86vh] overflow-hidden"
      >
        <!-- 媒体区：关闭按钮悬浮在自己右上角，避免在桌面布局下压住信息区的类型标签 -->
        <div class="md:flex-1 bg-black flex items-center justify-center shrink-0 relative">
          <!-- 关闭按钮（移动端必须一眼可见、可点） -->
          <button type="button" class="aimw-close" aria-label="关闭" @click="closeDetail">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
              />
            </svg>
          </button>

          <img
            v-if="selected.media_type === 'image'"
            :src="selected.media_url"
            :alt="selected.prompt"
            class="max-w-full max-h-[45vh] md:max-h-[86vh] object-contain"
            @error="onImageError"
          />
          <video
            v-else
            :src="selected.media_url"
            :poster="selected.thumbnail_url || undefined"
            controls
            autoplay
            muted
            playsinline
            webkit-playsinline
            loop
            class="max-w-full max-h-[45vh] md:max-h-[86vh]"
          />
        </div>

        <!-- 信息区：拆成「可滚动正文 + 固定底部操作栏」，避免按钮被挤出可视区 -->
        <div class="md:w-80 shrink-0 bg-white flex-1 min-h-0 flex flex-col">
          <!-- 滚动正文 -->
          <div class="flex-1 min-h-0 overflow-y-auto p-5">
            <div class="flex flex-wrap items-center gap-2 mb-3">
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
          </div>

          <!-- 固定操作栏：始终位于信息区底部，不随正文滚动 -->
          <div class="shrink-0 border-t border-gray-100 p-5 bg-white">
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
            <el-button class="!w-full !ml-0 mt-2 md:!hidden" size="small" @click="closeDetail">
              关闭
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

.cover-skeleton {
  background: linear-gradient(110deg, #f3f4f6 25%, #e5e7eb 42%, #f3f4f6 58%);
  background-size: 200% 100%;
  animation: cover-shimmer 1.4s ease-in-out infinite;
}

/* 详情弹窗关闭按钮：悬浮在媒体区右上角，移动端也必然可见 */
.aimw-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 20;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(4px);
  cursor: pointer;
  transition: background-color 0.2s;
}

.aimw-close:hover {
  background: rgba(0, 0, 0, 0.78);
}

.cover-loading-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background-color: #a5b4fc;
  animation: cover-pulse 1s ease-in-out infinite;
}

@keyframes cover-shimmer {
  to {
    background-position-x: -200%;
  }
}

@keyframes cover-pulse {
  50% {
    transform: scale(1.35);
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cover-skeleton,
  .cover-loading-dot {
    animation: none;
  }
}
</style>

<!-- el-dialog 的根节点在 body 上，需要非 scoped 样式 -->
<style>
.aimw-dialog {
  --el-dialog-padding-primary: 0;
  border-radius: 16px;
  overflow: hidden;
}

.aimw-dialog .el-dialog__header {
  display: none;
}

.aimw-dialog .el-dialog__body {
  padding: 0;
}
</style>

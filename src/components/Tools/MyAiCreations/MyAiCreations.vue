<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import {
  fetchAiCreations,
  fetchAiCreationCategories,
  deleteAiCreationGroup,
  deleteAiCreationImage,
  type AiCreationGroup,
  type AiCreationImage,
  type AiCreationCategory,
} from '@/api/ai-creations'

const router = useRouter()

const info = reactive({ title: '我的 AI 创作' })

// 用 group_id（首选）或 prompt_id 作为列表里的查找 key
const groupKeyOf = (g: AiCreationGroup): string => {
  if (g.id != null) return `id:${g.id}`
  if (g.prompt_id) return `pid:${g.prompt_id}`
  return ''
}

// ============ 状态 ============
const loading = ref(false)
const groups = ref<AiCreationGroup[]>([])
const categories = ref<AiCreationCategory[]>([])

const activeCategory = ref<string>('')

const pagination = ref({
  total: 0,
  totalImages: 0,
  page: 1,
  pageSize: 12,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

// 已加载封面的组 id（淡入淡出控制）
const loadedCoverIds = reactive(new Set<number>())
const failedIds = reactive(new Set<number>())

// ============ 移动端检测 ============
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

// ============ 全屏 viewer（根级，teleported）============
const viewerVisible = ref(false)
const viewerList = ref<string[]>([])
const viewerIndex = ref(0)

const openViewer = (list: string[], index: number) => {
  if (!list || list.length === 0) return
  // 进入全屏 viewer 前先关闭组详情弹窗，避免两层 modal 重叠导致点击被遮挡
  closeGroupDetail()
  viewerList.value = list
  viewerIndex.value = Math.max(0, Math.min(index, list.length - 1))
  viewerVisible.value = true
}

const closeViewer = () => {
  // 同时清空列表，避免下次 openViewer 时数据残留导致组件复用异常
  viewerVisible.value = false
  viewerList.value = []
  viewerIndex.value = 0
}

// ============ 组详情弹窗 ============
const detailVisible = ref(false)
const selectedGroup = ref<AiCreationGroup | null>(null)
const selectedImageId = ref<number | null>(null)

const closeGroupDetail = () => {
  detailVisible.value = false
  selectedGroup.value = null
  selectedImageId.value = null
}

// 详情弹窗里点任意小图：直接在弹窗内切换主图
const setSelectedImage = (img: AiCreationImage) => {
  selectedImageId.value = img.id
}

// 详情弹窗里点主图 / 「全屏浏览」/ 组卡上的「查看 N 张图」按钮 → 进入 el-image-viewer
// group 可选：传了就用传入的组（组卡路径），不传则用 selectedGroup（详情弹窗路径）
const enterFullscreenViewer = (startIndex: number, group?: AiCreationGroup | null) => {
  const g = group ?? selectedGroup.value
  if (!g) return
  const list = g.images.map((i) => i.media_url)
  openViewer(list, startIndex)
}

const copyImageUrl = (url?: string | null) => {
  if (!url) return
  navigator.clipboard?.writeText(url)
  ElMessage.success('已复制链接')
}

// ============ 删除 ============
// 列表局部状态：保存每行是否在删除中（避免重复点击）
const deletingGroupIds = reactive(new Set<number>())
const deletingImageIds = reactive(new Set<number>())

/** 整组删除：先 confirm → 调 API → 刷新列表 + 关闭详情弹窗 */
const handleDeleteGroup = async (g: AiCreationGroup) => {
  if (!g || deletingGroupIds.has(g.id)) return
  try {
    await ElMessageBox.confirm(
      `确定要删除该组及其下全部 ${g.image_count} 张图吗？该操作将同时删除 R2 存储中的对象，无法撤销。`,
      '删除整组',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch {
    return // 用户取消
  }
  deletingGroupIds.add(g.id)
  try {
    const res = await deleteAiCreationGroup(g.id)
    // 从列表里移除
    const idx = groups.value.findIndex((x) => groupKeyOf(x) === groupKeyOf(g))
    if (idx >= 0) groups.value.splice(idx, 1)
    pagination.value.total = Math.max(0, pagination.value.total - 1)
    pagination.value.totalImages = Math.max(0, pagination.value.totalImages - (res.images || 0))
    ElMessage.success(`已删除（清理 R2 ${res.r2_deleted}/${res.images}）`)
    // 关弹窗
    if (selectedGroup.value && selectedGroup.value.id === g.id) {
      closeGroupDetail()
    }
    // 列表为空时再拉一次刷新
    if (groups.value.length === 0 && pagination.value.hasNext) {
      loadGroups()
    }
  } catch (e: any) {
    console.error('[my-ai-creations] delete group error:', e)
    ElMessage.error(e?.response?.data?.error || e?.message || '删除失败')
  } finally {
    deletingGroupIds.delete(g.id)
  }
}

/** 单图删除：先 confirm → 调 API → 列表里移除该图 */
const handleDeleteImage = async (img: AiCreationImage, parentGroup?: AiCreationGroup) => {
  if (!img || deletingImageIds.has(img.id)) return
  try {
    await ElMessageBox.confirm(
      '确定删除这张图吗？该操作将删除 R2 存储中的对象，无法撤销。',
      '删除图片',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch {
    return
  }
  deletingImageIds.add(img.id)
  try {
    await deleteAiCreationImage(img.id)
    ElMessage.success('已删除')
    pagination.value.totalImages = Math.max(0, pagination.value.totalImages - 1)
    // 详情弹窗打开时，弹窗内的 images 也要更新
    if (parentGroup) {
      parentGroup.images = parentGroup.images.filter((i) => i.id !== img.id)
      parentGroup.image_count = parentGroup.images.length
      if (parentGroup.cover && parentGroup.cover.id === img.id) {
        parentGroup.cover =
          parentGroup.images.length > 0
            ? {
                id: parentGroup.images[0].id,
                media_url: parentGroup.images[0].media_url,
                thumbnail_url: parentGroup.images[0].thumbnail_url,
              }
            : null
      }
      if (selectedImageId.value === img.id) {
        selectedImageId.value =
          parentGroup.images.length > 0 ? parentGroup.images[0].id : null
      }
      // 整组都被删空时自动关弹窗
      if (parentGroup.images.length === 0) {
        closeGroupDetail()
        // 同步从主列表里移除该组（孤儿空组）
        const idx = groups.value.findIndex((x) => groupKeyOf(x) === groupKeyOf(parentGroup))
        if (idx >= 0) groups.value.splice(idx, 1)
        pagination.value.total = Math.max(0, pagination.value.total - 1)
      }
    }
  } catch (e: any) {
    console.error('[my-ai-creations] delete image error:', e)
    ElMessage.error(e?.response?.data?.error || e?.message || '删除失败')
  } finally {
    deletingImageIds.delete(img.id)
  }
}

// 详情弹窗里根据 selectedImageId 找到当前主图
const selectedImage = computed(() => {
  if (!selectedGroup.value || selectedImageId.value == null) return null
  return (
    selectedGroup.value.images.find((i) => i.id === selectedImageId.value) ||
    selectedGroup.value.images[0] ||
    null
  )
})

watch(detailVisible, (v) => {
  if (typeof window.document === 'undefined') return
  window.document.body.style.overflow = v ? 'hidden' : ''
})

// ============ 列表加载 ============
const loadCategories = async () => {
  try {
    categories.value = await fetchAiCreationCategories()
  } catch {
    /* 静默 */
  }
}

const loadGroups = async () => {
  loading.value = true
  try {
    const result = await fetchAiCreations({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      category: activeCategory.value || undefined,
    })
    loadedCoverIds.clear()
    failedIds.clear()
    groups.value = result.groups
    pagination.value = result.pagination
  } catch (e: any) {
    console.error('load ai-creations fail', e)
    if (e?.response?.status === 401) {
      ElMessage.warning('请先登录')
    }
  } finally {
    loading.value = false
  }
}

const handleCategoryChange = (name: string) => {
  activeCategory.value = name
  pagination.value.page = 1
  loadGroups()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  loadGroups()
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

const markCoverLoaded = (id: number) => loadedCoverIds.add(id)
const markFailed = (id: number) => {
  failedIds.add(id)
  markCoverLoaded(id)
}

// 描述（prompt 正文）：只取 prompt 内容；不 fallback 到 title，避免与标题重复。
const groupPromptText = (g: AiCreationGroup) =>
  g.prompt?.content || g.images[0]?.prompt || ''

const groupTitle = (g: AiCreationGroup) =>
  g.title || g.prompt?.title || `任务 #${g.id}`

const onImageError = (e: Event, id: number) => {
  const img = e.target as HTMLImageElement
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  markFailed(id)
  img.src =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f3f4f6"/><text x="200" y="155" font-size="18" fill="#9ca3af" text-anchor="middle" font-family="sans-serif">图片加载失败</text></svg>',
    )
}

const currentCategoryName = computed(() => {
  if (!activeCategory.value) return '全部分类'
  const c = categories.value.find((c) => c.name === activeCategory.value)
  return c ? c.name : activeCategory.value
})

// 跳转到 /ai-image-edit/ 任务入口
const goCreate = () => {
  router.push('/ai-image-edit/')
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  loadCategories()
  loadGroups()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
  if (typeof window.document !== 'undefined') {
    window.document.body.style.overflow = ''
  }
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <!-- 顶部说明卡 -->
    <div class="px-4">
      <div class="rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-4 border border-indigo-100">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-2xl">🖼️</span>
          <h2 class="text-base font-semibold text-gray-800">我的 AI 创作素材</h2>
        </div>
        <p class="text-sm text-gray-600 leading-relaxed">
          仅展示当前登录用户在 AI 工具中生成的图片素材，按提示词任务分组浏览。
          点击任意图片可全屏查看与切换。
        </p>
        <button
          type="button"
          class="mt-3 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 transition-all"
          @click="goCreate"
        >
          去 AI 图片编辑 →
        </button>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div v-if="categories.length > 0" class="px-4 mt-3">
      <div class="rounded-2xl bg-white p-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm text-gray-500">分类</span>
          <span class="text-xs text-gray-400">当前：{{ currentCategoryName }}</span>
          <span class="ml-auto text-xs text-gray-400">
            共 {{ pagination.total }} 个任务 · {{ pagination.totalImages }} 张图
          </span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1 rounded-full text-xs transition-all"
            :class="!activeCategory ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="handleCategoryChange('')"
          >
            全部
          </button>
          <button
            v-for="c in categories"
            :key="c.name"
            class="px-3 py-1 rounded-full text-xs transition-all"
            :class="activeCategory === c.name ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="handleCategoryChange(c.name)"
          >
            {{ c.name }}
            <span class="opacity-60 ml-1">{{ c.count }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 组列表 -->
    <div class="px-4 mt-3">
      <div v-loading="loading" class="rounded-2xl bg-white p-4">
        <div v-if="groups.length === 0 && !loading" class="py-16 text-center text-gray-400">
          <div class="text-5xl mb-2">📭</div>
          <p class="mb-3">还没有任何记录</p>
          <button
            type="button"
            class="text-sm px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 transition-all"
            @click="goCreate"
          >
            去 AI 图片编辑生成一张
          </button>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="g in groups"
            :key="g.id"
            class="rounded-xl overflow-hidden border border-gray-100 hover:border-indigo-300 hover:shadow-lg transition-all bg-white"
          >
            <!-- 缩略图区：1 大 + 堆叠小图 -->
            <div
              v-if="g.cover"
              class="relative aspect-video bg-gray-100 overflow-hidden cursor-pointer"
              @click="openViewer(g.images.map(i => i.media_url), 0)"
            >
              <img
                :src="g.cover.thumbnail_url || g.cover.media_url"
                :alt="groupPromptText(g)"
                loading="lazy"
                class="w-full h-full object-cover transition-opacity duration-300"
                :class="loadedCoverIds.has(g.cover.id) ? 'opacity-100' : 'opacity-0'"
                @load="markCoverLoaded(g.cover.id)"
                @error="onImageError($event, g.cover.id)"
                @click.stop="openViewer(g.images.map(i => i.media_url), 0)"
              />

              <!-- 加载骨架 -->
              <div
                v-if="!loadedCoverIds.has(g.cover.id)"
                class="cover-skeleton absolute inset-0 flex items-center justify-center pointer-events-none"
                aria-hidden="true"
              >
                <span class="cover-loading-dot"></span>
                <span class="ml-2 text-xs font-medium text-gray-400">封面加载中</span>
              </div>

              <!-- 右上角：图片数徽标 -->
              <div class="absolute top-2 right-2 flex flex-col items-end gap-1">
                <span
                  v-if="g.image_count > 1"
                  class="bg-black/60 text-white text-xs px-1.5 py-0.5 rounded backdrop-blur"
                >
                  🖼 {{ g.image_count }} 张
                </span>
              </div>

              <!-- 右下角：剩余图缩略图堆叠 -->
              <div
                v-if="g.image_count > 1"
                class="absolute bottom-2 right-2 flex items-center -space-x-3"
                @click.stop
              >
                <button
                  v-for="(img, idx) in g.images.slice(1, 4)"
                  :key="img.id"
                  type="button"
                  class="mac-thumb-pile block w-10 h-10 rounded-md overflow-hidden border-2 border-white shadow ring-1 ring-black/10 transition-transform hover:scale-110 active:scale-95"
                  :title="`第 ${idx + 2} 张`"
                  @click.stop="openViewer(g.images.map(i => i.media_url), idx + 1)"
                >
                  <img
                    :src="img.thumbnail_url || img.media_url"
                    :alt="`${idx + 2}`"
                    loading="lazy"
                    class="w-full h-full object-cover"
                    @error="onImageError($event, img.id)"
                  />
                </button>
                <button
                  v-if="g.image_count > 4"
                  type="button"
                  class="mac-thumb-more w-10 h-10 rounded-md border-2 border-white shadow ring-1 ring-black/10 bg-black/65 text-white text-xs font-semibold flex items-center justify-center active:scale-95"
                  :title="`还有 ${g.image_count - 4} 张`"
                  @click.stop="enterFullscreenViewer(4)"
                >
                  +{{ g.image_count - 4 }}
                </button>
              </div>
            </div>

            <!-- 正文区 -->
            <div class="p-3">
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <span class="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 truncate">
                  {{ g.category || '未分类' }}
                </span>
                <span class="text-[11px] text-gray-400 shrink-0">{{ formatTime(g.created_at) }}</span>
              </div>
              <h3
                class="text-sm font-semibold text-gray-800 truncate"
                :title="groupTitle(g)"
              >
                {{ groupTitle(g) }}
              </h3>
              <!-- 描述行：当 prompt 正文与标题完全一致时省略，避免视觉重复 -->
              <p
                v-if="groupPromptText(g) && groupPromptText(g).trim() !== groupTitle(g).trim()"
                class="text-xs text-gray-600 mt-1 line-clamp-3 leading-snug"
                :title="groupPromptText(g)"
              >
                {{ groupPromptText(g) }}
              </p>
              <div class="flex items-center justify-between mt-2">
                <span v-if="g.model_name" class="text-[11px] text-indigo-500 truncate max-w-[60%]">
                  {{ g.model_name }}
                </span>
                <button
                  type="button"
                  class="ml-auto text-xs px-2.5 py-1 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 transition-all"
                  @click="enterFullscreenViewer(0, g)"
                >
                  查看 {{ g.image_count }} 张图 →
                </button>
                <button
                  type="button"
                  class="mac-card-del text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-50 border border-red-200 hover:border-red-400 transition-all"
                  :disabled="deletingGroupIds.has(g.id)"
                  :title="`删除该组（含 ${g.image_count} 张图）`"
                  @click="handleDeleteGroup(g)"
                >
                  {{ deletingGroupIds.has(g.id) ? '删除中…' : '删除' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
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

    <!-- 组详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :show-close="false"
      width="min(720px, 92vw)"
      align-center
      destroy-on-close
      class="mac-dialog !p-0"
      @close="closeGroupDetail"
    >
      <div
        v-if="selectedGroup"
        class="relative flex flex-col md:flex-row h-[82vh] md:h-[86vh] overflow-hidden"
      >
        <!-- 关闭按钮 -->
        <button type="button" class="mac-close" aria-label="关闭" @click="closeGroupDetail">
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

        <!-- 左侧大图 -->
        <div class="md:flex-1 bg-black flex items-center justify-center shrink-0 relative min-h-[40vh]">
          <img
            v-if="selectedImage"
            :src="selectedImage.media_url"
            :alt="groupPromptText(selectedGroup)"
            class="max-w-full max-h-[40vh] md:max-h-[86vh] object-contain cursor-zoom-in"
            @click="enterFullscreenViewer(selectedGroup.images.findIndex(i => i.id === selectedImage?.id))"
            @error="onImageError($event, selectedImage.id)"
          />
          <div v-else class="text-white/70 text-sm">无可显示的图片</div>
        </div>

        <!-- 右侧信息 -->
        <div class="md:w-80 shrink-0 bg-white flex-1 min-h-0 flex flex-col">
          <div class="flex-1 min-h-0 overflow-y-auto p-5">
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <el-tag size="small" type="primary" effect="plain">
                {{ selectedGroup.category || '未分类' }}
              </el-tag>
              <el-tag size="small" type="success" effect="plain">
                🖼 {{ selectedGroup.image_count }} 张
              </el-tag>
              <el-tag v-if="selectedGroup.scene" size="small" type="info" effect="plain">
                {{ selectedGroup.scene }}
              </el-tag>
            </div>

            <h3 class="text-sm font-semibold text-gray-800 mb-2">
              {{ groupTitle(selectedGroup) }}
            </h3>
            <!-- 描述：与标题完全一致时省略，避免视觉重复 -->
            <div
              v-if="groupPromptText(selectedGroup) && groupPromptText(selectedGroup).trim() !== groupTitle(selectedGroup).trim()"
              class="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 mb-4 whitespace-pre-wrap break-words"
            >
              {{ groupPromptText(selectedGroup) }}
            </div>

            <!-- 组内小图网格 -->
            <h4 class="text-xs font-semibold text-gray-500 mb-2">组内图片</h4>
            <div class="grid grid-cols-4 gap-2 mb-4">
              <div
                v-for="(img, idx) in selectedGroup.images"
                :key="img.id"
                class="relative group/thumb"
              >
                <button
                  type="button"
                  class="aspect-square w-full rounded overflow-hidden border-2 transition-all"
                  :class="img.id === selectedImageId ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-100 hover:border-indigo-300'"
                  :title="`第 ${idx + 1} 张`"
                  @click="setSelectedImage(img)"
                >
                  <img
                    :src="img.thumbnail_url || img.media_url"
                    :alt="`${idx + 1}`"
                    loading="lazy"
                    class="w-full h-full object-cover"
                    @error="onImageError($event, img.id)"
                  />
                </button>
                <!-- 单图删除小 X -->
                <button
                  type="button"
                  class="mac-img-del absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/65 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-500"
                  :disabled="deletingImageIds.has(img.id)"
                  :title="`删除第 ${idx + 1} 张`"
                  @click.stop="handleDeleteImage(img, selectedGroup ?? undefined)"
                >
                  ×
                </button>
              </div>
            </div>

            <el-descriptions :column="1" border size="small" class="mb-2">
              <el-descriptions-item v-if="selectedGroup.model_name" label="模型">
                {{ selectedGroup.model_name }}
              </el-descriptions-item>
              <el-descriptions-item label="分类">
                {{ selectedGroup.category || '未分类' }}
              </el-descriptions-item>
              <el-descriptions-item label="图片数">
                {{ selectedGroup.image_count }}
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ formatTime(selectedGroup.created_at) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 固定操作栏 -->
          <div class="shrink-0 border-t border-gray-100 p-5 bg-white">
            <div class="flex gap-2">
              <el-button
                type="primary"
                size="small"
                class="!flex-1"
                @click="enterFullscreenViewer(0)"
              >
                全屏浏览
              </el-button>
              <el-button
                v-if="selectedImage"
                size="small"
                class="!flex-1"
                @click="copyImageUrl(selectedImage.media_url)"
              >
                复制链接
              </el-button>
            </div>
            <el-button
              type="danger"
              plain
              size="small"
              class="!w-full !ml-0 mt-2"
              :disabled="deletingGroupIds.has(selectedGroup.id)"
              @click="handleDeleteGroup(selectedGroup)"
            >
              {{ deletingGroupIds.has(selectedGroup.id) ? '删除中…' : `删除该组（${selectedGroup.image_count} 张）` }}
            </el-button>
            <el-button class="!w-full !ml-0 mt-2 md:!hidden" size="small" @click="closeGroupDetail">
              关闭
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 全屏图片浏览（el-image-viewer，挂在根，teleported 避免被 dialog 遮挡） -->
    <el-image-viewer
      v-if="viewerList.length > 0"
      :url-list="viewerList"
      :initial-index="viewerIndex"
      teleported
      :z-index="9999"
      hide-on-click-modal
      :close-on-press-escape="true"
      @close="closeViewer"
    />

    <ToolDetail title="关于">
      <el-text>
        本页面仅展示当前登录用户自己在 AI 工具中生成的图片素材，按提示词任务分组。
        数据保存在 Cloudflare D1 中，严格按用户隔离，跨用户完全不可见。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cover-skeleton {
  background: linear-gradient(110deg, #f3f4f6 25%, #e5e7eb 42%, #f3f4f6 58%);
  background-size: 200% 100%;
  animation: cover-shimmer 1.4s ease-in-out infinite;
}

.mac-close {
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
.mac-close:hover {
  background: rgba(0, 0, 0, 0.78);
}

.mac-thumb-pile {
  background: #f3f4f6;
}
.mac-thumb-more {
  cursor: pointer;
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

/* 移动端：堆叠缩略图更紧凑 */
@media (max-width: 640px) {
  .mac-thumb-pile,
  .mac-thumb-more {
    width: 2.25rem;
    height: 2.25rem;
  }
}
</style>

<!-- el-dialog / el-image-viewer 挂在 body，需要非 scoped 样式 -->
<style>
.mac-dialog {
  --el-dialog-padding-primary: 0;
  border-radius: 16px;
  overflow: hidden;
}
.mac-dialog .el-dialog__header {
  display: none;
}
.mac-dialog .el-dialog__body {
  padding: 0;
}
</style>
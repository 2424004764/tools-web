<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import {
  fetchAiCreations,
  fetchAiCreationCategories,
  deleteAiCreationGroup,
  deleteAiCreationImage,
  fetchImageClaims,
  unclaimImage,
  unclaimByImage,
  unclaimByImages,
  type AiCreationGroup,
  type AiCreationImage,
  type AiCreationCategory,
} from '@/api/ai-creations'
import ClaimDialog from './ClaimDialog.vue'

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

// ============ 认领记录 ============
// claimsByImageId：image_id → 已认领的平台名数组（仅当前列表可见的图）
// 拉取策略：loadGroups 完后批量拉一次当前页所有 image 的 claims，避免每张图单独请求。
// 删除图时调用 unclaimByImage 清理远端 + 本地缓存；列表里没有的图不进缓存。
const claimsByImageId = reactive(new Map<number, string[]>())
const claimsLoading = ref(false)

// 当前正在被认领的图（ClaimDialog 接收 props.currentClaims 用）
const claimDialogImageId = ref<number | null>(null)
const claimDialogRef = ref<InstanceType<typeof ClaimDialog> | null>(null)
const userStore = useUserStore()

/** 把当前列表里所有 image 的 id 拍平，调一次批量接口 */
const loadClaimsForCurrentList = async () => {
  if (!userStore.getLoginStatus) return
  const allIds: number[] = []
  for (const g of groups.value) {
    for (const img of g.images) allIds.push(img.id)
  }
  if (allIds.length === 0) return
  claimsLoading.value = true
  try {
    const claims = await fetchImageClaims(allIds)
    // 清掉本次不在 allIds 里的旧 key（其它列表/旧页面残留）
    const allowed = new Set(allIds)
    for (const k of Array.from(claimsByImageId.keys())) {
      if (!allowed.has(k)) claimsByImageId.delete(k)
    }
    for (const c of claims) {
      const list = claimsByImageId.get(c.image_id) || []
      if (!list.includes(c.platform)) list.push(c.platform)
      claimsByImageId.set(c.image_id, list)
    }
  } catch (err) {
    console.warn('[my-ai-creations] load claims failed', err)
  } finally {
    claimsLoading.value = false
  }
}

/** 认领弹窗提交后由 @saved 回调，同步本地缓存（无需再发请求拉一次） */
const updateLocalClaims = (imageId: number, claims: string[]) => {
  if (claims.length === 0) claimsByImageId.delete(imageId)
  else claimsByImageId.set(imageId, claims)
}

/** 打开认领弹窗：从列表卡片/详情/画廊 三处调用 */
const openClaimDialog = (img: AiCreationImage) => {
  claimDialogImageId.value = img.id
  // 等 nextTick 让 props 同步好再 open
  nextTick(() => claimDialogRef.value?.open())
}

/**
 * 用 cover 拼一个最小可用的 AiCreationImage 给 openClaimDialog 用（列表卡片上只有 cover）。
 * cover 来自后端 JOIN，少了 prompt / width / height 等字段，认领弹窗只用 id，其他字段无所谓。
 */
const coverAsImage = (cover: NonNullable<AiCreationGroup['cover']>): AiCreationImage => ({
  id: cover.id,
  media_url: cover.media_url,
  thumbnail_url: cover.thumbnail_url,
  prompt: '',
  width: null,
  height: null,
  created_at: '',
})

const claimsOf = (imageId: number): string[] => claimsByImageId.get(imageId) || []

/** 详情弹窗内 tag 上的 × 一键取消认领：不用打开弹窗 */
const cancelOneClaim = async (imageId: number, platform: string) => {
  try {
    await unclaimImage(imageId, platform)
    updateLocalClaims(
      imageId,
      claimsOf(imageId).filter((p) => p !== platform),
    )
  } catch {
    ElMessage.error('取消认领失败')
  }
}

/** 当前画廊里所有图的所有 claim 平台去重并集（按出现顺序），
 *  给画廊顶部信息条用：一眼看出整组共认领了哪些平台。 */
const galleryClaimPlatforms = computed<string[]>(() => {
  const seen = new Set<string>()
  const list: string[] = []
  for (const img of galleryImages.value) {
    for (const p of claimsOf(img.id)) {
      if (!seen.has(p)) {
        seen.add(p)
        list.push(p)
      }
    }
  }
  return list
})

const galleryClaimTotalCount = computed(() => galleryClaimPlatforms.value.length)

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

// ============ 画廊弹窗：单组多图横向展示 ============
// 跟全屏 viewer 不一样：viewer 是「一张图独占屏幕 + 翻页」，
// 这里是「所有图按响应式网格一屏展示」。点缩略图再切到全屏 viewer 看大图。
// 列数根据容器宽度走 grid-cols-... 响应式 class，无需 JS 计算。
const galleryVisible = ref(false)
const galleryGroup = ref<AiCreationGroup | null>(null)
const galleryImages = ref<AiCreationImage[]>([])

const openGallery = (g: AiCreationGroup) => {
  if (!g || g.images.length === 0) return
  // 单图：跳过画廊弹窗直接进全屏 viewer，省一次弹窗切换；多图才走画廊网格
  if (g.images.length === 1) {
    openViewer(g.images.map((i) => i.media_url), 0)
    return
  }
  galleryGroup.value = g
  galleryImages.value = g.images
  galleryVisible.value = true
}

const closeGallery = () => {
  galleryVisible.value = false
  galleryGroup.value = null
  galleryImages.value = []
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

// ============ 跳转到「图片切割」工具 ============
// 用 media_url 当 url query 拼到 /imgcut/，ImgCut 会用它当源图加载。
// AiCreationImage 没有 recordId（不像 /ai-image-edit/ 那样的生成记录），
// 只能靠 url 直接传，url 不能太长否则 window.open 静默失败。
const openInImgCut = (img: AiCreationImage) => {
  if (!img?.media_url) return
  const url = img.media_url
  const isShortHttpUrl = /^https?:\/\//i.test(url) && url.length <= 4000
  if (!isShortHttpUrl) {
    ElMessage.warning('该图片 URL 过长，无法直接跳转，请用「复制链接」手动处理')
    return
  }
  const params = new URLSearchParams({ url })
  const target = router.resolve({
    path: '/imgcut/',
    query: Object.fromEntries(params.entries()),
  }).href
  window.open(target, '_blank', 'noopener,noreferrer')
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
    // 同步清理该组所有图的认领记录（一次 SQL 删干净）+ 本地缓存
    const imageIds = g.images.map((i) => i.id)
    if (imageIds.length > 0) {
      void unclaimByImages(imageIds).catch((e) =>
        console.warn('[my-ai-creations] cleanup claims failed for group', g.id, e),
      )
      for (const id of imageIds) claimsByImageId.delete(id)
    }
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
    // 同时清理该图的认领记录（用户要求：删图直接删认领，不走外键）
    // 用 Promise.allSettled 不阻塞流程：清理失败不影响主流程
    void unclaimByImage(img.id).catch((e) =>
      console.warn('[my-ai-creations] cleanup claims failed for', img.id, e),
    )
    // 本地缓存也清掉，避免「图已删但认领 tag 还显示」不一致
    claimsByImageId.delete(img.id)
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
      // 画廊弹窗打开时：同步移除快照里的该图。
      // galleryImages 是打开时的引用快照，不跟着 parentGroup.images 联动，必须手动 splice。
      if (galleryVisible.value && galleryGroup.value === parentGroup) {
        galleryImages.value = galleryImages.value.filter((i) => i.id !== img.id)
        // 整组都删完了：关闭画廊弹窗，避免出现「空画廊」尴尬态
        if (galleryImages.value.length === 0) {
          closeGallery()
        }
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
    // 列表更新后批量拉当前页所有图的认领记录（认领数据量小，单次请求覆盖整页）
    await loadClaimsForCurrentList()
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
            class="rounded-xl overflow-hidden border border-gray-100 hover:border-indigo-300 hover:shadow-lg transition-all bg-white relative"
            :class="{ 'is-deleting-group': deletingGroupIds.has(g.id) }"
          >
            <!-- 缩略图区：1 大 + 堆叠小图。点击封面进画廊弹窗，看所有图；
     想看单张大图可在画廊内点击进入全屏 viewer。 -->
            <div
              v-if="g.cover"
              class="relative aspect-video bg-gray-100 overflow-hidden cursor-pointer"
              @click="openGallery(g)"
            >
              <img
                :src="g.cover.thumbnail_url || g.cover.media_url"
                :alt="groupPromptText(g)"
                loading="lazy"
                class="w-full h-full object-cover transition-opacity duration-300"
                :class="loadedCoverIds.has(g.cover.id) ? 'opacity-100' : 'opacity-0'"
                @load="markCoverLoaded(g.cover.id)"
                @error="onImageError($event, g.cover.id)"
                @click.stop="openGallery(g)"
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

              <!-- 左上角：认领平台 tag 列表（已认领的图显示在最显眼位置）
                   - 背景半透明黑 + 白字 + backdrop-blur，跟右上角「4 张」徽标视觉一致
                   - 多 tag 时 flex-wrap 自动换行，不会溢出卡片
                   - 已认领 N=0 时整段不渲染（不占视觉空间） -->
              <div
                v-if="g.cover && claimsOf(g.cover.id).length > 0"
                class="absolute top-2 left-2 flex flex-wrap items-center gap-1 max-w-[calc(100%-1rem)]"
              >
                <span
                  v-for="p in claimsOf(g.cover.id)"
                  :key="p"
                  class="bg-blue-600/85 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur font-medium shadow-sm"
                  :title="`已认领平台：${p}`"
                >
                  🏷 {{ p }}
                </span>
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
              <div class="flex items-center justify-between mt-2 gap-2 flex-wrap">
                <span v-if="g.model_name" class="text-[11px] text-indigo-500 truncate max-w-[40%]">
                  {{ g.model_name }}
                </span>
                <!-- 列表认领：按封面图（单图=该图）打开认领弹窗。
                     多图卡片只能对封面图认领，要认领其它张需进画廊 -->
                <button
                  v-if="g.cover"
                  type="button"
                  :class="[
                    'ml-auto text-xs px-2 py-1 rounded-md transition-all flex items-center gap-1',
                    claimsOf(g.cover.id).length > 0
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                      : 'border border-blue-200 text-blue-600 hover:bg-blue-50',
                  ]"
                  :title="claimsOf(g.cover.id).length > 0
                    ? `已认领：${claimsOf(g.cover.id).join('、')}`
                    : '标记这张图已发布到哪些平台'"
                  @click="openClaimDialog(coverAsImage(g.cover))"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  认领<span v-if="claimsOf(g.cover.id).length > 0"> ({{ claimsOf(g.cover.id).length }})</span>
                </button>
                <button
                  type="button"
                  class="text-xs px-2.5 py-1 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 transition-all"
                  @click="openGallery(g)"
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
            <!-- 删除中遮罩：覆盖整张卡片，半透明白 + 居中 spinner + 文字 -->
            <div v-if="deletingGroupIds.has(g.id)" class="mac-del-overlay" role="status" aria-live="polite">
              <div class="mac-del-spinner" aria-hidden="true"></div>
              <span class="text-xs font-medium text-gray-700 mt-2">正在删除…</span>
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

            <!-- 当前主图的「已认领平台」标签：selectedImage 变化实时跟随。
                 每个 tag 有 hover-× 一键取消认领（不用打开弹窗）。 -->
            <div
              v-if="selectedImage"
              class="flex flex-wrap items-center gap-1.5 mb-3"
            >
              <span class="text-xs text-gray-500 mr-0.5">已认领：</span>
              <span
                v-for="p in claimsOf(selectedImage.id)"
                :key="p"
                class="mac-claim-tag inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs cursor-pointer hover:bg-blue-200 transition-colors"
                :title="`点击取消认领「${p}」`"
                role="button"
                tabindex="0"
                @click="cancelOneClaim(selectedImage.id, p)"
                @keyup.enter="cancelOneClaim(selectedImage.id, p)"
              >
                {{ p }}
                <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
              <button
                v-if="claimsOf(selectedImage.id).length === 0"
                type="button"
                class="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                @click="openClaimDialog(selectedImage)"
              >
                + 标记已发布的平台
              </button>
            </div>
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
              <!-- 发送至「图片切割」：跟画廊里的 hover 入口功能一致，
                   这里放在详情面板让用户在不打开画廊时也能一键跳转 -->
              <el-button
                v-if="selectedImage"
                size="small"
                type="primary"
                plain
                class="!flex-1"
                :title="`把当前大图发送到「图片切割」工具`"
                @click="openInImgCut(selectedImage)"
              >
                <span class="inline-flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121M12 12l2.879-2.879M12 12L9.121 14.879M21 3v6h-6M3 21v-6h6" />
                  </svg>
                  发送至分割
                </span>
              </el-button>
              <!-- 认领：详情弹窗内的当前主图认领，按钮文字带 N 显示。
                   跟列表卡片 / 画廊入口语义一致，都走 ClaimDialog。 -->
              <el-button
                v-if="selectedImage"
                size="small"
                :type="claimsOf(selectedImage.id).length > 0 ? 'primary' : 'default'"
                :plain="claimsOf(selectedImage.id).length === 0"
                class="!flex-1"
                :title="claimsOf(selectedImage.id).length > 0 ? `已认领：${claimsOf(selectedImage.id).join('、')}` : '标记这张图已发布到哪些平台'"
                @click="openClaimDialog(selectedImage)"
              >
                <span class="inline-flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  认领<span v-if="claimsOf(selectedImage.id).length > 0"> ({{ claimsOf(selectedImage.id).length }})</span>
                </span>
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

    <!-- ============ 画廊弹窗：单组多图网格展示 ============
         列数由 Tailwind 响应式 class 决定：
           - 移动端（< 640px）：grid-cols-2
           - 平板（sm ≥ 640px）：grid-cols-3
           - 桌面（lg ≥ 1024px）：grid-cols-4
           - 大屏（xl ≥ 1280px）：grid-cols-5
         不需要 JS 测宽度，浏览器按视口宽度自动折行。
         点画廊里的缩略图 → 切到 el-image-viewer 看大图（带左右切换）。 -->
    <el-dialog
      v-model="galleryVisible"
      :show-close="false"
      width="min(1080px, 96vw)"
      align-center
      destroy-on-close
      class="mac-dialog !p-0"
      @close="closeGallery"
    >
      <div v-if="galleryGroup" class="flex flex-col max-h-[88vh] overflow-hidden">
        <!-- 关闭按钮 -->
        <button type="button" class="mac-close" aria-label="关闭" @click="closeGallery">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
          </svg>
        </button>

        <!-- 头部信息条 -->
        <header class="px-5 py-4 border-b border-gray-100">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
            <el-tag size="small" type="primary" effect="plain">{{ galleryGroup.category || '未分类' }}</el-tag>
            <el-tag size="small" type="success" effect="plain">🖼 {{ galleryImages.length }} 张</el-tag>
            <el-tag v-if="galleryGroup.scene" size="small" type="info" effect="plain">{{ galleryGroup.scene }}</el-tag>
            <!-- 整组的认领统计：聚合所有图的所有平台去重后的数量。
                 0 时整段不渲染，不打扰未认领的组。 -->
            <el-tag
              v-if="galleryClaimTotalCount > 0"
              size="small"
              effect="plain"
              class="!border-blue-300 !text-blue-700 !bg-blue-50"
              :title="`该组所有图共认领 ${galleryClaimTotalCount} 个平台 · ${galleryClaimPlatforms.join('、')}`"
            >
              🏷 已认领 {{ galleryClaimTotalCount }} 个平台
            </el-tag>
          </div>
          <h3 class="text-base font-semibold text-gray-800">{{ groupTitle(galleryGroup) }}</h3>
        </header>

        <!-- 图片网格：flex 流式布局 + 高度基准反算宽度。
             grid + 1fr 等分列会把 2:1 这类宽图强行压成正方形 → 中间一条。
             这里用 flex + height: 9rem 固定基准，宽度由 aspect-ratio 反算：
               - 2:1 横图 → ~18rem × 9rem（铺得开）
               - 9:16 竖图 → ~5rem × 9rem（自然变窄）
               - 1:1 方图 → 9rem × 9rem
             object-contain 保证不裁剪，原图完整显示。
             min-width: 5rem + max-width: 20rem 防止极窄/极宽图撑爆布局。 -->
        <div class="flex-1 min-h-0 overflow-y-auto p-4">
          <div class="flex flex-wrap gap-3 items-start">
            <figure
              v-for="(img, idx) in galleryImages"
              :key="img.id"
              :style="img.width && img.height ? { aspectRatio: `${img.width} / ${img.height}` } : undefined"
              :class="[
                'group/img relative h-36 w-auto min-w-[5rem] max-w-[20rem] flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border transition-colors cursor-zoom-in',
                deletingImageIds.has(img.id)
                  ? 'border-gray-300 opacity-60 pointer-events-none'
                  : claimsOf(img.id).length > 0
                    ? 'border-blue-400 ring-1 ring-blue-200/60'
                    : 'border-gray-200 hover:border-indigo-400 active:border-indigo-500',
              ]"
              :title="`第 ${idx + 1} 张，点击看大图`"
              @click="enterFullscreenViewer(idx, galleryGroup)"
              role="button"
              tabindex="0"
              @keyup.enter="enterFullscreenViewer(idx, galleryGroup)"
            >
              <img
                :src="img.thumbnail_url || img.media_url"
                :alt="`${groupTitle(galleryGroup)} - 第 ${idx + 1} 张`"
                loading="lazy"
                class="w-full h-full object-contain group-hover/img:scale-105 transition-transform duration-200"
                @error="onImageError($event, img.id)"
              />
              <!-- 角标：第几张 / 共几张 -->
              <span class="absolute top-1.5 left-1.5 bg-black/55 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur pointer-events-none">
                {{ idx + 1 }}/{{ galleryImages.length }}
              </span>
              <!-- 认领按钮：左下角，跟 i/N 角标错开避免重叠。
                   跟其它 hover 按钮一样：触屏上 @media (hover: none) 让按钮始终可见。
                   状态显示：未认领灰色描边 + 「认领」；已认领蓝色填充 + 「认领(N)」。 -->
              <button
                type="button"
                :class="[
                  'mac-img-claim absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium backdrop-blur transition-opacity inline-flex items-center gap-1',
                  claimsOf(img.id).length > 0
                    ? 'bg-blue-600/90 text-white hover:bg-blue-700'
                    : 'bg-white/85 text-blue-700 border border-blue-300 hover:bg-blue-50',
                  'opacity-0 group-hover/img:opacity-100',
                ]"
                :title="claimsOf(img.id).length > 0
                  ? `已认领：${claimsOf(img.id).join('、')}`
                  : `标记第 ${idx + 1} 张已发布到哪些平台`"
                :aria-label="`认领第 ${idx + 1} 张`"
                @click.stop="openClaimDialog(img)"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>认领<span v-if="claimsOf(img.id).length > 0"> ({{ claimsOf(img.id).length }})</span></span>
              </button>
              <!-- 发送至「图片切割」按钮：右上角，hover 才显示，不挡主点击（看大图） -->
              <button
                type="button"
                class="mac-img-split absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-indigo-600/90 text-white text-[10px] font-medium backdrop-blur opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-indigo-700 inline-flex items-center gap-1"
                :title="`把第 ${idx + 1} 张发送到「图片切割」工具`"
                aria-label="发送至图片切割"
                @click.stop="openInImgCut(img)"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121M12 12l2.879-2.879M12 12L9.121 14.879M21 3v6h-6M3 21v-6h6" />
                </svg>
                <span>分割</span>
              </button>
              <!-- 删除按钮：右下角，跟右上「分割」错开避免冲突。
                   复用 handleDeleteImage：弹 confirm → 调 API → 后端删 D1 + R2。
                   @click.stop 防止冒泡到 figure 的「看大图」点击。
                   触屏上 @media (hover: none) 让按钮始终可见（见下方 scoped 样式）。 -->
              <button
                type="button"
                class="mac-img-del absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/65 text-white text-sm leading-none flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="deletingImageIds.has(img.id) || galleryImages.length <= 1"
                :title="galleryImages.length <= 1 ? '组内只剩 1 张，请直接删除整组' : `删除第 ${idx + 1} 张`"
                :aria-label="`删除第 ${idx + 1} 张`"
                @click.stop="handleDeleteImage(img, galleryGroup ?? undefined)"
              >
                {{ deletingImageIds.has(img.id) ? '…' : '×' }}
              </button>
              <!-- 删除中遮罩：覆盖整张缩略图 -->
              <div v-if="deletingImageIds.has(img.id)" class="mac-del-overlay" role="status" aria-live="polite">
                <div class="mac-del-spinner" aria-hidden="true"></div>
                <span class="text-[10px] font-medium text-gray-700 mt-1">删除中</span>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 认领弹窗：标记当前图已发布到哪些平台。
         claimDialogImageId 通过 openClaimDialog() 设置，nextTick 后再调 open()。
         saved 事件触发后用本地缓存 updateLocalClaims 同步，避免再发请求。 -->
    <ClaimDialog
      ref="claimDialogRef"
      :image-id="claimDialogImageId ?? 0"
      :current-claims="claimDialogImageId != null ? claimsOf(claimDialogImageId) : []"
      @saved="(p) => updateLocalClaims(p.imageId, p.claims)"
    />

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

/* 触屏（无 hover 设备）：删除按钮默认隐藏会被一直看不到。
   强制 opacity-1 让手机/平板用户能直接看到「×」删除入口。
   桌面端 hover 模型下保留默认 opacity-0，hover 才显示，画面更干净。
   同样处理画廊里的「分割」按钮：触屏也能直接看到入口。 */
@media (hover: none) {
  .mac-img-del {
    opacity: 0.85 !important;
  }
  .mac-img-split {
    opacity: 0.9 !important;
  }
  .mac-img-claim {
    opacity: 0.95 !important;
  }
}

/* ============ 删除 loading 反馈 ============
   卡片/figure 在 deleting 中：
     - 半透明白覆盖整张
     - 居中自转 spinner（不依赖 Tailwind animate-spin，避免 prefers-reduced-motion 影响）
     - 配套文字「正在删除…」/「删除中」让用户明确感知在等待 */
.mac-del-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  pointer-events: none;
}
.mac-del-spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid #e0e7ff;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: mac-del-rotate 0.8s linear infinite;
  will-change: transform;
}
/* 列表卡组用大一点的 spinner */
.is-deleting-group > .mac-del-overlay .mac-del-spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}
@keyframes mac-del-rotate {
  to { transform: rotate(360deg); }
}
/* 用户系统开启"减弱动画"时冻结 spinner，
   但保留 overlay 让用户知道在等待 —— 跟其他 loading 策略一致 */
@media (prefers-reduced-motion: reduce) {
  .mac-del-spinner {
    animation: none;
    border-top-color: #6366f1;
    /* 用一个静态的进度环表示"在转" */
    background: conic-gradient(from 0deg, #6366f1 0deg 90deg, transparent 90deg 360deg);
    border: 2.5px solid #e0e7ff;
    border-radius: 50%;
  }
}
</style>
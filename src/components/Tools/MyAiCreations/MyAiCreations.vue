<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import JSZip from 'jszip'
import { useUserStore } from '@/store/modules/user'
import { autoDown } from '@/utils/file'
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
  toggleAiCreationGroupFavorite,
  batchDeleteAiCreationGroups,
  type AiCreationGroup,
  type AiCreationImage,
  type AiCreationCategory,
} from '@/api/ai-creations'
import ClaimDialog from './ClaimDialog.vue'
import ManualUploadDialog from './ManualUploadDialog.vue'
import Expand from '~icons/ep/expand'
import Fold from '~icons/ep/fold'
import Star from '~icons/ep/star'
import StarFilled from '~icons/ep/star-filled'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/navigation'

const router = useRouter()
const route = useRoute()

const info = reactive({ title: '我的 AI 创作' })

// ============ 列表筛选状态（分类 / 页码 / 搜索 / 只看收藏）============
// 这四项都会同步到 URL query（category/page/q/fav），刷新或分享链接后状态可恢复。
const activeCategory = ref<string>('')
const sourceFilter = ref<'all' | 'ai_generated' | 'manual_upload'>('all')
const searchQ = ref<string>('')
const favOnly = ref<boolean>(false)
// 输入框即时绑定值；回车/点搜索才真正触发请求（searchQ 同步成它）
const searchInput = ref<string>('')

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

// ============ URL query 同步 ============
// 把 category/page/q/fav 写进 URL（replace 不产生历史记录），刷新/分享后可恢复筛选状态。
const syncUrl = () => {
  const query: Record<string, string> = {}
  if (activeCategory.value) query.category = activeCategory.value
  if (sourceFilter.value !== 'all') query.source = sourceFilter.value
  if (pagination.value.page > 1) query.page = String(pagination.value.page)
  if (searchQ.value.trim()) query.q = searchQ.value.trim()
  if (favOnly.value) query.fav = '1'
  router.replace({ query }).catch(() => {
    /* 重复导航静默 */
  })
}

// 从 URL query 恢复筛选状态（onMounted 时、loadGroups 之前调用）
const restoreFromUrl = () => {
  const { category, page, q, fav, source } = route.query
  if (typeof category === 'string' && category) activeCategory.value = category
  if (source === 'ai_generated' || source === 'manual_upload') sourceFilter.value = source
  if (typeof page === 'string') {
    const p = parseInt(page, 10)
    if (Number.isFinite(p) && p > 0) pagination.value.page = p
  }
  if (typeof q === 'string' && q.trim()) {
    searchQ.value = q.trim()
    searchInput.value = q.trim()
  }
  if (fav === '1') favOnly.value = true
}

// ============ 批量操作（按合集为单位：批量删除 / 打包下载）============
const batchMode = ref(false)
const selectedGroupIds = reactive(new Set<number>())
const batchDeleting = ref(false)
const batchDownloading = ref(false)

const toggleBatchMode = () => {
  batchMode.value = !batchMode.value
  selectedGroupIds.clear()
  if (batchMode.value) {
    // 展开态下卡片按单图展示，批量操作以合集为单位语义混乱：进批量模式强制收起
    showAllImages.value = false
  }
}

const isSelectedGroup = (id: number) => selectedGroupIds.has(id)

const toggleSelectGroup = (g: AiCreationGroup) => {
  if (selectedGroupIds.has(g.id)) selectedGroupIds.delete(g.id)
  else selectedGroupIds.add(g.id)
}

const selectAllOnPage = () => {
  for (const g of groups.value) selectedGroupIds.add(g.id)
}

const clearSelection = () => selectedGroupIds.clear()

/** 批量删除：confirm → 调 batch API → 本地移除 + 清理认领缓存 */
const handleBatchDelete = async () => {
  const ids = Array.from(selectedGroupIds)
  if (ids.length === 0 || batchDeleting.value) return
  const selGroups = groups.value.filter((g) => ids.includes(g.id))
  const totalImages = selGroups.reduce((s, g) => s + g.image_count, 0)
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${ids.length} 个合集（共 ${totalImages} 张图）吗？将同时删除 R2 存储中的对象，无法撤销。`,
      '批量删除',
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
  batchDeleting.value = true
  try {
    const res = await batchDeleteAiCreationGroups(ids)
    // 本地移除已删的组 + 清理认领缓存
    const deletedIds = new Set(ids.filter((id) => !res.skipped_ids.includes(id)))
    const removedImgs: number[] = []
    for (const g of selGroups) {
      if (deletedIds.has(g.id)) removedImgs.push(...g.images.map((i) => i.id))
    }
    groups.value = groups.value.filter((g) => !deletedIds.has(g.id))
    pagination.value.total = Math.max(0, pagination.value.total - res.groups_deleted)
    pagination.value.totalImages = Math.max(0, pagination.value.totalImages - res.images)
    void unclaimByImages(removedImgs).catch((e) =>
      console.warn('[my-ai-creations] batch cleanup claims failed', e),
    )
    for (const id of removedImgs) claimsByImageId.delete(id)
    selectedGroupIds.clear()
    const skippedNote = res.skipped_ids.length ? `，跳过 ${res.skipped_ids.length} 个（不存在或无权限）` : ''
    ElMessage.success(`已删除 ${res.groups_deleted} 个合集（R2 ${res.r2_deleted}/${res.images}）${skippedNote}`)
    if (groups.value.length === 0 && pagination.value.hasNext) {
      loadGroups()
    }
  } catch (e: any) {
    console.error('[my-ai-creations] batch delete error:', e)
    ElMessage.error(e?.response?.data?.error || e?.message || '批量删除失败')
  } finally {
    batchDeleting.value = false
  }
}

/** 批量打包下载：选中合集的所有图走 image-proxy 拉回来，JSZip 打包成 zip 下载。
 *  拉图并发 4，单张失败跳过并计数，最后统一提示。 */
const handleBatchDownload = async () => {
  const ids = Array.from(selectedGroupIds)
  if (ids.length === 0 || batchDownloading.value) return
  const selGroups = groups.value.filter((g) => ids.includes(g.id))
  const zip = new JSZip()
  batchDownloading.value = true
  try {
    // 组装任务列表：[folderName, fileName, url]
    type ZipTask = { folder: JSZip | null; name: string; url: string }
    const tasks: ZipTask[] = []
    for (const g of selGroups) {
      // 文件夹名：组 id + 标题片段；去掉文件系统非法字符
      const safeTitle = (groupTitle(g) || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30)
      const folder = zip.folder(`${g.id}-${safeTitle || 'untitled'}`)
      g.images.forEach((img) => {
        const ext = extFromUrlOrType(img.media_url)
        const filename = safeZipFilename(img.filename || `${img.id}.${ext}`)
        tasks.push({ folder, name: filename, url: img.media_url })
      })
    }
    if (tasks.length === 0) {
      ElMessage.warning('所选合集没有可下载的图片')
      return
    }
    let done = 0
    let failed = 0
    // 简易并发池：4 路并发拉图
    const queue = [...tasks]
    const worker = async () => {
      while (queue.length > 0) {
        const t = queue.shift()!
        try {
          const resp = await fetch(`/api/image-proxy?url=${encodeURIComponent(t.url)}`)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const blob = await resp.blob()
          t.folder?.file(t.name, blob)
          done++
        } catch {
          failed++
        }
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
    if (done === 0) {
      ElMessage.error('图片全部拉取失败，无法打包')
      return
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const objUrl = URL.createObjectURL(blob)
    autoDown(objUrl, `ai-creations-${new Date().toISOString().slice(0, 10)}.zip`)
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
    ElMessage.success(
      failed > 0 ? `已打包 ${done} 张图（${failed} 张拉取失败已跳过）` : `已打包 ${done} 张图`,
    )
  } catch (e: any) {
    console.error('[my-ai-creations] batch download error:', e)
    ElMessage.error('打包下载失败：' + (e?.message || '未知错误'))
  } finally {
    batchDownloading.value = false
  }
}

// 从 URL / dataURL 推断图片扩展名（打包 zip 里的文件名用）
const extFromUrlOrType = (url: string): string => {
  const m = /\.(jpe?g|png|webp|gif)(?:[?#]|$)/i.exec(url || '')
  if (m) return m[1]!.toLowerCase().replace('jpeg', 'jpg')
  return 'png'
}

const safeZipFilename = (filename: string): string => {
  const safe = filename.replace(/[\\/:*?"<>|\s]+/g, '_').trim()
  return safe || 'image.png'
}

// ============ 收藏 / 星标 ============
// 乐观更新：先改本地，PATCH 失败再回滚。
const toggleFavorite = async (g: AiCreationGroup) => {
  const target = !g.favorited
  g.favorited = target
  try {
    await toggleAiCreationGroupFavorite(g.id, target)
    // 「只看收藏」模式下取消收藏后该组会从筛选里消失，直接本地移除
    if (!target && favOnly.value) {
      groups.value = groups.value.filter((x) => x.id !== g.id)
      pagination.value.total = Math.max(0, pagination.value.total - 1)
    }
  } catch (e: any) {
    g.favorited = !target
    ElMessage.error(e?.response?.data?.error || '收藏操作失败')
  }
}

// ============ 通用复制（提示词 / URL 共用）============
const copyText = async (text?: string | null, successMsg = '已复制') => {
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      // 非 https / 旧浏览器没有 clipboard API，退回 execCommand
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ElMessage.success(successMsg)
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

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

// ============ 合集图片展示模式 ============
// 默认 false：合集卡片默认显示全部图片（多图合集用横向 swiper 轨道，单图合集 1 张占满）。
// 顶部"一键全部展开"按下后切到 true：多图合集拆成 N 张独立单图卡片，混排在 grid 里。
// 这是页面级开关，不影响认领 / 删除等操作。
const showAllImages = ref(false)
const toggleShowAllImages = () => {
  showAllImages.value = !showAllImages.value
}

// 顶部按钮可见性：只要页面上有一个多图合集就显示按钮。
const hasMultiImageGroup = computed(
  () => groups.value.some(g => g.image_count > 1),
)

// 展开态下：按合集 id 生成稳定的浅色 hsl 边框色。
// 同一合集永远同色（跨页一致），不同合集颜色互异。
const colorForGroup = (id: number): string => {
  const hue = (Math.abs(id * 47) + (id % 7) * 13) % 360
  return `hsl(${hue}, 65%, 75%)`
}

// 展开态下需要渲染的卡片列表：
// - showAllImages = false → 所有合集渲染为 `kind:'group'`（默认态：封面 swiper + 正文按钮）
// - showAllImages = true  →
//     · 单图合集 → `kind:'image'`（混排在 grid，跟其他单图合集一样）
//     · 多图合集 → `kind:'group-expanded'`（跨整列容器，内部 grid + 颜色边框圈住所有图）
type DisplayItem =
  | { kind: 'group'; group: AiCreationGroup }
  | { kind: 'group-expanded'; group: AiCreationGroup }
  | { kind: 'image'; parent: AiCreationGroup; image: AiCreationImage }
const displayItems = computed<DisplayItem[]>(() => {
  const out: DisplayItem[] = []
  for (const g of groups.value) {
    if (showAllImages.value) {
      if (g.images.length > 1) {
        out.push({ kind: 'group-expanded', group: g })
      } else {
        // 单图合集展开后当成单图卡片
        out.push({ kind: 'image', parent: g, image: g.images[0] })
      }
    } else {
      out.push({ kind: 'group', group: g })
    }
  }
  return out
})

// 展开态下临时用 image.id 作为 :key，保证每个"拆开后的单图卡片"有稳定 key
const itemKey = (item: DisplayItem): number | string => {
  if (item.kind === 'group' || item.kind === 'group-expanded') return `g-${item.group.id}`
  return `i-${item.image.id}`
}

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
  filename: '',
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
  // 进入全屏 viewer 前先关闭组详情弹窗和画廊弹窗，避免两层 modal 重叠导致点击被遮挡
  closeGroupDetail()
  closeGallery()
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

const copyImageUrl = (url?: string | null) => copyText(url, '已复制图片链接')

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
      q: searchQ.value.trim() || undefined,
      favOnly: favOnly.value || undefined,
      source: sourceFilter.value === 'all' ? undefined : sourceFilter.value,
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
  syncUrl()
}

const handleSourceChange = (source: 'all' | 'ai_generated' | 'manual_upload') => {
  sourceFilter.value = source
  pagination.value.page = 1
  loadGroups()
  syncUrl()
}

const uploadDialogVisible = ref(false)
const openUploadDialog = () => { uploadDialogVisible.value = true }
const handleUploadSuccess = async () => {
  uploadDialogVisible.value = false
  sourceFilter.value = 'manual_upload'
  pagination.value.page = 1
  syncUrl()
  await loadGroups()
}

const handlePageChange = (p: number) => {
  pagination.value.page = p
  loadGroups()
  syncUrl()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ============ 搜索 / 收藏筛选 ============
const handleSearch = () => {
  searchQ.value = searchInput.value.trim()
  pagination.value.page = 1
  loadGroups()
  syncUrl()
}

const clearSearch = () => {
  searchInput.value = ''
  handleSearch()
}

const toggleFavOnly = () => {
  favOnly.value = !favOnly.value
  pagination.value.page = 1
  loadGroups()
  syncUrl()
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

const sourceLabel = (source: AiCreationGroup['source_type']) => source === 'manual_upload' ? '手动上传' : 'AI 生成'

// 跳转到 /ai-image-edit/ 任务入口
const goCreate = () => {
  router.push('/ai-image-edit/')
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  restoreFromUrl()
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
          仅展示当前登录用户在 AI 工具中生成或上传的图片素材，按任务分组浏览。
          点击任意图片可全屏查看与切换。
        </p>
          <button
            type="button"
            class="mt-3 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 transition-all"
            @click="goCreate"
          >
            去 AI 图片编辑 →
          </button>
          <el-button class="mt-3 !ml-2" type="primary" plain @click="openUploadDialog">上传图片</el-button>
      </div>
    </div>

    <!-- 搜索 / 收藏筛选 / 分类 / 批量操作 -->
    <div class="px-4 mt-3">
      <div class="rounded-2xl bg-white p-3">
        <!-- 搜索 + 只看收藏 + 批量管理入口 -->
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <el-input
            v-model="searchInput"
            placeholder="搜索提示词 / 标题 / 模型 / 分类"
            clearable
            class="!w-60"
            @keyup.enter="handleSearch"
            @clear="clearSearch"
          />
          <el-button size="default" @click="handleSearch">搜索</el-button>
          <el-button
            size="default"
            :type="favOnly ? 'warning' : 'default'"
            :plain="!favOnly"
            @click="toggleFavOnly"
          >
            <el-icon class="mr-1">
              <StarFilled v-if="favOnly" />
              <Star v-else />
            </el-icon>
            只看收藏
          </el-button>
          <el-button
            class="!ml-auto"
            size="default"
            :type="batchMode ? 'danger' : 'default'"
            :plain="!batchMode"
            @click="toggleBatchMode"
          >
            {{ batchMode ? '退出批量管理' : '批量管理' }}
          </el-button>
          <el-select :model-value="sourceFilter" class="!w-32" aria-label="来源筛选" @update:model-value="handleSourceChange">
            <el-option label="全部来源" value="all" />
            <el-option label="AI 生成" value="ai_generated" />
            <el-option label="手动上传" value="manual_upload" />
          </el-select>
        </div>

        <!-- 批量操作条：批量操作以「合集」为单位 -->
        <div
          v-if="batchMode"
          class="flex items-center gap-2 mb-2 flex-wrap rounded-lg bg-amber-50 border border-amber-200 px-3 py-2"
        >
          <span class="text-xs text-amber-700 font-medium">已选 {{ selectedGroupIds.size }} 个合集</span>
          <el-button size="small" :disabled="groups.length === 0" @click="selectAllOnPage">全选本页</el-button>
          <el-button size="small" :disabled="selectedGroupIds.size === 0" @click="clearSelection">清空</el-button>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="selectedGroupIds.size === 0"
            :loading="batchDownloading"
            @click="handleBatchDownload"
          >
            打包下载 ZIP
          </el-button>
          <el-button
            size="small"
            type="danger"
            :disabled="selectedGroupIds.size === 0"
            :loading="batchDeleting"
            @click="handleBatchDelete"
          >
            删除所选
          </el-button>
          <span class="ml-auto text-[11px] text-amber-600">批量操作以「合集」为单位，打包下载走 image-proxy 拉原图</span>
        </div>

        <!-- 分类 -->
        <template v-if="categories.length > 0">
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
        </template>
        <!-- 顶部工具栏：仅在页面有多图合集时显示（批量模式下隐藏，避免与批量选择语义冲突）。
             默认：合集卡片用横向 swiper 显示全部图（不拆分）。
             一键展开后：多图合集拆成 N 个独立单图卡片混排在 grid 里。 -->
        <div
          v-if="hasMultiImageGroup && !batchMode"
          class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100"
        >
          <span class="text-xs text-gray-500">
            {{ showAllImages ? '已拆为独立图片卡片' : '默认合集横向滑动展示' }}
          </span>
          <el-button
            class="!ml-auto"
            size="small"
            :type="showAllImages ? 'default' : 'primary'"
            plain
            @click="toggleShowAllImages"
          >
            <el-icon class="mr-1">
              <Fold v-if="showAllImages" />
              <Expand v-else />
            </el-icon>
            {{ showAllImages ? '一键收起' : '一键全部展开' }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 组列表 -->
    <div class="px-4 mt-3">
      <div v-loading="loading" class="rounded-2xl bg-white p-4">
        <div v-if="groups.length === 0 && !loading" class="py-16 text-center text-gray-400">
          <div class="text-5xl mb-2">📭</div>
          <p class="mb-3">{{ sourceFilter === 'manual_upload' ? '还没有手动上传的图片' : sourceFilter === 'ai_generated' ? '还没有 AI 生成的图片' : '还没有任何创作记录' }}</p>
          <button
            v-if="sourceFilter !== 'manual_upload'"
            type="button"
            class="text-sm px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 transition-all"
            @click="goCreate"
          >
            去 AI 图片编辑生成一张
          </button>
          <el-button v-if="sourceFilter === 'manual_upload'" type="primary" plain @click="openUploadDialog">上传图片</el-button>
        </div>

        <!-- 合集列表。
         - 默认态：每张合集卡片，封面区根据 image_count 选择横滚轨道（>1张）或单图占满。
         - 一键展开后：多图合集被拆成 N 张独立单图卡片（kind:'image'）混排在 grid 里；
                       单图合集（kind:'group' 且 image_count<=1）保持原样。
         - 展开态下点"删除"调 handleDeleteImage（只删这一张）；
           默认态下点"删除"调 handleDeleteGroup（删整个合集）。 -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <template v-for="item in displayItems" :key="itemKey(item)">
            <!-- 单图卡片（展开态拆出来的） -->
            <div
              v-if="item.kind === 'image'"
              class="rounded-xl overflow-hidden border border-gray-100 hover:border-indigo-300 hover:shadow-lg transition-all bg-white relative"
              :class="{ 'is-deleting-group': deletingImageIds.has(item.image.id) }"
            >
              <!-- 封面区：单图占满 -->
              <div
                class="relative aspect-video bg-gray-100 overflow-hidden cursor-pointer"
                @click="openViewer(item.parent.images.map(i => i.media_url), item.parent.images.findIndex(i => i.id === item.image.id))"
              >
                <img
                  :src="item.image.thumbnail_url || item.image.media_url"
                  :alt="groupTitle(item.parent)"
                  loading="lazy"
                  class="w-full h-full object-cover transition-opacity duration-300"
                  :class="loadedCoverIds.has(item.image.id) ? 'opacity-100' : 'opacity-0'"
                  @load="markCoverLoaded(item.image.id)"
                  @error="onImageError($event, item.image.id)"
                />
                <div
                  v-if="!loadedCoverIds.has(item.image.id)"
                  class="cover-skeleton absolute inset-0 flex items-center justify-center pointer-events-none"
                  aria-hidden="true"
                >
                  <span class="cover-loading-dot"></span>
                  <span class="ml-2 text-xs font-medium text-gray-400">封面加载中</span>
                </div>
                <!-- 左上角：认领 tag -->
                <div
                  v-if="claimsOf(item.image.id).length > 0"
                  class="absolute top-2 left-2 flex flex-wrap items-center gap-1 max-w-[calc(100%-1rem)]"
                >
                  <span
                    v-for="p in claimsOf(item.image.id)"
                    :key="p"
                    class="bg-blue-600/85 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur font-medium shadow-sm"
                    :title="`已认领平台：${p}`"
                  >
                    🏷 {{ p }}
                  </span>
                </div>
              </div>

              <!-- 正文区 -->
              <div class="p-3">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 truncate">
                    {{ item.parent.category || '未分类' }}
                  </span>
                  <span class="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{{ sourceLabel(item.parent.source_type) }}</span>
                  <span class="text-[11px] text-gray-400 shrink-0">{{ formatTime(item.parent.created_at) }}</span>
                </div>
                <!-- 标题 + 复制提示词按钮（同合集卡片：提示词与标题重复时正文不渲染，入口固定在标题旁） -->
                <div class="flex items-center gap-1 min-w-0">
                  <h3 class="text-sm font-semibold text-gray-800 min-w-0 truncate" :title="groupTitle(item.parent)">
                    {{ groupTitle(item.parent) }}
                  </h3>
                  <button
                    v-if="groupPromptText(item.parent)"
                    type="button"
                    class="mac-copy-prompt shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="复制提示词"
                    @click="copyText(groupPromptText(item.parent), '已复制提示词')"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <p
                  v-if="groupPromptText(item.parent) && groupPromptText(item.parent).trim() !== groupTitle(item.parent).trim()"
                  class="text-xs text-gray-600 mt-1 line-clamp-3 leading-snug"
                  :title="groupPromptText(item.parent)"
                >
                  {{ groupPromptText(item.parent) }}
                </p>
                <div class="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <span v-if="item.image.filename" class="text-[11px] text-gray-500 truncate max-w-full" :title="item.image.filename">{{ item.image.filename }}</span>
                  <span v-if="item.parent.model_name" class="text-[11px] text-indigo-500 truncate max-w-[40%]">
                    {{ item.parent.model_name }}
                  </span>
                  <!-- 收藏 / 星标（收藏的是所属合集） -->
                  <button
                    type="button"
                    class="text-xs px-2 py-1 rounded-md border transition-all flex items-center gap-1"
                    :class="[
                      item.parent.favorited
                        ? 'bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100'
                        : 'border-gray-200 text-gray-500 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600',
                      item.parent.model_name ? '' : 'mr-auto',
                    ]"
                    :title="item.parent.favorited ? '取消收藏该合集' : '收藏该合集'"
                    @click="toggleFavorite(item.parent)"
                  >
                    <el-icon>
                      <StarFilled v-if="item.parent.favorited" />
                      <Star v-else />
                    </el-icon>
                    {{ item.parent.favorited ? '已收藏' : '收藏' }}
                  </button>
                  <button
                    type="button"
                    class="ml-auto text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-1"
                    title="复制这张图的 URL"
                    @click="copyImageUrl(item.image.media_url)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    复制URL
                  </button>
                  <!-- 发送至「图片切割」：单图卡片没有画廊/详情弹窗入口，操作栏直接给一个 -->
                  <button
                    type="button"
                    class="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-1"
                    title="把这张图发送到「图片切割」工具"
                    @click="openInImgCut(item.image)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121M12 12l2.879-2.879M12 12L9.121 14.879M21 3v6h-6M3 21v-6h6" />
                    </svg>
                    分割
                  </button>
                  <button
                    type="button"
                    :class="[
                      'text-xs px-2 py-1 rounded-md transition-all flex items-center gap-1',
                      claimsOf(item.image.id).length > 0
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                        : 'border border-blue-200 text-blue-600 hover:bg-blue-50',
                    ]"
                    :title="claimsOf(item.image.id).length > 0
                      ? `已认领：${claimsOf(item.image.id).join('、')}`
                      : '标记这张图已发布到哪些平台'"
                    @click="openClaimDialog(item.image)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    认领<span v-if="claimsOf(item.image.id).length > 0"> ({{ claimsOf(item.image.id).length }})</span>
                  </button>
                  <!-- 展开态下不显示「查看 N 张图」(单图本身就是) -->
                  <button
                    type="button"
                    class="mac-card-del text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-50 border border-red-200 hover:border-red-400 transition-all"
                    :disabled="deletingImageIds.has(item.image.id)"
                    title="只删除这张图"
                    @click="handleDeleteImage(item.image, item.parent)"
                  >
                    {{ deletingImageIds.has(item.image.id) ? '删除中…' : '删除' }}
                  </button>
                </div>
              </div>
              <div v-if="deletingImageIds.has(item.image.id)" class="mac-del-overlay" role="status" aria-live="polite">
                <div class="mac-del-spinner" aria-hidden="true"></div>
                <span class="text-xs font-medium text-gray-700 mt-2">正在删除…</span>
              </div>
            </div>

            <!-- 展开态下的多图合集：跨整列容器，内部 grid 列数跟主 grid 一致（1/2/3 列），
                 这样图片大小跟单图卡片一致，视觉上连贯；多行自动换行，外框完整圈住整体。 -->
            <div
              v-if="item.kind === 'group-expanded'"
              class="col-span-full rounded-xl p-2 transition-all"
              :style="{
                border: `2px solid ${colorForGroup(item.group.id)}`,
                backgroundColor: `${colorForGroup(item.group.id)}10`,
              }"
            >
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div
                  v-for="img in item.group.images"
                  :key="img.id"
                  class="group/img relative aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:border-indigo-400 active:scale-95 transition-all cursor-pointer"
                  :class="{ 'is-deleting-group': deletingImageIds.has(img.id) }"
                  @click="openViewer(item.group.images.map(i => i.media_url), item.group.images.findIndex(i => i.id === img.id))"
                >
                  <img
                    :src="img.thumbnail_url || img.media_url"
                    :alt="`${img.id}`"
                    loading="lazy"
                    class="w-full h-full object-cover transition-opacity duration-300"
                    :class="loadedCoverIds.has(img.id) ? 'opacity-100' : 'opacity-0'"
                    @load="markCoverLoaded(img.id)"
                    @error="onImageError($event, img.id)"
                  />
                  <!-- 加载骨架：图片未加载完时显示 -->
                  <div
                    v-if="!loadedCoverIds.has(img.id)"
                    class="absolute inset-0 flex items-center justify-center pointer-events-none"
                    aria-hidden="true"
                  >
                    <span class="cover-loading-dot"></span>
                    <span class="ml-2 text-[10px] font-medium text-gray-400">封面加载中</span>
                  </div>
                  <!-- 认领 tag（左上角，已有认领时显示） -->
                  <div
                    v-if="claimsOf(img.id).length > 0"
                    class="absolute top-1 left-1 flex flex-wrap items-center gap-1 max-w-[calc(100%-0.5rem)] z-10"
                  >
                    <span
                      v-for="p in claimsOf(img.id)"
                      :key="p"
                      class="bg-blue-600/85 text-white text-[9px] px-1 py-0.5 rounded backdrop-blur font-medium shadow-sm"
                      :title="`已认领平台：${p}`"
                    >
                      🏷 {{ p }}
                    </span>
                  </div>
                  <!-- 右上角删除按钮：只删这一张图 -->
                  <button
                    type="button"
                    class="mac-card-del absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/55 hover:bg-red-500 text-white text-xs backdrop-blur active:scale-90 transition-all z-10"
                    :disabled="deletingImageIds.has(img.id)"
                    title="只删除这张图"
                    @click.stop="handleDeleteImage(img, item.group)"
                  >
                    <span v-if="deletingImageIds.has(img.id)">…</span>
                    <span v-else>×</span>
                  </button>
                  <!-- 左下角复制 URL 按钮：复制这张图的 media_url -->
                  <button
                    type="button"
                    class="mac-img-copy absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/55 text-white border border-gray-200/40 backdrop-blur hover:bg-indigo-500 active:scale-95 transition-all z-10 flex items-center gap-0.5 opacity-0 group-hover/img:opacity-100"
                    title="复制这张图的 URL"
                    @click.stop="copyImageUrl(img.media_url)"
                  >
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.4" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    复制URL
                  </button>
                  <!-- 右下角认领操作按钮：打开认领弹窗 -->
                  <button
                    type="button"
                    :class="[
                      'absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded backdrop-blur active:scale-95 transition-all z-10 flex items-center gap-0.5',
                      claimsOf(img.id).length > 0
                        ? 'bg-blue-500/85 text-white border border-blue-200 hover:bg-blue-600'
                        : 'bg-black/55 text-white border border-blue-200 hover:bg-blue-500',
                    ]"
                    :title="claimsOf(img.id).length > 0
                      ? `已认领：${claimsOf(img.id).join('、')}`
                      : '标记这张图已发布到哪些平台'"
                    @click.stop="openClaimDialog(img)"
                  >
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.4" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    认领<span v-if="claimsOf(img.id).length > 0"> ({{ claimsOf(img.id).length }})</span>
                  </button>
                </div>
              </div>
              <!-- 删除整组遮罩 -->
              <div v-if="deletingGroupIds.has(item.group.id)" class="mac-del-overlay" role="status" aria-live="polite">
                <div class="mac-del-spinner" aria-hidden="true"></div>
                <span class="text-xs font-medium text-gray-700 mt-2">正在删除…</span>
              </div>
            </div>

            <!-- 合集卡片（默认态） -->
            <div
              v-else-if="item.kind === 'group'"
              class="rounded-xl overflow-hidden border border-gray-100 hover:border-indigo-300 hover:shadow-lg transition-all bg-white relative"
              :class="{
                'is-deleting-group': deletingGroupIds.has(item.group.id),
                '!border-indigo-400 ring-2 ring-indigo-200': batchMode && isSelectedGroup(item.group.id),
              }"
            >
              <!-- 批量选择圆框（批量模式下显示；@click.stop 避免触发看图） -->
              <button
                v-if="batchMode"
                type="button"
                class="absolute top-2 left-2 w-6 h-6 rounded-full z-20 flex items-center justify-center border-2 backdrop-blur transition-all"
                :class="isSelectedGroup(item.group.id)
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'bg-white/85 border-gray-300 text-transparent hover:border-indigo-400'"
                :title="isSelectedGroup(item.group.id) ? '取消选择该合集' : '选择该合集'"
                :aria-label="isSelectedGroup(item.group.id) ? '取消选择该合集' : '选择该合集'"
                @click.stop="toggleSelectGroup(item.group)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <!-- 封面区：>1 张图时用 swiper 组件横向滑动；单图时 aspect-video 占满 -->
              <div
                v-if="item.group.image_count > 1"
                class="relative bg-gray-100 overflow-hidden group/swiper"
              >
                <Swiper
                  :modules="[Pagination]"
                  :pagination="{ clickable: true }"
                  :slides-per-view="1"
                  :loop="false"
                  class="w-full"
                  style="aspect-ratio: 16 / 9;"
                  @click="openGallery(item.group)"
                >
                  <SwiperSlide
                    v-for="(img, idx) in item.group.images"
                    :key="img.id"
                    class="cursor-pointer"
                    @click.stop="openViewer(item.group.images.map(i => i.media_url), idx)"
                  >
                    <img
                      :src="img.thumbnail_url || img.media_url"
                      :alt="`第 ${idx + 1} 张`"
                      loading="lazy"
                      class="w-full h-full object-cover transition-opacity duration-300"
                      :class="loadedCoverIds.has(img.id) ? 'opacity-100' : 'opacity-0'"
                      @load="markCoverLoaded(img.id)"
                      @error="onImageError($event, img.id)"
                    />
                    <!-- 加载骨架：每张图独立判断 -->
                    <div
                      v-if="!loadedCoverIds.has(img.id)"
                      class="cover-skeleton absolute inset-0 flex items-center justify-center pointer-events-none"
                      aria-hidden="true"
                    >
                      <span class="cover-loading-dot"></span>
                      <span class="ml-2 text-xs font-medium text-gray-400">封面加载中</span>
                    </div>
                  </SwiperSlide>
                </Swiper>

                <!-- 左上角认领 tag（只标封面图）；批量模式下右移避开勾选框 -->
                <div
                  v-if="item.group.cover && claimsOf(item.group.cover.id).length > 0"
                  class="absolute top-2 flex flex-wrap items-center gap-1 max-w-[calc(100%-1rem)] z-10"
                  :style="{ left: batchMode ? '2.5rem' : '0.5rem' }"
                >
                  <span
                    v-for="p in claimsOf(item.group.cover.id)"
                    :key="p"
                    class="bg-blue-600/85 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur font-medium shadow-sm"
                    :title="`已认领平台：${p}`"
                  >
                    🏷 {{ p }}
                  </span>
                </div>
                <!-- 右上角：图数徽标 -->
                <div class="absolute top-2 right-2 z-10">
                  <span class="bg-black/60 text-white text-xs px-1.5 py-0.5 rounded backdrop-blur">
                    🖼 {{ item.group.image_count }} 张
                  </span>
                </div>
              </div>
              <div
                v-else-if="item.group.cover"
                class="relative aspect-video bg-gray-100 overflow-hidden cursor-pointer"
                @click="openViewer([item.group.cover.media_url], 0)"
              >
                <img
                  :src="item.group.cover.thumbnail_url || item.group.cover.media_url"
                  :alt="groupPromptText(item.group)"
                  loading="lazy"
                  class="w-full h-full object-cover transition-opacity duration-300"
                  :class="loadedCoverIds.has(item.group.cover.id) ? 'opacity-100' : 'opacity-0'"
                  @load="markCoverLoaded(item.group.cover.id)"
                  @error="onImageError($event, item.group.cover.id)"
                />
                <div
                  v-if="!loadedCoverIds.has(item.group.cover.id)"
                  class="cover-skeleton absolute inset-0 flex items-center justify-center pointer-events-none"
                  aria-hidden="true"
                >
                  <span class="cover-loading-dot"></span>
                  <span class="ml-2 text-xs font-medium text-gray-400">封面加载中</span>
                </div>
                <div
                  v-if="claimsOf(item.group.cover.id).length > 0"
                  class="absolute top-2 flex flex-wrap items-center gap-1 max-w-[calc(100%-1rem)]"
                  :style="{ left: batchMode ? '2.5rem' : '0.5rem' }"
                >
                  <span
                    v-for="p in claimsOf(item.group.cover.id)"
                    :key="p"
                    class="bg-blue-600/85 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur font-medium shadow-sm"
                    :title="`已认领平台：${p}`"
                  >
                    🏷 {{ p }}
                  </span>
                </div>
              </div>

              <!-- 正文区 -->
              <div class="p-3">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <span class="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 truncate">
                    {{ item.group.category || '未分类' }}
                  </span>
                  <span class="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">{{ sourceLabel(item.group.source_type) }}</span>
                  <span class="text-[11px] text-gray-400 shrink-0">{{ formatTime(item.group.created_at) }}</span>
                </div>
                <!-- 标题 + 复制提示词按钮：提示词与标题重复时正文段落不渲染，
                     所以复制入口固定放标题旁 -->
                <div class="flex items-center gap-1 min-w-0">
                  <h3 class="text-sm font-semibold text-gray-800 min-w-0 truncate" :title="groupTitle(item.group)">
                    {{ groupTitle(item.group) }}
                  </h3>
                  <button
                    v-if="groupPromptText(item.group)"
                    type="button"
                    class="mac-copy-prompt shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="复制提示词"
                    @click="copyText(groupPromptText(item.group), '已复制提示词')"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <p
                  v-if="groupPromptText(item.group) && groupPromptText(item.group).trim() !== groupTitle(item.group).trim()"
                  class="text-xs text-gray-600 mt-1 line-clamp-3 leading-snug"
                  :title="groupPromptText(item.group)"
                >
                  {{ groupPromptText(item.group) }}
                </p>
                <div class="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <span v-if="item.group.model_name" class="text-[11px] text-indigo-500 truncate max-w-[40%]">
                    {{ item.group.model_name }}
                  </span>
                  <!-- 收藏 / 星标：乐观切换，失败回滚 -->
                  <button
                    type="button"
                    class="text-xs px-2 py-1 rounded-md border transition-all flex items-center gap-1"
                    :class="[
                      item.group.favorited
                        ? 'bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100'
                        : 'border-gray-200 text-gray-500 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600',
                      item.group.model_name ? '' : 'mr-auto',
                    ]"
                    :title="item.group.favorited ? '取消收藏该合集' : '收藏该合集'"
                    @click="toggleFavorite(item.group)"
                  >
                    <el-icon>
                      <StarFilled v-if="item.group.favorited" />
                      <Star v-else />
                    </el-icon>
                    {{ item.group.favorited ? '已收藏' : '收藏' }}
                  </button>
                  <button
                    v-if="item.group.cover"
                    type="button"
                    :class="[
                      'ml-auto text-xs px-2 py-1 rounded-md transition-all flex items-center gap-1',
                      claimsOf(item.group.cover.id).length > 0
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                        : 'border border-blue-200 text-blue-600 hover:bg-blue-50',
                    ]"
                    :title="claimsOf(item.group.cover.id).length > 0
                      ? `已认领：${claimsOf(item.group.cover.id).join('、')}`
                      : '标记这张图已发布到哪些平台'"
                    @click="openClaimDialog(coverAsImage(item.group.cover))"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    认领<span v-if="claimsOf(item.group.cover.id).length > 0"> ({{ claimsOf(item.group.cover.id).length }})</span>
                  </button>
                  <!-- 复制封面图 URL -->
                  <button
                    v-if="item.group.cover"
                    type="button"
                    class="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-1"
                    title="复制封面图的 URL"
                    @click="copyImageUrl(item.group.cover.media_url)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    复制URL
                  </button>
                  <!-- 发送至「图片切割」：单图合集点图直接进全屏 viewer，没有画廊/详情里的分割入口，操作栏补一个；
                       多图合集在画廊里有每张图的分割按钮，这里不重复显示 -->
                  <button
                    v-if="item.group.image_count <= 1 && item.group.cover"
                    type="button"
                    class="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-1"
                    title="把这张图发送到「图片切割」工具"
                    @click="openInImgCut(coverAsImage(item.group.cover))"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121M12 12l2.879-2.879M12 12L9.121 14.879M21 3v6h-6M3 21v-6h6" />
                    </svg>
                    分割
                  </button>
                  <!-- 仅当合集有 >1 张图才显示「查看 N 张图」（单图合集点图片直接进 viewer，不需要这个按钮） -->
                  <button
                    v-if="item.group.image_count > 1"
                    type="button"
                    class="text-xs px-2.5 py-1 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95 transition-all"
                    @click="openGallery(item.group)"
                  >
                    查看 {{ item.group.image_count }} 张图 →
                  </button>
                  <button
                    type="button"
                    class="mac-card-del text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-50 border border-red-200 hover:border-red-400 transition-all"
                    :disabled="deletingGroupIds.has(item.group.id)"
                    :title="`删除该组（含 ${item.group.image_count} 张图）`"
                    @click="handleDeleteGroup(item.group)"
                  >
                    {{ deletingGroupIds.has(item.group.id) ? '删除中…' : '删除' }}
                  </button>
                </div>
              </div>
              <div v-if="deletingGroupIds.has(item.group.id)" class="mac-del-overlay" role="status" aria-live="polite">
                <div class="mac-del-spinner" aria-hidden="true"></div>
                <span class="text-xs font-medium text-gray-700 mt-2">正在删除…</span>
              </div>
            </div>
          </template>
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
              <el-tag size="small" type="info" effect="plain">
                {{ sourceLabel(selectedGroup.source_type) }}
              </el-tag>
              <el-tag v-if="selectedGroup.scene" size="small" type="info" effect="plain">
                {{ selectedGroup.scene }}
              </el-tag>
              <!-- 收藏切换：点击 tag 直接收藏 / 取消收藏 -->
              <el-tag
                size="small"
                :type="selectedGroup.favorited ? 'warning' : 'info'"
                :effect="selectedGroup.favorited ? 'light' : 'plain'"
                class="cursor-pointer select-none"
                :title="selectedGroup.favorited ? '点击取消收藏' : '点击收藏该合集'"
                @click="toggleFavorite(selectedGroup)"
              >
                {{ selectedGroup.favorited ? '★ 已收藏' : '☆ 收藏' }}
              </el-tag>
            </div>

            <!-- 标题 + 复制提示词：提示词与标题重复时下方文本块不渲染，入口固定放标题旁 -->
            <div class="flex items-center gap-1 mb-2 min-w-0">
              <h3 class="text-sm font-semibold text-gray-800 min-w-0 truncate">
                {{ groupTitle(selectedGroup) }}
              </h3>
              <button
                v-if="groupPromptText(selectedGroup)"
                type="button"
                class="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="复制提示词"
                @click="copyText(groupPromptText(selectedGroup), '已复制提示词')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>

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
            <!-- 描述：与标题完全一致时省略，避免视觉重复；右上角复制按钮一键复制提示词 -->
            <div
              v-if="groupPromptText(selectedGroup) && groupPromptText(selectedGroup).trim() !== groupTitle(selectedGroup).trim()"
              class="relative text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 pr-10 mb-4 whitespace-pre-wrap break-words"
            >
              <button
                type="button"
                class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="复制提示词"
                @click="copyText(groupPromptText(selectedGroup), '已复制提示词')"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
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
              <el-descriptions-item v-if="selectedImage?.filename" label="文件名">
                {{ selectedImage.filename }}
              </el-descriptions-item>
              <el-descriptions-item v-if="selectedImage?.width && selectedImage?.height" label="图片尺寸">
                {{ selectedImage.width }} × {{ selectedImage.height }}
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
            <el-tag size="small" type="info" effect="plain">{{ sourceLabel(galleryGroup.source_type) }}</el-tag>
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
          <div class="flex items-center gap-1 min-w-0">
            <h3 class="text-base font-semibold text-gray-800 min-w-0 truncate">{{ groupTitle(galleryGroup) }}</h3>
            <!-- 复制提示词：只要取得到提示词就显示（与卡片/详情弹窗入口一致） -->
            <button
              v-if="groupPromptText(galleryGroup)"
              type="button"
              class="shrink-0 w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="复制提示词"
              @click="copyText(groupPromptText(galleryGroup), '已复制提示词')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
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
              <span v-if="img.filename" class="absolute bottom-1.5 left-1.5 max-w-[calc(100%-3rem)] truncate bg-black/55 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur pointer-events-none" :title="img.filename">{{ img.filename }}</span>
              <!-- 复制 URL 按钮：跟在 i/N 角标右侧，hover 才显示 -->
              <button
                type="button"
                class="mac-img-copy absolute top-1.5 left-10 px-1.5 py-0.5 rounded bg-black/55 text-white text-[10px] font-medium backdrop-blur hover:bg-indigo-600 opacity-0 group-hover/img:opacity-100 transition-opacity inline-flex items-center gap-1"
                :title="`复制第 ${idx + 1} 张的 URL`"
                :aria-label="`复制第 ${idx + 1} 张的 URL`"
                @click.stop="copyImageUrl(img.media_url)"
              >
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.4" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2m-6-2h8a2 2 0 002-2V5a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>复制URL</span>
              </button>
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
    <ManualUploadDialog
      v-model="uploadDialogVisible"
      @success="handleUploadSuccess"
    />

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
        本页面仅展示当前登录用户自己在 AI 工具中生成或上传的图片素材，按任务分组浏览。
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
  .mac-img-copy {
    opacity: 0.9 !important;
  }
  /* 卡片提示词上的复制按钮：触屏没有 hover，常显 */
  .mac-copy-prompt {
    opacity: 1 !important;
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

/* ============ 合集 swiper 容器 ============
   把官方 swiper 的左右箭头 / 分页条调成截图里那种低调风格：
   - 左右箭头：默认半透明，鼠标悬停卡片时显示
   - 分页条：放卡片底部，白色圆点带阴影 */
.group\/swiper .swiper-button-prev,
.group\/swiper .swiper-button-next {
  color: #1f2937;
  background: rgba(255, 255, 255, 0.85);
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  opacity: 0;
  transition: opacity 0.15s;
}
.group\/swiper .swiper-button-prev {
  left: 4px !important;
  top: auto !important;
  bottom: 28px !important;  /* 避开底部分页条 */
}
.group\/swiper .swiper-button-next {
  right: 4px !important;
  top: auto !important;
  bottom: 28px !important;
}
.group\/swiper:hover .swiper-button-prev,
.group\/swiper:hover .swiper-button-next {
  opacity: 1;
}
.group\/swiper .swiper-button-prev::after,
.group\/swiper .swiper-button-next::after {
  font-size: 10px;
  font-weight: 700;
}
.group\/swiper .swiper-pagination {
  bottom: 6px !important;
}
.group\/swiper .swiper-pagination-bullet {
  background: rgba(255, 255, 255, 0.7);
  opacity: 1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.group\/swiper .swiper-pagination-bullet-active {
  background: #6366f1;
}
</style>
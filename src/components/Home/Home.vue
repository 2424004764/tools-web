<script setup lang="ts">
// 首页：热门资讯 + 最近使用 + 我的收藏 + 全部分类工具网格
// 侧边栏点击分类 → 锚点滚动到首页对应分区（?value=cate_X），滚动时同步高亮侧边栏
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconClock from '~icons/ep/clock'
import IconStarFilled from '~icons/ep/star-filled'
import IconStar from '~icons/ep/star'
import IconClose from '~icons/ep/close'
import IconTop from '~icons/ep/top'
import { useToolsStore } from '@/store/modules/tools'
import { useUserStore } from '@/store/modules/user'
import { useComponentStore } from '@/store/modules/component'
import { useSpriteLogo } from '@/components/Tools/useSpriteLogo'
import { getCateIcon } from './cateIcons'
import HotList from './HotList.vue'
import { fetchRecentUsedTools } from '@/utils/tool-usage'
import type { RecentTool } from '@/utils/tool-usage'
import {
  fetchFavoriteToolUrls,
  addFavoriteTool,
  removeFavoriteTool,
  normalizeToolUrl,
} from '@/api/favorite-tools'
import { ElMessage } from 'element-plus'

const toolsStore = useToolsStore()
const userStore = useUserStore()
const componentStore = useComponentStore()
const route = useRoute()
const router = useRouter()

// 首页直接消费的 toolsStore.cates 必须自己保证已加载，不依赖 Left.vue 的副作用 onMounted
const ensureCatesLoaded = async () => {
  if (toolsStore.cates.length > 0) return
  try {
    await toolsStore.getToolCate()
  } catch (error: any) {
    console.warn('[Home] 工具列表加载失败：', error?.message || error)
  }
}

const showBackTop = ref(false)

// 「最近使用」：仅登录用户可见，最多展示 8 个去重工具
const recentTools = ref<RecentTool[]>([])
const recentLoading = ref(false)

const ensureRecentLoaded = async () => {
  if (!userStore.getLoginStatus) {
    recentTools.value = []
    return
  }
  // 仅短路正在进行的请求；不缓存结果，方便每次回首页拉最新
  if (recentLoading.value) return
  recentLoading.value = true
  try {
    recentTools.value = await fetchRecentUsedTools()
  } catch (err: any) {
    console.warn('[Home] 最近使用加载失败：', err?.message || err)
    recentTools.value = []
  } finally {
    recentLoading.value = false
  }
}

// 把秒级时间戳格式化为「xx 分钟前 / xx 小时前 / xx 天前」
const formatRelativeTime = (sec: number): string => {
  if (!sec || Number.isNaN(sec)) return ''
  const diff = Math.floor(Date.now() / 1000 - sec)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  // 超过 30 天显示具体日期
  const d = new Date(sec * 1000)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

// 把工具 url 投影到 toolsStore.cates 上对应的工具条目（用于渲染 logo / 标题）。
// 收藏 url 在 API 层已去尾斜杠，tools.ts 的 url 大多带尾斜杠，这里两侧都归一后再比较
const lookupToolInfo = (toolUrl: string) => {
  const want = normalizeToolUrl(toolUrl)
  for (const cate of toolsStore.cates) {
    for (const tool of cate.list || []) {
      if (normalizeToolUrl(tool.url) === want) return tool
    }
  }
  return null
}

// ============ 我的收藏 ============
// favoriteList 按收藏时间倒序（后端返回顺序），收藏条直接用；
// favoriteUrls 是同数据的 Set，卡片星标 O(1) 判断。未登录两者为空。
const favoriteList = ref<string[]>([])
const favoriteUrls = ref<Set<string>>(new Set())

const isFavorited = (toolUrl: string) =>
  favoriteUrls.value.has(normalizeToolUrl(toolUrl))

const ensureFavoritesLoaded = async () => {
  if (!userStore.getLoginStatus) {
    favoriteList.value = []
    favoriteUrls.value = new Set()
    return
  }
  try {
    const urls = await fetchFavoriteToolUrls()
    favoriteList.value = urls
    favoriteUrls.value = new Set(urls)
  } catch (err: any) {
    console.warn('[Home] 收藏加载失败：', err?.message || err)
  }
}

// 收藏/取消收藏（卡片星标 + 收藏条移除按钮共用）。未登录点击提示「登录后可用」
const toggleFavorite = async (rawUrl: string) => {
  if (!userStore.getLoginStatus) {
    ElMessage.warning('登录后即可收藏工具')
    return
  }
  const toolUrl = normalizeToolUrl(rawUrl)
  const favorited = favoriteUrls.value.has(toolUrl)
  // 乐观更新，失败回滚
  if (favorited) {
    favoriteUrls.value.delete(toolUrl)
    favoriteList.value = favoriteList.value.filter((u) => u !== toolUrl)
  } else {
    favoriteUrls.value.add(toolUrl)
    favoriteList.value = [toolUrl, ...favoriteList.value]
  }
  try {
    if (favorited) {
      await removeFavoriteTool(toolUrl)
      ElMessage.success('已取消收藏')
    } else {
      await addFavoriteTool(toolUrl)
      ElMessage.success('已收藏')
    }
  } catch {
    if (favorited) {
      favoriteUrls.value.add(toolUrl)
      favoriteList.value = [toolUrl, ...favoriteList.value]
    } else {
      favoriteUrls.value.delete(toolUrl)
      favoriteList.value = favoriteList.value.filter((u) => u !== toolUrl)
    }
  }
}

const scrollToTop = () => {
  if (!isHomeScrollActive()) return
  const taskId = beginHomeScrollTask()
  pendingScrollRestore.value = 0
  void router.replace({ path: '/', query: {} })
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
  if (scrollTop <= 0) return
  const step = () => {
    if (!isHomeScrollTaskActive(taskId)) return
    const current = document.documentElement.scrollTop || document.body.scrollTop
    if (current <= 0) return
    const distance = Math.max(current / 12, 3)
    document.documentElement.scrollTop = current - distance
    document.body.scrollTop = current - distance
    scheduleScrollFrame(step)
  }
  scheduleScrollFrame(step)
}

// 首页的恢复/锚点滚动可能跨越多个异步帧；离开首页后必须让这些任务整体失效，
// 否则旧 Home 实例会在工具页挂载后继续写 window.scrollTo。
let homeMounted = false
let scrollTaskGeneration = 0
const pendingScrollFrames = new Set<number>()
interface PendingScrollDelay {
  id: number
  resolve: () => void
}
const pendingScrollDelays = new Set<PendingScrollDelay>()
const restoreCancelCleanups = new Set<() => void>()

const isHomeScrollActive = () => homeMounted && route.path === '/'
const isHomeScrollTaskActive = (taskId: number) => isHomeScrollActive() && taskId === scrollTaskGeneration

const scheduleScrollFrame = (callback: () => void) => {
  let frameId = 0
  frameId = window.requestAnimationFrame(() => {
    pendingScrollFrames.delete(frameId)
    callback()
  })
  pendingScrollFrames.add(frameId)
  return frameId
}

const waitForScrollDelay = (ms: number) => new Promise<void>((resolve) => {
  let pending!: PendingScrollDelay
  let settled = false
  const settle = () => {
    if (settled) return
    settled = true
    pendingScrollDelays.delete(pending)
    resolve()
  }
  pending = {
    id: window.setTimeout(settle, ms),
    resolve: settle,
  }
  pendingScrollDelays.add(pending)
})

const clearRestoreCancelListeners = () => {
  for (const cleanup of Array.from(restoreCancelCleanups)) cleanup()
}

const cancelHomeScrollTasks = () => {
  scrollTaskGeneration += 1
  for (const frameId of Array.from(pendingScrollFrames)) {
    window.cancelAnimationFrame(frameId)
    pendingScrollFrames.delete(frameId)
  }
  for (const pending of Array.from(pendingScrollDelays)) {
    window.clearTimeout(pending.id)
    pending.resolve()
  }
  clearRestoreCancelListeners()
  if (scrollTimer !== null) {
    window.cancelAnimationFrame(scrollTimer)
    scrollTimer = null
  }
  isScrollingToAnchor.value = false
  pendingScrollAnchor.value = ''
  // 立即打断可能仍在运行的原生 smooth scroll，但保持离开前的当前位置，
  // 让路由层随后负责把工具页归零。
  if (homeMounted) {
    window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: 'auto' })
  }
}

const beginHomeScrollTask = () => {
  cancelHomeScrollTasks()
  return scrollTaskGeneration
}

const getAnchorScrollY = (anchor: string) => {
  const el = document.getElementById(anchor)
  if (!el) return null
  const headerOffset = window.matchMedia('(max-width: 768px)').matches ? 64 : 24
  const y = window.scrollY + el.getBoundingClientRect().top - headerOffset
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  return Math.max(0, Math.min(Math.round(y), maxY))
}

const jumpToAnchor = (anchor: string) => {
  const y = getAnchorScrollY(anchor)
  if (y == null) return false
  window.scrollTo({ left: 0, top: y, behavior: 'auto' })
  return true
}

const scrollToAnchor = async () => {
  if (!isHomeScrollActive()) return
  const v = route.query?.value as any
  const anchor = Array.isArray(v) ? v[0] : v
  if (typeof anchor !== 'string' || !anchor) return

  // 如果是滚动触发的路由更新，不执行 scrollIntoView，避免循环
  if (isScrollTriggeredUpdate.value) return

  const taskId = beginHomeScrollTask()
  pendingScrollRestore.value = 0

  // 暂时禁用滚动监听（双重门控），避免循环触发
  isScrollListenerActive.value = false
  isScrollingToAnchor.value = true
  pendingScrollAnchor.value = anchor
  componentStore.setActiveCategory(anchor)

  await nextTick()
  if (!isHomeScrollTaskActive(taskId)) return
  // 等待目标锚点元素渲染：cates 是异步加载的，刷新场景下首次调用时元素可能尚未挂载。
  // 最多等 2s，期间每 50ms 重试一次；任务失效后立即停止，不再触碰全局滚动。
  const waitStart = Date.now()
  while (!document.getElementById(anchor) && Date.now() - waitStart < 2000) {
    if (!isHomeScrollTaskActive(taskId)) return
    await waitForScrollDelay(50)
  }

  if (!isHomeScrollTaskActive(taskId)) return
  // 热门资讯 / 最近使用会异步撑开页面高度，只滚一次会停在顶部。
  // 按元素当前位置计算 scrollY，避免 scrollIntoView 在高度变化时滚过头。
  jumpToAnchor(anchor)
  const correctionDelays = [120, 360, 720]
  for (const delay of correctionDelays) {
    await waitForScrollDelay(delay)
    if (!isHomeScrollTaskActive(taskId)) return
    jumpToAnchor(anchor)
  }

  if (!isHomeScrollTaskActive(taskId)) return
  isScrollingToAnchor.value = false
  isScrollListenerActive.value = true
  pendingScrollAnchor.value = ''
  if (componentStore.activeCategory !== anchor) {
    componentStore.setActiveCategory(anchor)
  }
}

// ============ 刷新后精确恢复滚动位置 ============
// 仅 F5 刷新（navigation type === 'reload'）时恢复像素级位置；
// SPA 站内导航（如详情页「返回」跳 /?value=cate_X）仍走锚点定位
const HOME_SCROLL_KEY = 'home_scroll_restore_y'

const isReloadNavigation = () => {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return nav ? nav.type === 'reload' : (performance as any).navigation?.type === 1
  } catch {
    return false
  }
}

// >0 表示有待恢复的滚动位置（本次挂载内消费一次）
const pendingScrollRestore = ref(0)

const onPageHide = () => {
  if (route.path !== '/') return
  try {
    sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY))
  } catch {
    // sessionStorage 不可用（隐私模式等）时静默忽略
  }
}

// 等分类列表渲染完成后恢复保存的滚动位置。
// 注意：热门资讯 / 最近使用 / 收藏条都是异步渲染的，恢复后页面高度还会变化把内容顶偏，
// 所以恢复后 2s 内做多次校正回填；期间用户主动滚动（滚轮/触摸/按键）立即交还控制权
const restoreScrollWhenReady = async () => {
  const y = pendingScrollRestore.value
  if (!y || !isHomeScrollActive()) return
  const taskId = beginHomeScrollTask()
  // 取消监听要在等 cates 之前就挂上：用户在任何时刻主动滚动都立即交还控制权
  let cancelled = false
  const removeCancelListeners = () => {
    window.removeEventListener('wheel', onCancel)
    window.removeEventListener('touchmove', onCancel)
    window.removeEventListener('keydown', onCancel)
    restoreCancelCleanups.delete(removeCancelListeners)
  }
  const onCancel = () => {
    cancelled = true
    cancelHomeScrollTasks()
    if (isHomeScrollActive()) {
      pendingScrollRestore.value = 0
      isScrollListenerActive.value = true
      try {
        sessionStorage.removeItem(HOME_SCROLL_KEY)
      } catch {
        // 静默
      }
    }
  }
  window.addEventListener('wheel', onCancel, { once: true, passive: true })
  window.addEventListener('touchmove', onCancel, { once: true, passive: true })
  window.addEventListener('keydown', onCancel, { once: true })
  restoreCancelCleanups.add(removeCancelListeners)

  const finish = () => {
    if (!isHomeScrollTaskActive(taskId)) return
    removeCancelListeners()
    pendingScrollRestore.value = 0
    try {
      sessionStorage.removeItem(HOME_SCROLL_KEY)
    } catch {
      // 静默
    }
    // 校正结束后再激活滚动监听（恢复/校正产生的滚动事件不回写 URL）
    isScrollListenerActive.value = true
  }

  const waitStart = Date.now()
  while (toolsStore.cates.length === 0 && Date.now() - waitStart < 3000) {
    if (!isHomeScrollTaskActive(taskId) || cancelled) return
    await waitForScrollDelay(50)
  }
  if (!isHomeScrollTaskActive(taskId) || cancelled) return
  await nextTick()
  if (!isHomeScrollTaskActive(taskId) || cancelled) return

  scheduleScrollFrame(() => {
    if (!isHomeScrollTaskActive(taskId) || cancelled) return
    window.scrollTo(0, y)
  })
  // 首次恢复后页面高度仍会随异步区块变化，按间隔校正回填
  const correctionDelays = [500, 1100, 1800]
  for (const delay of correctionDelays) {
    await waitForScrollDelay(delay)
    if (!isHomeScrollTaskActive(taskId) || cancelled) return
    window.scrollTo(0, y)
  }
  if (!isHomeScrollTaskActive(taskId) || cancelled) return
  window.scrollTo(0, y)
  finish()
}

// 滚动监听相关
const isScrollListenerActive = ref(false)
// 标记是否是滚动触发的路由更新（避免循环）
const isScrollTriggeredUpdate = ref(false)
// 标记是否正在执行 scrollToAnchor（scrollIntoView 产生的滚动事件不触发 URL 变更）
const isScrollingToAnchor = ref(false)
// 记录正在滚动到的目标锚点，用于 handleScroll 比对以避免在安全期结束后误触发 URL 回写
const pendingScrollAnchor = ref('')

// 滚动监听函数
const handleScroll = () => {
  // Home 卸载后，路由切换/归零产生的 scroll 事件不应再污染首页状态。
  if (!homeMounted || route.path !== '/') return
  showBackTop.value = (window.pageYOffset || document.documentElement.scrollTop) > 300
  try {
    sessionStorage.setItem('home_last_scroll_y', String(window.pageYOffset || document.documentElement.scrollTop || 0))
  } catch { /* 隐私模式等场景静默忽略 */ }
  if (!isScrollListenerActive.value) return
  // 用户刚在侧边栏点击分类（Left 设置的共享锁），暂时跳过滚动监听
  if (componentStore.navClickLockUntil > Date.now()) return
  // scrollToAnchor 产生的平滑滚动事件不触发 URL 变更，避免与版本守卫形成硬刷循环
  if (isScrollingToAnchor.value) return

  const categories = toolsStore.cates
  if (categories.length === 0) return

  // 获取当前滚动位置
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop

  // 查找当前可视区域内的分类
  let activeCategory = ''

  for (const cate of categories) {
    const element = document.getElementById(`cate_${cate.id}`)
    if (element) {
      const rect = element.getBoundingClientRect()
      const elementTop = scrollTop + rect.top

      // 如果分类标题在视窗顶部以下100px范围内，则认为是当前活跃分类
      if (elementTop <= scrollTop + 100) {
        activeCategory = `cate_${cate.id}`
      } else {
        break
      }
    }
  }

  // 如果检测到的活跃分类与正在滚向的目标一致，跳过 URL 更新
  // 避免残余滚动事件又把 URL 改写成不同值（本组件 scrollToAnchor 或 Left 同锚点直滚时设置）
  const anchorLock = pendingScrollAnchor.value || componentStore.anchorScrollTarget
  if (anchorLock && activeCategory === anchorLock) return

  // 更新活跃分类和URL
  if (activeCategory && activeCategory !== componentStore.activeCategory) {
    componentStore.setActiveCategory(activeCategory)
    // 同步更新URL地址栏
    const currentValue = route.query?.value as string
    if (currentValue !== activeCategory) {
      // 标记这是滚动触发的更新
      isScrollTriggeredUpdate.value = true
      // 使用 replace 避免添加历史记录；finally 确保导航完成后才复位标志位
      router.replace({
        path: "/",
        query: { value: activeCategory }
      }).finally(() => {
        isScrollTriggeredUpdate.value = false
      })
    }
  }
}

// 防抖处理
let scrollTimer: number | null = null
const throttledHandleScroll = () => {
  if (scrollTimer) return
  scrollTimer = window.requestAnimationFrame(() => {
    handleScroll()
    scrollTimer = null
  })
}

// 跳转锚点由 Left.vue 统一处理：改写 ?value=cate_X 后由本组件 watch(route.query.value) → scrollToAnchor 定位

onMounted(async () => {
  homeMounted = true
  await nextTick()
  if (!isHomeScrollActive()) return

  // 刷新（F5）：优先精确恢复上次滚动位置，跳过锚点定位
  if (isReloadNavigation()) {
    const saved = parseInt(sessionStorage.getItem(HOME_SCROLL_KEY) || '0', 10)
    if (saved > 0) pendingScrollRestore.value = saved
  }

  // 主动加载工具列表（避免依赖 Left.vue 的副作用）
  ensureCatesLoaded()

  // 「最近使用」「我的收藏」独立加载，与 cates 解耦
  ensureRecentLoaded()
  ensureFavoritesLoaded()

  // 预先添加滚动监听器；handleScroll 通过 isScrollListenerActive / isScrollingToAnchor 双重门控
  window.addEventListener('scroll', throttledHandleScroll)
  window.addEventListener('pagehide', onPageHide)

  // 只在有明确的 query.value 时才滚动到锚点
  if (pendingScrollRestore.value > 0) {
    // 刷新恢复：等 cates 渲染后 restoreScrollWhenReady 内部会激活滚动监听
    void restoreScrollWhenReady()
  } else if (route.query && route.query.value) {
    if (componentStore.anchorNavFromMenu) {
      componentStore.setAnchorNavFromMenu(false)
    }
    // 侧边栏点分类、详情页返回、带 ?value=cate_X 进入首页：都滚到对应分区。
    // 不再用 home_last_scroll_y 覆盖锚点，否则会停在热门资讯顶部。
    void scrollToAnchor()
  } else {
    // 无锚点需求，延迟激活滚动监听；复用可取消延时，避免快速离开后旧实例继续写状态。
    const taskId = scrollTaskGeneration
    void waitForScrollDelay(500).then(() => {
      if (isHomeScrollTaskActive(taskId)) {
        isScrollListenerActive.value = true
      }
    })
  }
})

onUnmounted(() => {
  cancelHomeScrollTasks()
  homeMounted = false
  // 清理滚动监听
  isScrollListenerActive.value = false
  window.removeEventListener('scroll', throttledHandleScroll)
  window.removeEventListener('pagehide', onPageHide)
})

// 监听路由变化
watch(() => route.path, (newPath) => {
  if (newPath === '/') {
    // 回到首页时重新激活滚动监听（scrollToAnchor 会自行管理 isScrollingToAnchor 门控）
    if (!isScrollingToAnchor.value) {
      isScrollListenerActive.value = true
    }
    // 回首页时重新拉取最近使用 / 同步收藏状态
    ensureRecentLoaded()
    ensureFavoritesLoaded()
  } else {
    // Home 可能在 transition 卸载前先收到路由变化；先失效所有旧滚动任务。
    cancelHomeScrollTasks()
    isScrollListenerActive.value = false
  }
})

// 登录态变化：登出清空，登录后立即拉取
watch(
  () => userStore.getLoginStatus,
  (logged) => {
    if (!logged) {
      recentTools.value = []
      favoriteList.value = []
      favoriteUrls.value = new Set()
    } else {
      // 重新登录时强制刷新一次
      recentTools.value = []
      ensureRecentLoaded()
      ensureFavoritesLoaded()
    }
  },
)

watch(() => route.query.value, () => {
  if (route.path !== '/') return
  // 仅侧边栏菜单 / 详情页返回 发起的分类跳转走锚点定位（消费标记）；
  // 滚动联动回写 URL 不在这里滚，避免一边滑一边被拽回分区标题。
  if (componentStore.anchorNavFromMenu) {
    componentStore.setAnchorNavFromMenu(false)
    scrollToAnchor()
  }
})

watch(() => toolsStore.cates.length, (newLen, oldLen) => {
  // 刷新恢复流程中：由 restoreScrollWhenReady 负责定位，不走锚点（避免互相覆盖）
  if (pendingScrollRestore.value > 0) return
  // cates 从无到有首次加载：onMounted 中的 scrollToAnchor 调用时锚点元素可能尚未渲染，
  // 此时需重置标志位强制重新触发滚动，避免被同锚点拦截吞掉。
  if (oldLen === 0 && newLen > 0 && route.query.value) {
    isScrollingToAnchor.value = false
    pendingScrollAnchor.value = ''
    scrollToAnchor()
  }
})
</script>

<template>
  <div class="max-w-[1400px]">
    <!-- 全球与全国热门信息 -->
    <HotList />

    <!-- 最近使用（仅登录用户） -->
    <section
      v-if="userStore.getLoginStatus && recentTools.length > 0"
      class="mt-8"
      aria-label="最近使用的工具"
    >
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <span
            class="w-7 h-7 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-sm shadow-accent-500/30"
            aria-hidden="true"
          >
            <IconClock class="w-4 h-4" />
          </span>
          <h2 class="text-h3 font-bold m-0 text-ink-900">最近使用</h2>
        </div>
        <span class="text-xs text-ink-400">最近 {{ recentTools.length }} 个</span>
      </div>
      <div class="flex overflow-x-auto gap-4 pb-2 -mx-1 px-1 snap-x recent-scroll">
        <router-link
          v-for="item in recentTools"
          :key="item.tool_url"
          :to="item.tool_url"
          class="snap-start shrink-0 w-48 group block rounded-2xl bg-white dark:bg-surface-0 p-3.5 shadow-sm shadow-ink-950/5 hover:shadow-md hover:shadow-accent-500/10 transition-all duration-200"
          :aria-label="`跳转到 ${item.tool_title}`"
        >
          <div class="flex items-center gap-2.5 min-h-[2.5rem]">
            <template v-if="lookupToolInfo(item.tool_url)">
              <img
                v-if="!useSpriteLogo(lookupToolInfo(item.tool_url)!, 36).style"
                :src="lookupToolInfo(item.tool_url)!.logo"
                loading="lazy"
                class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] object-contain"
                :alt="item.tool_title"
              >
              <div
                v-else
                class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem]"
                :style="useSpriteLogo(lookupToolInfo(item.tool_url)!, 36).style"
                role="img"
                :aria-label="item.tool_title"
              ></div>
            </template>
            <div
              v-else
              class="w-9 h-9 rounded-lg bg-brand-gradient-soft flex items-center justify-center text-accent-600 text-sm font-semibold"
              aria-hidden="true"
            >
              {{ (item.tool_title || '?').charAt(0) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-ink-900 truncate">{{ item.tool_title }}</div>
              <div class="text-[11px] text-ink-400 mt-0.5 flex items-center gap-1">
                <span>{{ formatRelativeTime(item.last_used_at) }}</span>
                <template v-if="item.use_count > 1">
                  <span aria-hidden="true">·</span>
                  <span class="text-accent-600">使用 {{ item.use_count }} 次</span>
                </template>
              </div>
            </div>
          </div>
        </router-link>
      </div>
    </section>

    <!-- 我的收藏（仅登录且有收藏时展示） -->
    <section
      v-if="userStore.getLoginStatus && favoriteList.length > 0"
      class="mt-8"
      aria-label="我收藏的工具"
    >
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2.5">
          <span
            class="w-7 h-7 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-sm shadow-accent-500/30"
            aria-hidden="true"
          >
            <IconStarFilled class="w-4 h-4" />
          </span>
          <h2 class="text-h3 font-bold m-0 text-ink-900">我的收藏</h2>
        </div>
        <span class="text-xs text-ink-400">收藏 {{ favoriteList.length }} 个</span>
      </div>
      <div class="flex overflow-x-auto gap-4 pb-2 -mx-1 px-1 snap-x recent-scroll">
        <router-link
          v-for="toolUrl in favoriteList"
          :key="toolUrl"
          :to="toolUrl"
          class="relative snap-start shrink-0 w-48 group block rounded-2xl bg-white dark:bg-surface-0 p-3.5 shadow-sm shadow-ink-950/5 hover:shadow-md hover:shadow-accent-500/10 transition-all duration-200"
          :aria-label="`跳转到 ${lookupToolInfo(toolUrl)?.title || '收藏的工具'}`"
        >
          <!-- 右上角移除收藏：仅从收藏中移除，不跳转 -->
          <button
            type="button"
            class="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-ink-900/35 text-white flex items-center justify-center hover:bg-danger-500 transition-colors duration-150"
            :title="`移除收藏 ${lookupToolInfo(toolUrl)?.title || ''}`"
            :aria-label="`从收藏中移除 ${lookupToolInfo(toolUrl)?.title || '该工具'}`"
            @click.stop.prevent="toggleFavorite(toolUrl)"
          >
            <IconClose class="w-3 h-3" aria-hidden="true" />
          </button>
          <div class="flex items-center gap-2.5 min-h-[2.5rem]">
            <template v-if="lookupToolInfo(toolUrl)">
              <img
                v-if="!useSpriteLogo(lookupToolInfo(toolUrl)!, 36).style"
                :src="lookupToolInfo(toolUrl)!.logo"
                loading="lazy"
                class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] object-contain"
                :alt="lookupToolInfo(toolUrl)!.title"
              >
              <div
                v-else
                class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem]"
                :style="useSpriteLogo(lookupToolInfo(toolUrl)!, 36).style"
                role="img"
                :aria-label="lookupToolInfo(toolUrl)!.title"
              ></div>
            </template>
            <div
              v-else
              class="w-9 h-9 rounded-lg bg-brand-gradient-soft flex items-center justify-center text-accent-600 text-sm font-semibold"
              aria-hidden="true"
            >
              ?
            </div>
            <div class="flex-1 min-w-0 pr-4">
              <div class="text-sm font-medium text-ink-900 truncate">
                {{ lookupToolInfo(toolUrl)?.title || '已下线工具' }}
              </div>
              <div class="text-[11px] text-ink-400 mt-0.5 flex items-center gap-1">
                <IconStarFilled class="w-3 h-3 text-accent-500" aria-hidden="true" />
                <span>已收藏</span>
              </div>
            </div>
          </div>
        </router-link>
      </div>
    </section>

    <!-- 全部分类工具网格 -->
    <div v-for="cate in toolsStore.cates" :key="cate.id">
      <!-- 分类标题（锚点目标） -->
      <div
        :id="'cate_' + cate.id"
        class="scroll-mt-6 c-xs:scroll-mt-16 mt-10 mb-4 flex items-center gap-2.5"
      >
        <span
          class="w-7 h-7 rounded-lg bg-brand-gradient text-white flex items-center justify-center shadow-sm shadow-accent-500/30 shrink-0"
          aria-hidden="true"
        >
          <component :is="getCateIcon(cate.title)" class="w-4 h-4" />
        </span>
        <h2 class="text-h3 font-bold m-0 text-ink-900">{{ cate.title }}</h2>
        <span class="text-xs text-ink-400 ml-auto">{{ cate.list?.length || 0 }} 个工具</span>
      </div>
      <!-- 工具卡片 -->
      <div class="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        <router-link
          v-for="item in cate.list"
          :key="item.id"
          :to="item.url"
          class="group block"
          :aria-label="item.title"
        >
          <!-- 悬浮效果挂在固定不动的内层卡片上：外层链接是静止热区，
               避免卡片上移后鼠标滑出热区造成悬浮/失焦循环抖动 -->
          <div
            class="relative rounded-2xl p-5 bg-white dark:bg-surface-0 ring-1 ring-transparent group-hover:ring-accent-300/70 dark:group-hover:ring-accent-500/40 shadow-sm shadow-ink-950/5 group-hover:shadow-[0_12px_32px_-10px_rgb(var(--accent-500)/0.35)] group-hover:bg-gradient-to-br group-hover:from-accent-100 group-hover:via-accent-50 group-hover:to-violet-100 dark:group-hover:from-accent-500/15 dark:group-hover:via-surface-0 dark:group-hover:to-violet-500/15 group-hover:-translate-y-1 transition-all duration-200"
          >
          <!-- 箭头角标：悬停时以白色圆标形式显示 -->
          <span
            class="absolute top-4 right-4 w-6 h-6 rounded-full bg-surface-2 text-ink-400 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-white/90 group-hover:text-accent-600 group-hover:shadow-sm transition-all duration-200"
            aria-hidden="true"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M340.864 149.312a30.592 30.592 0 0 0 0 42.752L652.736 512 340.864 831.872a30.592 30.592 0 0 0 0 42.752 29.12 29.12 0 0 0 41.728 0L714.24 534.4a32 32 0 0 0 0-44.672L382.592 149.376a29.12 29.12 0 0 0-41.728 0z"></path>
            </svg>
          </span>
          <!-- 收藏星标 -->
          <button
            type="button"
            class="absolute top-3.5 right-11 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150"
            :class="
              isFavorited(item.url)
                ? 'text-accent-500'
                : 'text-ink-300 hover:text-accent-400'
            "
            :title="
              userStore.getLoginStatus
                ? isFavorited(item.url)
                  ? '取消收藏'
                  : '收藏工具'
                : '登录后可用'
            "
            :aria-label="
              userStore.getLoginStatus
                ? isFavorited(item.url)
                  ? `取消收藏 ${item.title}`
                  : `收藏 ${item.title}`
                : `登录后可收藏 ${item.title}`
            "
            @click.stop.prevent="toggleFavorite(item.url)"
          >
            <IconStarFilled v-if="isFavorited(item.url)" class="w-4 h-4" />
            <IconStar v-else class="w-4 h-4" />
          </button>

          <div class="flex items-start gap-3">
            <img
              v-if="!useSpriteLogo(item, 44).style"
              :src="item.logo"
              loading="lazy"
              class="w-11 h-11 min-h-[2.75rem] min-w-[2.75rem] object-contain rounded-xl"
              :alt="item.title"
            >
            <div
              v-else
              class="w-11 h-11 min-h-[2.75rem] min-w-[2.75rem] rounded-xl"
              :style="useSpriteLogo(item, 44).style"
              role="img"
              :aria-label="item.title"
            ></div>
            <div class="min-w-0 pr-8">
              <div class="font-semibold text-base text-ink-900 truncate">
                {{ item.title }}
              </div>
              <div class="text-xs text-ink-400 mt-0.5">{{ item.cate }}</div>
            </div>
          </div>
          <p class="mt-3 mb-0 text-[13px] leading-relaxed text-ink-500 line-clamp-2 min-h-[2.6em]">
            {{ item.desc }}
          </p>
          </div>
        </router-link>
      </div>
    </div>

    <!-- 返回顶部 -->
    <transition name="fade">
      <button
        v-show="showBackTop"
        type="button"
        aria-label="回到顶部"
        title="回到顶部"
        class="fixed right-[30px] bottom-[60px] z-50 cursor-pointer w-12 h-12 rounded-full bg-white dark:bg-surface-0 shadow-lg shadow-ink-950/10 border border-border-subtle flex items-center justify-center text-ink-500 hover:text-accent-600 hover:border-accent-300 transition-colors"
        @click="scrollToTop"
      >
        <IconTop class="w-5 h-5" aria-hidden="true" />
      </button>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* 「最近使用 / 我的收藏」横滑条：隐藏滚动条但保留滚动能力 */
.recent-scroll {
  scrollbar-width: thin;
}
.recent-scroll::-webkit-scrollbar {
  height: 4px;
}
.recent-scroll::-webkit-scrollbar-thumb {
  background: rgb(var(--border-default));
  border-radius: 4px;
}
</style>

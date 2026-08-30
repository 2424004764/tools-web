<script setup lang="ts">
import { onMounted, watch, nextTick, onUnmounted, ref } from 'vue';
import { RouterLink } from "vue-router"
// import { Star } from '@element-plus/icons-vue'
import { useToolsStore } from '@/store/modules/tools'
import { useComponentStore } from '@/store/modules/component'
import { useUserStore } from '@/store/modules/user'
// import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from "vue-router"
import Top from '~icons/ep/top'
import { useSpriteLogo } from '@/components/Tools/useSpriteLogo'
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
import IconStarFilled from '~icons/ep/star-filled'
import IconStar from '~icons/ep/star'
import IconClose from '~icons/ep/close'
//store
const toolsStore = useToolsStore()
const componentStore = useComponentStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

// 首页直接消费的 toolsStore.cates 必须自己保证已加载，不依赖 Left.vue 的副作用 onMounted
// （Left 是 defineAsyncComponent + v-show 隐藏的，移动端在抽屉里才挂载，首次加载顺序不稳定会导致首页空白）
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
// 独立 fetch，不阻塞首页工具列表加载
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
const favoriteLoading = ref(false)

const isFavorited = (toolUrl: string) =>
  favoriteUrls.value.has(normalizeToolUrl(toolUrl))

const ensureFavoritesLoaded = async () => {
  if (!userStore.getLoginStatus) {
    favoriteList.value = []
    favoriteUrls.value = new Set()
    return
  }
  if (favoriteLoading.value) return
  favoriteLoading.value = true
  try {
    const urls = await fetchFavoriteToolUrls()
    favoriteList.value = urls
    favoriteUrls.value = new Set(urls)
  } finally {
    favoriteLoading.value = false
  }
}

// 收藏/取消收藏（卡片右上角星标共用）。未登录点击提示「登录后可用」
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
  history.replaceState(null, '', '/')
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
  if (scrollTop <= 0) return
  const step = () => {
    const current = document.documentElement.scrollTop || document.body.scrollTop
    if (current <= 0) return
    const distance = Math.max(current / 12, 3)
    document.documentElement.scrollTop = current - distance
    document.body.scrollTop = current - distance
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const scrollToAnchor = async () => {
  const v = route.query?.value as any
  const anchor = Array.isArray(v) ? v[0] : v
  if (typeof anchor !== 'string' || !anchor) return

  // 如果是滚动触发的路由更新，不执行 scrollIntoView，避免循环
  if (isScrollTriggeredUpdate.value) return

  // 如果已经在滚动到同一个锚点，跳过以避免重叠调用
  if (isScrollingToAnchor.value && pendingScrollAnchor.value === anchor) return

  // 暂时禁用滚动监听（双重门控），避免循环触发
  isScrollListenerActive.value = false
  isScrollingToAnchor.value = true
  pendingScrollAnchor.value = anchor

  await nextTick()
  // 等待目标锚点元素渲染：cates 是异步加载的，刷新场景下首次调用时元素可能尚未挂载。
  // 最多等 2s，期间每 50ms 重试一次；若标志位被新调用重置（cates 加载完成后的强制重试），主动让出。
  const waitStart = Date.now()
  while (!document.getElementById(anchor) && Date.now() - waitStart < 2000) {
    if (!isScrollingToAnchor.value) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  requestAnimationFrame(() => {
    document?.getElementById(anchor)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'start',
    })

    // 滚动完成后，延迟恢复滚动监听
    // 延迟 1.5s 确保 smooth scroll 动画完全结束，避免残余滚动事件触发 URL 变更
    setTimeout(() => {
      isScrollingToAnchor.value = false
      isScrollListenerActive.value = true
      pendingScrollAnchor.value = ''
    }, 1500)
  })
}

// ============ 刷新后精确恢复滚动位置 ============
// 仅 F5 刷新（navigation type === 'reload'）时恢复像素级位置；
// SPA 站内导航（如详情页「返回」跳 /?value=cate_X）仍走锚点定位，新标签页分享链接也不受影响
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
  if (!y) return
  // 取消监听要在等 cates 之前就挂上：用户在任何时刻主动滚动都立即交还控制权
  let cancelled = false
  const onCancel = () => { cancelled = true }
  window.addEventListener('wheel', onCancel, { once: true, passive: true })
  window.addEventListener('touchmove', onCancel, { once: true, passive: true })
  window.addEventListener('keydown', onCancel, { once: true })

  const waitStart = Date.now()
  while (toolsStore.cates.length === 0 && Date.now() - waitStart < 3000) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  await nextTick()

  const finish = () => {
    window.removeEventListener('wheel', onCancel)
    window.removeEventListener('touchmove', onCancel)
    window.removeEventListener('keydown', onCancel)
    pendingScrollRestore.value = 0
    try {
      sessionStorage.removeItem(HOME_SCROLL_KEY)
    } catch {
      // 静默
    }
    // 校正结束后再激活滚动监听（恢复/校正产生的滚动事件不回写 URL）
    isScrollListenerActive.value = true
  }

  requestAnimationFrame(() => window.scrollTo(0, y))
  // 首次恢复后页面高度仍会随异步区块变化，按间隔校正回填
  const correctionDelays = [500, 1100, 1800]
  for (const delay of correctionDelays) {
    await new Promise((resolve) => setTimeout(resolve, delay))
    if (cancelled) {
      finish()
      return
    }
    window.scrollTo(0, y)
  }
  if (!cancelled) window.scrollTo(0, y)
  finish()
}

// 滚动监听相关
const isScrollListenerActive = ref(false)
// 用户手动点击分类后，暂时禁用滚动监听（避免冲突）
const isUserClickingCategory = ref(false)
// 标记是否是滚动触发的路由更新（避免循环）
const isScrollTriggeredUpdate = ref(false)
// 标记是否正在执行 scrollToAnchor（scrollIntoView 产生的滚动事件不触发 URL 变更）
const isScrollingToAnchor = ref(false)
// 记录正在滚动到的目标锚点，用于 handleScroll 比对以避免在安全期结束后误触发 URL 回写
const pendingScrollAnchor = ref('')

// 滚动监听函数
const handleScroll = () => {
  showBackTop.value = (window.pageYOffset || document.documentElement.scrollTop) > 300
  if (!isScrollListenerActive.value) return
  // 如果用户正在点击分类，暂时跳过滚动监听
  if (isUserClickingCategory.value) return
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

  // 如果检测到的活跃分类与 scrollToAnchor 正在滚向的目标一致，跳过 URL 更新
  // 避免安全期（1.5s）结束后残余滚动事件又把 URL 改写成不同值
  if (pendingScrollAnchor.value && activeCategory === pendingScrollAnchor.value) return

  // 更新活跃分类和URL
  if (activeCategory && activeCategory !== componentStore.activeCategory) {
    componentStore.setActiveCategory(activeCategory)
    // 同步更新URL地址栏
    const currentValue = route.query?.value as string
    if (currentValue !== activeCategory) {
      // 标记这是滚动触发的更新
      isScrollTriggeredUpdate.value = true
      // 使用 replace 避免添加历史记录；finally 确保导航完成后（或失败后）才复位标志位，
      // 避免 setTimeout(100ms) 早于 router 异步流程结束而导致 scrollToAnchor 误触发
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

//跳转锚点 - 复用Left.vue的逻辑
const gotoAnchor = async (anchor: string) => {
  const q = route.query?.value as any
  const current = Array.isArray(q) ? q[0] : q

  // 标记用户正在点击分类，暂时禁用滚动监听
  isUserClickingCategory.value = true

  // 1秒后恢复滚动监听
  setTimeout(() => {
    isUserClickingCategory.value = false
  }, 1000)

  if (route.path === "/") {
    if (current === anchor) {
      // 直接滚动时也设置 pendingScrollAnchor，防止 handleScroll 误判
      pendingScrollAnchor.value = anchor
      await nextTick()
      document?.getElementById(anchor)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'start',
      })
      // 滚动完成后清除
      setTimeout(() => {
        pendingScrollAnchor.value = ''
      }, 1500)
      return
    }
    await router.replace({
      path: "/",
      query: { value: anchor },
    })
  } else {
    await router.push({
      path: "/",
      query: { value: anchor },
    })
  }
}

onMounted(async () => {
  await nextTick()

  // 刷新（F5）：优先精确恢复上次滚动位置，跳过锚点定位
  if (isReloadNavigation()) {
    const saved = parseInt(sessionStorage.getItem(HOME_SCROLL_KEY) || '0', 10)
    if (saved > 0) pendingScrollRestore.value = saved
  }

  // 主动加载工具列表（避免依赖 Left.vue 的副作用）
  ensureCatesLoaded()

  // 「最近使用」独立加载，与 cates 解耦；登录态变化或路由回首页时也会触发
  ensureRecentLoaded()

  // 「我的收藏」同样独立加载
  ensureFavoritesLoaded()

  // 预先添加滚动监听器；handleScroll 通过 isScrollListenerActive / isScrollingToAnchor 双重门控
  window.addEventListener('scroll', throttledHandleScroll)
  window.addEventListener('pagehide', onPageHide)

  // 只在有明确的 query.value 时才滚动到锚点
  if (pendingScrollRestore.value > 0) {
    // 刷新恢复：等 cates 渲染后 restoreScrollWhenReady 内部会激活滚动监听
    restoreScrollWhenReady()
  } else if (route.query && route.query.value) {
    scrollToAnchor()
    // scrollToAnchor 将在 ~1.5s 后设置 isScrollListenerActive = true
  } else {
    // 无锚点需求，延迟激活滚动监听
    setTimeout(() => {
      if (route.path === '/') {
        isScrollListenerActive.value = true
      }
    }, 500)
  }
})

onUnmounted(() => {
  // 清理滚动监听
  isScrollListenerActive.value = false
  window.removeEventListener('scroll', throttledHandleScroll)
  window.removeEventListener('pagehide', onPageHide)
  if (scrollTimer) {
    cancelAnimationFrame(scrollTimer)
  }
})

// 监听路由变化
watch(() => route.path, (newPath) => {
  if (newPath === '/') {
    // 回到首页时重新激活滚动监听（scrollToAnchor 会自行管理 isScrollingToAnchor 门控）
    if (!isScrollingToAnchor.value) {
      isScrollListenerActive.value = true
    }
    // 回首页时重新拉取最近使用（用户在工具页点了别处回来的场景）
    ensureRecentLoaded()
    // 回首页时同步收藏状态（用户可能在详情页收藏/取消过）
    ensureFavoritesLoaded()
  } else {
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
      // 重新登录时强制刷新一次（onMounted 里的幂等保护允许重置）
      recentTools.value = []
      ensureRecentLoaded()
      ensureFavoritesLoaded()
    }
  },
)

watch(() => route.query.value, () => {
  scrollToAnchor()
})

watch(() => toolsStore.cates.length, (newLen, oldLen) => {
  // 刷新恢复流程中：由 restoreScrollWhenReady 负责定位，不走锚点（避免互相覆盖）
  if (pendingScrollRestore.value > 0) return
  // cates 从无到有首次加载：onMounted 中的 scrollToAnchor 调用时锚点元素可能尚未渲染，
  // 会导致 scrollIntoView 失败；此时需重置标志位强制重新触发滚动，避免被同锚点拦截吞掉。
  if (oldLen === 0 && newLen > 0 && route.query.value) {
    isScrollingToAnchor.value = false
    pendingScrollAnchor.value = ''
    scrollToAnchor()
  }
})
</script>

<template>
  <div class="md:mr-6 c-xs:mr-0">
    <!-- 全球与全国热门信息 -->
    <HotList />

    <!-- 最近使用（仅登录用户） -->
    <section
      v-if="userStore.getLoginStatus && recentTools.length > 0"
      class="mt-6"
      aria-label="最近使用的工具"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h2 class="text-h3 font-bold m-0 text-ink-900">最近使用</h2>
        <span class="text-xs text-ink-400">最近 {{ recentTools.length }} 个</span>
      </div>
      <div class="flex overflow-x-auto gap-3 pb-2 -mx-1 px-1 snap-x recent-scroll">
        <router-link
          v-for="item in recentTools"
          :key="item.tool_url"
          :to="item.tool_url"
          class="snap-start shrink-0 w-44 sm:w-48 group block border border-border-default rounded-2xl bg-white p-3 hover:bg-accent-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          :aria-label="`跳转到 ${item.tool_title}`"
        >
          <div class="flex items-center gap-2 min-h-[2.5rem]">
            <template v-if="lookupToolInfo(item.tool_url)">
              <img
                v-if="!useSpriteLogo(lookupToolInfo(item.tool_url)!).style"
                :src="lookupToolInfo(item.tool_url)!.logo"
                loading="lazy"
                class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] object-contain"
                :alt="item.tool_title"
              >
              <div
                v-else
                class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem]"
                :style="useSpriteLogo(lookupToolInfo(item.tool_url)!).style"
                role="img"
                :aria-label="item.tool_title"
              ></div>
            </template>
            <div
              v-else
              class="w-9 h-9 rounded-md bg-accent-50 flex items-center justify-center text-accent-700 text-sm font-semibold"
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
      class="mt-6"
      aria-label="我收藏的工具"
    >
      <div class="flex items-baseline justify-between mb-3">
        <h2 class="text-h3 font-bold m-0 text-ink-900">我的收藏</h2>
        <span class="text-xs text-ink-400">收藏 {{ favoriteList.length }} 个</span>
      </div>
      <div class="flex overflow-x-auto gap-3 pb-2 -mx-1 px-1 snap-x recent-scroll">
        <router-link
          v-for="toolUrl in favoriteList"
          :key="toolUrl"
          :to="toolUrl"
          class="relative snap-start shrink-0 w-44 sm:w-48 group block border border-border-default rounded-2xl bg-white p-3 hover:bg-accent-50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
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
          <div class="flex items-center gap-2 min-h-[2.5rem]">
            <template v-if="lookupToolInfo(toolUrl)">
              <img
                v-if="!useSpriteLogo(lookupToolInfo(toolUrl)!).style"
                :src="lookupToolInfo(toolUrl)!.logo"
                loading="lazy"
                class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] object-contain"
                :alt="lookupToolInfo(toolUrl)!.title"
              >
              <div
                v-else
                class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem]"
                :style="useSpriteLogo(lookupToolInfo(toolUrl)!).style"
                role="img"
                :aria-label="lookupToolInfo(toolUrl)!.title"
              ></div>
            </template>
            <div
              v-else
              class="w-9 h-9 rounded-md bg-accent-50 flex items-center justify-center text-accent-700 text-sm font-semibold"
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

    <!-- list -->
    <div v-for="(cate, index) in toolsStore.cates" :key="index">
      <!-- cate title -->
      <button
        type="button"
        class="mt-8 mb-3 text-h3 font-bold text-ink-900 cursor-pointer hover:text-accent-600 transition-colors duration-200 bg-transparent border-0 text-left w-full"
        :id="'cate_' + cate.id"
        :aria-label="`跳转到 ${cate.title} 分类`"
        @click="gotoAnchor('cate_' + cate.id)"
      >
        <h2 class="text-h3 font-bold m-0">{{ cate.title }}</h2>
      </button>
      <!-- card -->
      <div class="flex justify-start flex-wrap gap-[1.25%] c-xs:ml-0">
        <div
          v-for="(item, index) in cate.list"
          :key="index"
          class="w-full sm:w-[49%] md:w-[32%] lg:w-[24%] xl:w-[19%] group"
        >
          <router-link
            :to="item.url"
            class="relative flex flex-col mt-5 border-solid rounded-2xl border-border-default p-2 bg-white shadow-lg group-hover:bg-accent-50 group-hover:shadow-xl group-hover:border-border-default w-full p-5 group-hover:-translate-y-3 duration-300 transition-all"
          >
            <!-- 收藏星标：悬在顶部留白区，高于标题行 -->
            <button
              type="button"
              class="absolute -top-1 right-1.5 z-10 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center transition-all duration-150"
              :class="isFavorited(item.url)
                ? 'bg-accent-50 text-accent-500'
                : 'text-ink-300 hover:text-accent-400'"
              :title="userStore.getLoginStatus
                ? (isFavorited(item.url) ? '取消收藏' : '收藏工具')
                : '登录后可用'"
              :aria-label="userStore.getLoginStatus
                ? (isFavorited(item.url) ? `取消收藏 ${item.title}` : `收藏 ${item.title}`)
                : `登录后可收藏 ${item.title}`"
              @click.stop.prevent="toggleFavorite(item.url)"
            >
              <IconStarFilled v-if="isFavorited(item.url)" class="w-3.5 h-3.5" />
              <IconStar v-else class="w-3.5 h-3.5" />
            </button>
            <div class="flex items-center border-b border-border-subtle pb-2">
              <img
                v-if="!useSpriteLogo(item).style"
                :src="item.logo"
                loading="lazy"
                class="w-10 h-10 min-h-[2.5rem] min-w-[2.5rem] object-contain"
                :alt="item.title"
              >
              <div
                v-else
                class="w-10 h-10 min-h-[2.5rem] min-w-[2.5rem]"
                :style="useSpriteLogo(item).style"
                role="img"
                :aria-label="item.title"
              ></div>
              <div class="flex flex-col ml-2 w-full min-w-0">
                <div class="flex">
                  <!-- 星标悬在标题行上方，标题无需让位 -->
                  <div class="font-semibold text-body-lg line-clamp-1 text-ink-900">{{ item.title }}</div>
                </div>
                <div class="flex justify-between">
                  <el-text size="small" class="text-ink-700">{{ item.cate }}</el-text>
                </div>
              </div>
            </div>
            <div class="mt-2 min-h-[3rem]">
              <el-text line-clamp="2" class="text-ink-900">{{ item.desc }}</el-text>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- 返回顶部 -->
    <transition name="fade">
      <button
        v-show="showBackTop"
        type="button"
        aria-label="回到顶部"
        title="回到顶部"
        class="fixed right-[30px] bottom-[60px] z-50 cursor-pointer w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-blue-50 transition-colors border border-gray-100 bg-white"
        @click="scrollToTop"
      >
        <el-icon :size="28" color="#409EFF" aria-hidden="true"><Top /></el-icon>
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
/* 「最近使用」横滑条：隐藏滚动条但保留滚动能力 */
.recent-scroll {
  scrollbar-width: thin;
}
.recent-scroll::-webkit-scrollbar {
  height: 4px;
}
.recent-scroll::-webkit-scrollbar-thumb {
  background: rgb(var(--border-subtle, 226 232 240));
  border-radius: 4px;
}
</style>
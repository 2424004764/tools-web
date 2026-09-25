<script setup lang="ts">
// 左侧分类导航（新设计）：logo + 可折叠「分类」组 + 图标分类列表 + 底部关于
// 分类点击 → 锚点滚动到首页对应分区（?value=cate_X）；高亮跟随首页滚动位置联动
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconGrid from '~icons/ep/grid'
import IconArrowUp from '~icons/ep/arrow-up'
import IconInfoFilled from '~icons/ep/info-filled'
import { rtrim } from '@/utils/string'
import { useToolsStore } from '@/store/modules/tools'
import { useComponentStore } from '@/store/modules/component'
import { getCateIcon } from '@/components/Home/cateIcons'

const appName = import.meta.env.VITE_APP_TITLE || '工具坊'
const appNet = import.meta.env.VITE_APP_DESC || ''

// 左下角波浪装饰的渐变 id：组件会在侧栏和抽屉中各渲染一份，需保证 id 唯一
const waveId = `wave${Math.random().toString(36).slice(2, 8)}`

const toolsStore = useToolsStore()
const componentStore = useComponentStore()
const route = useRoute()
const router = useRouter()

// 菜单选中（首页无 query 时默认第一个分类）
const defaultActive = ref('')

// 当前高亮：首页优先用滚动联动的 activeCategory，其余页面用 defaultActive
const computedActive = computed(() => {
  if (route.path === '/' && componentStore.activeCategory) {
    return componentStore.activeCategory
  }
  return defaultActive.value
})

const cateCollapsed = computed({
  get: () => componentStore.cateNavCollapsed,
  set: (v: boolean) => componentStore.setCateNavCollapsed(v),
})

// 当前分类是否高亮
const isActiveCate = (id: number) => computedActive.value === `cate_${id}`

const isAboutActive = computed(
  () => route.path === '/about' || route.path.startsWith('/userinfo'),
)

const closeDrawer = () => componentStore.setleftComDrawerStatus(false)

// 侧栏常驻整个 App，分类平滑滚动不会随 Home 卸载自动停止。
// 新导航或新分类滚动开始前先打断旧动画，避免它越过路由切换继续改 window 滚动位置。
let anchorScrollGeneration = 0
let anchorScrollTimer: number | null = null
const cancelAnchorScroll = () => {
  anchorScrollGeneration += 1
  if (anchorScrollTimer !== null) {
    window.clearTimeout(anchorScrollTimer)
    anchorScrollTimer = null
  }
  componentStore.setAnchorScrollTarget('')
  window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: 'auto' })
}

// 跳转锚点：首页内 replace query 让 Home.vue 的 scrollToAnchor 定位；他页先跳首页
const gotoAnchor = async (anchor: string) => {
  const q = route.query?.value as any
  const current = Array.isArray(q) ? q[0] : q

  closeDrawer()
  cancelAnchorScroll()
  const scrollGeneration = anchorScrollGeneration
  componentStore.setNavClickLockUntil(Date.now() + 1000)
  // 标记这是菜单发起的分类导航：首页据此走锚点定位而不是恢复滚动位置
  componentStore.setAnchorNavFromMenu(true)

  if (route.path === '/') {
    if (current === anchor) {
      // 同锚点：query 不变、watch 不会再触发，直接滚动并设置目标锁防误判
      componentStore.setAnchorScrollTarget(anchor)
      await nextTick()
      if (scrollGeneration !== anchorScrollGeneration || route.path !== '/') return
      document?.getElementById(anchor)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'start',
      })
      anchorScrollTimer = window.setTimeout(() => {
        if (scrollGeneration !== anchorScrollGeneration) return
        anchorScrollTimer = null
        componentStore.setAnchorScrollTarget('')
      }, 1500)
      return
    }
    if (scrollGeneration !== anchorScrollGeneration) return
    await router.replace({
      path: '/',
      query: { value: anchor },
    })
  } else {
    if (scrollGeneration !== anchorScrollGeneration) return
    await router.push({
      path: '/',
      query: { value: anchor },
    })
  }
}

const gotoAbout = () => {
  closeDrawer()
  router.push('/about')
}

// 依据路由计算默认高亮分类
const updateActive = () => {
  const path = route.path === '/' ? '/' : rtrim(route.path, '/')

  // 离开首页时清除滚动联动的高亮
  if (path !== '/') {
    componentStore.setActiveCategory('')
  }

  if (path === '/about') {
    defaultActive.value = 'about'
    return
  }

  if (path === '/') {
    const q = route.query?.value as any
    const anchor = Array.isArray(q) ? q[0] : q
    if (typeof anchor === 'string' && anchor) {
      defaultActive.value = anchor
    } else if (toolsStore.cates.length > 0) {
      defaultActive.value = `cate_${toolsStore.cates[0].id}`
    }
    return
  }

  // /cate/:id 独立分类页（保留的深链入口）也高亮对应分类
  const cateMatch = path.match(/^\/cate\/(\d+)/)
  if (cateMatch) {
    defaultActive.value = `cate_${cateMatch[1]}`
    return
  }

  // 工具详情页：精确 / 前缀匹配归属分类
  defaultActive.value = ''
  for (const cate of toolsStore.cates) {
    for (const tool of cate.list || []) {
      const toolPath = rtrim(tool.url, '/')
      if (toolPath && (toolPath === path || path.startsWith(toolPath + '/'))) {
        defaultActive.value = `cate_${cate.id}`
        return
      }
    }
  }
}

watch(
  () => route.path,
  (newPath) => {
    if (newPath !== '/') cancelAnchorScroll()
    updateActive()
  },
)
watch(
  () => route.query.value,
  () => {
    if (route.path === '/') updateActive()
  },
)
watch(
  () => toolsStore.cates.length,
  (len) => {
    if (len === 0) return
    updateActive()
  },
  { immediate: true },
)

onMounted(async () => {
  updateActive()
  // 幂等：store 已有数据时直接返回
  if (toolsStore.cates.length === 0) {
    try {
      await toolsStore.getToolCate()
    } catch {
      // store 内部有本地 tools.ts 兜底
    }
  }
})
</script>

<template>
  <div class="h-full flex flex-col relative overflow-hidden">
    <!-- 左下角渐变波浪装饰（纯装饰，不响应鼠标） -->
    <div class="sidebar-deco" aria-hidden="true">
      <svg class="deco-wave" viewBox="0 0 240 140" preserveAspectRatio="none">
        <defs>
          <linearGradient :id="`${waveId}-a`" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" style="stop-color: rgb(var(--accent-300)); stop-opacity: 0.4" />
            <stop offset="1" style="stop-color: rgb(var(--violet-300)); stop-opacity: 0.32" />
          </linearGradient>
          <linearGradient :id="`${waveId}-b`" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" style="stop-color: rgb(var(--violet-300)); stop-opacity: 0.35" />
            <stop offset="1" style="stop-color: rgb(var(--accent-200)); stop-opacity: 0.25" />
          </linearGradient>
        </defs>
        <path :fill="`url(#${waveId}-a)`" d="M0 84 C 55 30 120 104 240 42 L 240 140 L 0 140 Z" />
        <path :fill="`url(#${waveId}-b)`" d="M0 112 C 70 66 150 122 240 78 L 240 140 L 0 140 Z" />
      </svg>
      <span class="deco-blob deco-blob-1"></span>
      <span class="deco-blob deco-blob-2"></span>
    </div>

    <el-scrollbar class="flex-1 relative z-10">
      <div class="px-5 pt-6 pb-4">
        <!-- logo -->
        <router-link
          to="/"
          class="flex items-center gap-3 px-1 mb-7 no-underline"
          @click="closeDrawer"
        >
          <img
            src="@/assets/logo.png"
            class="w-11 h-11 rounded-xl object-contain shrink-0"
            :alt="appName"
          />
          <div class="min-w-0">
            <div class="text-lg font-bold leading-tight text-ink-900 truncate">
              {{ appName }}
            </div>
            <div class="text-xs text-ink-400 truncate">{{ appNet }}</div>
          </div>
        </router-link>

        <!-- 分类组标题（可折叠） -->
        <button
          type="button"
          class="w-full flex items-center gap-3 h-11 px-3.5 rounded-full bg-white dark:bg-surface-0 shadow-sm shadow-ink-950/5 border-0 cursor-pointer"
          :aria-expanded="!cateCollapsed"
          aria-label="展开或收起分类列表"
          @click="cateCollapsed = !cateCollapsed"
        >
          <span
            class="w-6 h-6 rounded-md bg-brand-gradient text-white flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <IconGrid class="w-3.5 h-3.5" />
          </span>
          <span class="font-semibold text-sm text-ink-900">分类</span>
          <IconArrowUp
            class="w-4 h-4 ml-auto text-ink-400 transition-transform duration-200"
            :class="cateCollapsed ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>

        <!-- 分类列表 -->
        <nav v-show="!cateCollapsed" class="mt-2 space-y-0.5" aria-label="工具分类">
          <button
            v-for="c in toolsStore.cates"
            :key="c.id"
            type="button"
            class="group w-full flex items-center gap-3 h-10 px-3.5 rounded-full text-sm border-0 cursor-pointer transition-colors duration-150"
            :class="
              isActiveCate(c.id)
                ? 'bg-brand-gradient text-white font-medium shadow-md shadow-accent-500/25'
                : 'text-ink-800 bg-transparent hover:bg-accent-100 hover:text-accent-700'
            "
            :aria-current="isActiveCate(c.id) ? 'true' : undefined"
            @click="gotoAnchor('cate_' + c.id)"
          >
            <component
              :is="getCateIcon(c.title)"
              class="w-[18px] h-[18px] shrink-0 transition-colors duration-150"
              :class="isActiveCate(c.id) ? 'text-white' : 'text-ink-500 group-hover:text-accent-600'"
              aria-hidden="true"
            />
            <span class="truncate">{{ c.title }}</span>
          </button>
        </nav>
      </div>
    </el-scrollbar>

    <!-- 底部固定：关于本站（波浪装饰从其后方透出） -->
    <div class="relative z-10 px-5 pb-5 pt-2 shrink-0">
      <button
        type="button"
        class="group w-full flex items-center gap-3 h-10 px-3.5 rounded-full text-sm border-0 cursor-pointer transition-colors duration-150"
        :class="
          isAboutActive
            ? 'bg-brand-gradient text-white font-medium shadow-md shadow-accent-500/25'
            : 'text-ink-800 bg-transparent hover:bg-accent-100 hover:text-accent-700'
        "
        @click="gotoAbout"
      >
        <IconInfoFilled
          class="w-[18px] h-[18px] shrink-0 transition-colors duration-150"
          :class="isAboutActive ? 'text-white' : 'text-ink-500 group-hover:text-accent-600'"
          aria-hidden="true"
        />
        <span>关于本站</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ─── 左下角渐变波浪装饰 ─────────────────────────────────── */
.sidebar-deco {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 200px;
  pointer-events: none;
  z-index: 0;
}
.deco-wave {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 140px;
  filter: blur(9px);
  opacity: 0.9;
}
.deco-blob {
  position: absolute;
  border-radius: 9999px;
  filter: blur(26px);
}
.deco-blob-1 {
  width: 200px;
  height: 130px;
  left: -80px;
  bottom: -55px;
  background: radial-gradient(closest-side, rgb(var(--violet-300) / 0.55), rgb(var(--violet-300) / 0));
}
.deco-blob-2 {
  width: 170px;
  height: 110px;
  left: -20px;
  bottom: -60px;
  background: radial-gradient(closest-side, rgb(var(--accent-300) / 0.5), rgb(var(--accent-300) / 0));
}
/* 暗色下装饰整体减淡，避免深底上过艳 */
html.dark .sidebar-deco {
  opacity: 0.32;
}
</style>

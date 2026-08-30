<script setup lang="ts">
/**
 * 全局悬浮「最近使用」按钮
 *
 * 行为：
 * 1. 默认右侧中部圆形按钮，仅登录用户可见
 * 2. 拖拽：Pointer Events 统一鼠标/触摸，setPointerCapture 锁事件；松手停在拖到的位置，
 *    不会自动贴边（用户拖哪儿就停哪儿）
 * 3. 靠边隐藏：松手 0.8s 后（或 pointerleave 0.8s 后）按当前 xRatio 决定贴哪一侧，
 *    用 translateX 滑到只剩 12px 边沿作为可点击 tab
 * 4. 点击：完整展开 + 打开「最近使用」面板（与首页横滑带同源：fetchRecentUsedTools）
 * 5. 位置持久化到 localStorage（rt_fab_pos_v2），存 xRatio/yRatio 自适应窗口缩放
 *
 * 隐藏场景：admin / qa-view / letterView / hideAllUI 专注模式 / 未登录
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { useToolsStore } from '@/store/modules/tools'
import { useComponentStore } from '@/store/modules/component'
import { useSpriteLogo } from '@/components/Tools/useSpriteLogo'
import { fetchRecentUsedTools } from '@/utils/tool-usage'
import type { RecentTool } from '@/utils/tool-usage'
import { useLocalStorage, useWindowSize } from '@vueuse/core'
import Clock from '~icons/ep/clock'
import Close from '~icons/ep/close'
import Refresh from '~icons/ep/refresh'
import StarFilled from '~icons/ep/star-filled'
import {
  fetchFavoriteToolUrls,
  normalizeToolUrl,
} from '@/api/favorite-tools'

const route = useRoute()
const userStore = useUserStore()
const toolsStore = useToolsStore()
const componentStore = useComponentStore()

// === 数据 ===
const open = ref(false)
const activeTab = ref<'recent' | 'favorites'>('recent')
const recentTools = ref<RecentTool[]>([])
const favoriteUrls = ref<string[]>([])
const loading = ref(false)

const visible = computed(() => {
  if (!userStore.getLoginStatus) return false
  if (route.path.startsWith('/admin')) return false
  if (route.name === 'qa-view' || route.name === 'letterView') return false
  if (componentStore.hideAllUI) return false
  return true
})

const formatRelativeTime = (sec: number): string => {
  if (!sec || Number.isNaN(sec)) return ''
  const diff = Math.floor(Date.now() / 1000 - sec)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  const d = new Date(sec * 1000)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

const lookupToolInfo = (toolUrl: string) => {
  const want = normalizeToolUrl(toolUrl)
  for (const cate of toolsStore.cates) {
    for (const tool of cate.list || []) {
      if (normalizeToolUrl(tool.url) === want) return tool
    }
  }
  return null
}

// 工具清单（toolsStore.cates）来自 /api/tools，只含已启用工具；
// 两个列表都以此为白名单过滤掉已禁用/下线的工具
const isEnabledTool = (toolUrl: string) => lookupToolInfo(toolUrl) != null

const loadFavorites = async () => {
  if (!userStore.getLoginStatus) {
    favoriteUrls.value = []
    return
  }
  try {
    favoriteUrls.value = await fetchFavoriteToolUrls()
  } catch (err: any) {
    console.warn('[RecentToolsFab] 拉取收藏失败：', err?.message || err)
    favoriteUrls.value = []
  }
}

// 弹窗数据源：最近使用 + 收藏（均过滤为已启用工具）
const enabledRecentTools = computed(() =>
  recentTools.value.filter((t) => isEnabledTool(t.tool_url)),
)
const enabledFavoriteUrls = computed(() =>
  favoriteUrls.value.filter((url) => isEnabledTool(url)),
)

const loadRecent = async () => {
  if (!userStore.getLoginStatus) {
    recentTools.value = []
    return
  }
  loading.value = true
  try {
    recentTools.value = await fetchRecentUsedTools(20)
  } catch (err: any) {
    console.warn('[RecentToolsFab] 拉取最近使用失败：', err?.message || err)
    recentTools.value = []
  } finally {
    loading.value = false
  }
}

// 打开弹窗 / 挂载时加载全部数据源；工具清单未就绪时按需补拉
const loadAll = async () => {
  if (!userStore.getLoginStatus) {
    recentTools.value = []
    favoriteUrls.value = []
    return
  }
  if (toolsStore.cates.length === 0) {
    try {
      await toolsStore.getToolCate()
    } catch (err: any) {
      console.warn('[RecentToolsFab] 工具清单加载失败：', err?.message || err)
    }
  }
  await Promise.all([loadRecent(), loadFavorites()])
}

onMounted(() => {
  if (visible.value) loadAll()
})

watch(visible, (v) => {
  if (v) loadAll()
  else {
    recentTools.value = []
    favoriteUrls.value = []
  }
})

watch(() => userStore.getLoginStatus, (logged) => {
  if (logged) loadAll()
  else {
    recentTools.value = []
    favoriteUrls.value = []
  }
})

watch(open, (isOpen) => {
  if (isOpen && userStore.getLoginStatus) loadAll()
  updateMode()
})

const onItemClick = () => {
  open.value = false
}

// === 拖拽 + 靠边隐藏 ===
const BUTTON_SIZE = 44 // w-11 h-11
const PEEK_VISIBLE = 36 // px sliver 露出（按钮 44px，只藏 8px，整按钮+角标都可见）
const CLICK_THRESHOLD = 5 // px 区分点击/拖拽
const PEEK_DELAY = 800 // ms 离手后自动隐藏

interface FabPos { xRatio: number; yRatio: number }
const DEFAULT_POS: FabPos = { xRatio: 1, yRatio: 0.5 }
const STORAGE_KEY = 'rt_fab_pos_v2'

const stored = useLocalStorage<FabPos>(STORAGE_KEY, DEFAULT_POS)
const { width: windowWidth, height: windowHeight } = useWindowSize()

// localStorage 里可能有历史脏数据，简单兜底
const safeStored = computed<FabPos>(() => {
  const s = stored.value
  if (!s || typeof s.xRatio !== 'number' || typeof s.yRatio !== 'number') {
    return DEFAULT_POS
  }
  return {
    xRatio: Math.max(0, Math.min(1, s.xRatio)),
    yRatio: Math.max(0, Math.min(1, s.yRatio)),
  }
})

const mode = ref<'visible' | 'peek' | 'dragging'>('visible')
const isHover = ref(false)
const dragMoved = ref(false)
const dragPos = ref<{ x: number; y: number } | null>(null)

let dragStartInfo: { px: number; py: number; bx: number; by: number } | null = null
let activePointerId: number | null = null
let hideTimer: number | null = null

const effectiveX = computed(() => {
  if (mode.value === 'dragging' && dragPos.value) return dragPos.value.x
  const max = Math.max(0, windowWidth.value - BUTTON_SIZE)
  return Math.max(0, Math.min(max, safeStored.value.xRatio * max))
})

const effectiveY = computed(() => {
  if (mode.value === 'dragging' && dragPos.value) return dragPos.value.y
  const max = Math.max(0, windowHeight.value - BUTTON_SIZE)
  return Math.max(0, Math.min(max, safeStored.value.yRatio * max))
})

const peekTransform = computed(() => {
  if (mode.value !== 'peek') return ''
  const currentX = effectiveX.value
  const edge: 'left' | 'right' = safeStored.value.xRatio < 0.5 ? 'left' : 'right'
  if (edge === 'right') {
    // 把按钮滑到右边沿，只露 PEEK_VISIBLE px（按钮左侧贴到 windowWidth - PEEK_VISIBLE）
    return `translateX(${windowWidth.value - PEEK_VISIBLE - currentX}px)`
  }
  return `translateX(${PEEK_VISIBLE - currentX - BUTTON_SIZE}px)`
})

const popoverPlacement = computed(() => {
  return safeStored.value.xRatio < 0.5 ? 'right-start' : 'left-start'
})

// 角标位置：跟 peek 方向走——贴右时角标在左上，贴左时角标在右上，永远落在可视条里
const peekEdge = computed<'left' | 'right'>(() =>
  safeStored.value.xRatio < 0.5 ? 'left' : 'right'
)

const transitionStyle = computed(() => {
  if (mode.value === 'dragging') return 'none'
  return 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
})

const clearHideTimer = () => {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

const scheduleHide = () => {
  clearHideTimer()
  hideTimer = window.setTimeout(() => {
    if (mode.value !== 'dragging' && !open.value && !isHover.value) {
      mode.value = 'peek'
    }
    hideTimer = null
  }, PEEK_DELAY)
}

const updateMode = () => {
  if (mode.value === 'dragging') return
  if (open.value || isHover.value) {
    mode.value = 'visible'
    clearHideTimer()
  } else {
    scheduleHide()
  }
}

const onPointerDown = (e: PointerEvent) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (open.value) open.value = false
  dragStartInfo = {
    px: e.clientX,
    py: e.clientY,
    bx: effectiveX.value,
    by: effectiveY.value,
  }
  dragPos.value = { x: dragStartInfo.bx, y: dragStartInfo.by }
  dragMoved.value = false
  mode.value = 'dragging'
  clearHideTimer()
  activePointerId = e.pointerId
  try {
    (e.currentTarget as Element).setPointerCapture(e.pointerId)
  } catch {}
  e.preventDefault()
}

const onPointerMove = (e: PointerEvent) => {
  if (mode.value !== 'dragging' || !dragStartInfo || !dragPos.value) return
  if (e.pointerId !== activePointerId) return
  const dx = e.clientX - dragStartInfo.px
  const dy = e.clientY - dragStartInfo.py
  if (Math.abs(dx) + Math.abs(dy) > CLICK_THRESHOLD) dragMoved.value = true
  dragPos.value = {
    x: Math.max(-BUTTON_SIZE / 2, Math.min(windowWidth.value - BUTTON_SIZE / 2, dragStartInfo.bx + dx)),
    y: Math.max(0, Math.min(windowHeight.value - BUTTON_SIZE, dragStartInfo.by + dy)),
  }
  e.preventDefault()
}

const onPointerEnd = (e: PointerEvent) => {
  if (mode.value !== 'dragging' || !dragStartInfo) return
  if (e.pointerId !== activePointerId) return

  if (dragMoved.value) {
    const finalX = dragPos.value?.x ?? effectiveX.value
    const finalY = dragPos.value?.y ?? effectiveY.value
    const maxX = Math.max(1, windowWidth.value - BUTTON_SIZE)
    const maxY = Math.max(1, windowHeight.value - BUTTON_SIZE)
    const newXRatio = Math.max(0, Math.min(1, finalX / maxX))
    const newYRatio = Math.max(0, Math.min(1, finalY / maxY))
    if (Math.abs(newXRatio - safeStored.value.xRatio) > 0.001 ||
        Math.abs(newYRatio - safeStored.value.yRatio) > 0.001) {
      stored.value = { xRatio: newXRatio, yRatio: newYRatio }
    }
  }

  try {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId)
  } catch {}
  dragStartInfo = null
  dragPos.value = null
  activePointerId = null

  // 拖完停留住：保留在拖到的位置；若鼠标不在按钮上则 0.8s 后自动贴边隐藏
  mode.value = 'visible'
  if (!isHover.value) scheduleHide()
}

const onPointerEnter = () => {
  isHover.value = true
  if (mode.value !== 'dragging') {
    mode.value = 'visible'
    clearHideTimer()
  }
}

const onPointerLeave = () => {
  isHover.value = false
  if (mode.value === 'dragging') return
  if (open.value) return // 弹层开着不隐藏
  scheduleHide()
}

// drag 收尾后的 click 用 capture 阶段拦截，避免触发 el-popover 的 trigger=click
const onClickCapture = (e: MouseEvent) => {
  if (dragMoved.value) {
    e.stopPropagation()
    e.preventDefault()
    e.stopImmediatePropagation()
  }
}

onUnmounted(clearHideTimer)
</script>

<template>
  <div
    v-if="visible"
    class="fixed z-40 select-none touch-none"
    :style="{
      left: effectiveX + 'px',
      top: effectiveY + 'px',
      width: BUTTON_SIZE + 'px',
      height: BUTTON_SIZE + 'px',
      transform: peekTransform,
      transition: transitionStyle,
    }"
    role="region"
    aria-label="最近使用的工具（可拖动）"
  >
    <el-popover
      v-model:visible="open"
      trigger="click"
      :placement="popoverPlacement"
      :width="320"
      :show-arrow="false"
      :hide-after="0"
      popper-class="recent-tools-fab-popover"
    >
      <template #reference>
        <button
          type="button"
          :aria-label="open ? '关闭' : '打开最近使用 / 收藏 / 可拖动调整位置'"
          title="拖动调整位置 · 点击查看最近使用与收藏"
          :class="[
            'w-11 h-11 rounded-full bg-white shadow-lg border border-border-subtle flex items-center justify-center hover:bg-accent-50 hover:border-accent-200 transition-colors duration-200 group relative',
            mode === 'dragging' ? 'cursor-grabbing' : 'cursor-grab',
          ]"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerEnd"
          @pointercancel="onPointerEnd"
          @pointerenter="onPointerEnter"
          @pointerleave="onPointerLeave"
          @click.capture="onClickCapture"
        >
          <el-icon :size="20" class="text-ink-700 group-hover:text-accent-600 transition-colors" aria-hidden="true">
            <Clock />
          </el-icon>
          <span
            v-if="recentTools.length > 0"
            :class="[
              'absolute top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-600 text-white text-[10px] font-semibold flex items-center justify-center leading-none pointer-events-none',
              peekEdge === 'left' ? 'right-1' : 'left-1',
            ]"
            aria-hidden="true"
          >{{ recentTools.length > 9 ? '9+' : recentTools.length }}</span>
        </button>
      </template>

      <div class="recent-tools-panel">
        <header class="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle">
          <!-- 最近使用 / 收藏 切换 -->
          <div class="flex items-center gap-0.5 bg-surface-2 rounded-lg p-0.5" role="tablist" aria-label="工具列表切换">
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'recent'"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 bg-transparent border-0 cursor-pointer"
              :class="activeTab === 'recent'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-900'"
              @click="activeTab = 'recent'"
            >
              <el-icon :size="12" aria-hidden="true"><Clock /></el-icon>
              <span>最近使用</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'favorites'"
              class="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 bg-transparent border-0 cursor-pointer"
              :class="activeTab === 'favorites'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-900'"
              @click="activeTab = 'favorites'"
            >
              <el-icon :size="12" aria-hidden="true"><StarFilled /></el-icon>
              <span>收藏</span>
              <span
                v-if="enabledFavoriteUrls.length > 0"
                class="text-[10px] text-ink-400"
                aria-hidden="true"
              >{{ enabledFavoriteUrls.length }}</span>
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              :disabled="loading"
              :aria-label="loading ? '刷新中' : '刷新'"
              title="刷新"
              class="w-7 h-7 rounded-md flex items-center justify-center text-ink-500 hover:text-accent-600 hover:bg-accent-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-0 cursor-pointer"
              @click="loadAll"
            >
              <el-icon :size="14" :class="loading ? 'is-loading' : ''" aria-hidden="true"><Refresh /></el-icon>
            </button>
            <button
              type="button"
              aria-label="关闭"
              title="关闭"
              class="w-7 h-7 rounded-md flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-surface-2 transition-colors bg-transparent border-0 cursor-pointer"
              @click="open = false"
            >
              <el-icon :size="14" aria-hidden="true"><Close /></el-icon>
            </button>
          </div>
        </header>

        <div class="px-4 py-2 max-h-[60vh] overflow-y-auto overscroll-contain">
          <!-- 最近使用 -->
          <template v-if="activeTab === 'recent'">
            <div v-if="loading && enabledRecentTools.length === 0" class="py-6 text-center text-xs text-ink-400">
              加载中…
            </div>

            <div v-else-if="enabledRecentTools.length === 0" class="py-8 text-center text-xs text-ink-400">
              暂无使用记录
            </div>

            <ul v-else class="m-0 p-0 list-none flex flex-col gap-1">
              <li v-for="item in enabledRecentTools" :key="item.tool_url">
                <router-link
                  :to="item.tool_url"
                  class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent-50 transition-colors duration-150 group/item"
                  :aria-label="`跳转到 ${item.tool_title}`"
                  @click="onItemClick"
                >
                  <template v-if="lookupToolInfo(item.tool_url)">
                    <img
                      v-if="!useSpriteLogo(lookupToolInfo(item.tool_url)!).style"
                      :src="lookupToolInfo(item.tool_url)!.logo"
                      loading="lazy"
                      :alt="item.tool_title"
                      class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] object-contain shrink-0"
                    >
                    <div
                      v-else
                      class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] shrink-0"
                      :style="useSpriteLogo(lookupToolInfo(item.tool_url)!).style"
                      role="img"
                      :aria-label="item.tool_title"
                    ></div>
                  </template>
                  <div
                    v-else
                    class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] rounded-md bg-accent-50 flex items-center justify-center text-accent-700 text-sm font-semibold shrink-0"
                    aria-hidden="true"
                  >{{ (item.tool_title || '?').charAt(0) }}</div>

                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-ink-900 truncate group-hover/item:text-accent-700 transition-colors">
                      {{ item.tool_title }}
                    </div>
                    <div class="text-[11px] text-ink-400 mt-0.5 flex items-center gap-1">
                      <span>{{ formatRelativeTime(item.last_used_at) }}</span>
                      <template v-if="item.use_count > 1">
                        <span aria-hidden="true">·</span>
                        <span class="text-accent-600">使用 {{ item.use_count }} 次</span>
                      </template>
                    </div>
                  </div>
                </router-link>
              </li>
            </ul>
          </template>

          <!-- 收藏 -->
          <template v-else>
            <div v-if="loading && enabledFavoriteUrls.length === 0" class="py-6 text-center text-xs text-ink-400">
              加载中…
            </div>

            <div v-else-if="enabledFavoriteUrls.length === 0" class="py-8 text-center text-xs text-ink-400 leading-relaxed">
              还没有收藏工具<br>
              <span class="text-[11px]">在首页点击工具卡片右上角的星标即可收藏</span>
            </div>

            <ul v-else class="m-0 p-0 list-none flex flex-col gap-1">
              <li v-for="toolUrl in enabledFavoriteUrls" :key="toolUrl">
                <router-link
                  :to="toolUrl"
                  class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent-50 transition-colors duration-150 group/item"
                  :aria-label="`跳转到 ${lookupToolInfo(toolUrl)?.title || '收藏的工具'}`"
                  @click="onItemClick"
                >
                  <template v-if="lookupToolInfo(toolUrl)">
                    <img
                      v-if="!useSpriteLogo(lookupToolInfo(toolUrl)!).style"
                      :src="lookupToolInfo(toolUrl)!.logo"
                      loading="lazy"
                      :alt="lookupToolInfo(toolUrl)!.title"
                      class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] object-contain shrink-0"
                    >
                    <div
                      v-else
                      class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] shrink-0"
                      :style="useSpriteLogo(lookupToolInfo(toolUrl)!).style"
                      role="img"
                      :aria-label="lookupToolInfo(toolUrl)!.title"
                    ></div>
                  </template>

                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-ink-900 truncate group-hover/item:text-accent-700 transition-colors">
                      {{ lookupToolInfo(toolUrl)?.title || '收藏的工具' }}
                    </div>
                    <div class="text-[11px] text-ink-400 mt-0.5 flex items-center gap-1">
                      <el-icon :size="10" class="text-accent-500" aria-hidden="true"><StarFilled /></el-icon>
                      <span>已收藏</span>
                    </div>
                  </div>
                </router-link>
              </li>
            </ul>
          </template>
        </div>

        <footer class="px-4 py-2 border-t border-border-subtle text-[11px] text-ink-400 text-center">
          {{ activeTab === 'recent' ? '按最近使用排序' : '按收藏时间排序' }}
        </footer>
      </div>
    </el-popover>
  </div>
</template>

<style>
/* 覆盖 el-popover 默认外观以匹配项目 warm 主题 */
.recent-tools-fab-popover.el-popover {
  padding: 0 !important;
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 16px !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08) !important;
  overflow: hidden;
}

.recent-tools-fab-popover.el-popover .recent-tools-panel {
  min-width: 320px;
}

.recent-tools-fab-popover .max-h-\[60vh\] {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}
.recent-tools-fab-popover .max-h-\[60vh\]::-webkit-scrollbar {
  width: 6px;
}
.recent-tools-fab-popover .max-h-\[60vh\]::-webkit-scrollbar-track {
  background: transparent;
}
.recent-tools-fab-popover .max-h-\[60vh\]::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.recent-tools-fab-popover .is-loading {
  animation: rt-fab-spin 0.9s linear infinite;
}
@keyframes rt-fab-spin {
  to { transform: rotate(360deg); }
}
</style>
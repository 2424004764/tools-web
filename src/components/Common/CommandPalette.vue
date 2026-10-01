<script setup lang="ts">
// 命令面板（Ctrl+K / Cmd+K）：全站工具快速搜索 + 自然语言「AI 帮我找工具」（Agnes 免费 AI）。
// 挂载在 App.vue 全局（后台页与 OAuth 授权页除外），键盘 ↑↓ 选择、↵ 打开、Esc 关闭。
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconSearch from '~icons/ep/search'
import IconLoading from '~icons/ep/loading'
import IconHomeFilled from '~icons/ep/home-filled'
import IconUser from '~icons/ep/user'
import IconPromotion from '~icons/ep/promotion'
import IconChatDotRound from '~icons/ep/chat-dot-round'
import IconSunny from '~icons/ep/sunny'
import IconMoon from '~icons/ep/moon'
import IconOdometer from '~icons/ep/odometer'
import IconMagicStick from '~icons/ep/magic-stick'
import IconBack from '~icons/ep/back'
import { useComponentStore } from '@/store/modules/component'
import { useUserStore } from '@/store/modules/user'
import { useToolsStore } from '@/store/modules/tools'
import { useTheme } from '@/composables/useTheme'
import { useAiToolFinder, type AiFindResult } from '@/composables/useAiToolFinder'
import { useSpriteLogo } from '@/components/Tools/useSpriteLogo'
import { recordToolUsage } from '@/utils/tool-usage'
import type { ToolsInfo } from '@/components/Tools/tools.type'

const router = useRouter()
const componentStore = useComponentStore()
const userStore = useUserStore()
const toolsStore = useToolsStore()
const { isDark, toggleTheme } = useTheme()
const { aiFinding, aiFindTools } = useAiToolFinder()

const visible = computed(() => componentStore.commandPaletteVisible)

const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const query = ref('')
const mode = ref<'tools' | 'ai'>('tools')
const flatTools = ref<ToolsInfo[]>([])
const toolsLoading = ref(false)
const activeIndex = ref(0)

// AI 模式状态：idle 初始 / loading 请求中 / done 出结果 / error 失败
const aiState = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const aiError = ref('')
const aiResult = ref<AiFindResult | null>(null)

// 全站工具扁平化（store 优先用已加载数据，没有才拉一次）
const ensureToolsLoaded = async () => {
  if (flatTools.value.length > 0) {
    return
  }
  toolsLoading.value = true
  try {
    const cates = await toolsStore.getToolCate()
    const list: ToolsInfo[] = []
    for (const cate of cates) {
      for (const tool of cate.list || []) {
        if (tool.url) list.push(tool)
      }
    }
    flatTools.value = list
  } catch (err: any) {
    console.warn('[CommandPalette] 工具目录加载失败：', err?.message || err)
  } finally {
    toolsLoading.value = false
  }
}

// 本地关键词过滤：按空格拆词，所有词都命中（标题/描述/分类/路径）才算匹配
const filteredTools = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/).filter(Boolean)
  return flatTools.value.filter((tool) => {
    const haystack = `${tool.title} ${tool.desc} ${tool.cate} ${tool.url}`.toLowerCase()
    return tokens.every((t) => haystack.includes(t))
  })
})

interface QuickAction {
  key: string
  label: string
  hint: string
  icon: any
  run: () => void
}

const quickActions = computed<QuickAction[]>(() => {
  const actions: QuickAction[] = [
    {
      key: 'home',
      label: '返回首页',
      hint: '浏览全部分类',
      icon: IconHomeFilled,
      run: () => go2('/'),
    },
    {
      key: 'theme',
      label: isDark.value ? '切换到浅色模式' : '切换到深色模式',
      hint: '主题',
      icon: isDark.value ? IconSunny : IconMoon,
      run: () => {
        toggleTheme()
        close()
      },
    },
    {
      key: 'feedback',
      label: '意见反馈',
      hint: '提建议 / 报问题',
      icon: IconChatDotRound,
      run: () => {
        close()
        componentStore.setFeedbackDialogVisible(true)
      },
    },
    {
      key: 'userinfo',
      label: '个人中心',
      hint: '账号与数据',
      icon: IconUser,
      run: () => go2('/userinfo'),
    },
  ]
  if (userStore.getIsAdmin) {
    actions.push({
      key: 'admin',
      label: '管理后台',
      hint: '新标签页打开',
      icon: IconOdometer,
      run: () => {
        close()
        window.open('/admin/dashboard', '_blank', 'noopener,noreferrer')
      },
    })
  }
  return actions
})

// 键盘可导航的行：工具模式 = 快捷操作（无关键词）或 搜索结果 + AI 入口（有关键词）；
// AI 模式 = AI 推荐的工具列表
interface PaletteRow {
  key: string
  kind: 'tool' | 'action' | 'ai'
  tool?: ToolsInfo
  reason?: string
  action?: QuickAction
}

const rows = computed<PaletteRow[]>(() => {
  if (mode.value === 'ai') {
    return (aiResult.value?.matches || []).map((m) => ({
      key: m.tool.url,
      kind: 'tool' as const,
      tool: m.tool,
      reason: m.reason,
    }))
  }
  if (!query.value.trim()) {
    return quickActions.value.map((a) => ({ key: a.key, kind: 'action' as const, action: a }))
  }
  const toolRows: PaletteRow[] = filteredTools.value.map((t) => ({
    key: t.url,
    kind: 'tool' as const,
    tool: t,
  }))
  toolRows.push({ key: '__ai__', kind: 'ai' })
  return toolRows
})

watch(rows, () => {
  activeIndex.value = 0
})

watch(activeIndex, async () => {
  await nextTick()
  listRef.value
    ?.querySelector(`[data-idx="${activeIndex.value}"]`)
    ?.scrollIntoView({ block: 'nearest' })
})

const close = () => componentStore.closeCommandPalette()

const go2 = (path: string) => {
  close()
  router.push(path)
}

const openTool = (tool: ToolsInfo) => {
  if (!tool?.url) return
  // 与工具详情页同一份使用记录上报，「最近使用」才能收录从面板进入的工具
  recordToolUsage(tool.url, tool.title)
  go2(tool.url)
}

const runRow = (row: PaletteRow | undefined) => {
  if (!row) return
  if (row.kind === 'tool' && row.tool) {
    openTool(row.tool)
  } else if (row.kind === 'action' && row.action) {
    row.action.run()
  } else if (row.kind === 'ai') {
    void runAiSearch()
  }
}

// ============ AI 帮我找工具 ============
const runAiSearch = async () => {
  const q = query.value.trim()
  if (!q || aiFinding.value) return
  mode.value = 'ai'
  aiState.value = 'loading'
  aiError.value = ''
  try {
    aiResult.value = await aiFindTools(q)
    aiState.value = 'done'
  } catch (err: any) {
    aiError.value = err?.message || 'AI 服务暂时不可用，请稍后重试'
    aiState.value = 'error'
  }
}

const backToSearch = () => {
  mode.value = 'tools'
  aiResult.value = null
  aiState.value = 'idle'
  nextTick(() => inputRef.value?.focus())
}

// ============ 键盘交互 ============
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (rows.value.length > 0) activeIndex.value = (activeIndex.value + 1) % rows.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (rows.value.length > 0) {
      activeIndex.value = (activeIndex.value - 1 + rows.value.length) % rows.value.length
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    runRow(rows.value[activeIndex.value])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

// 全局 Ctrl+K / Cmd+K 唤起；组件挂在普通页面全局（后台页不挂载）
const onGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    if (componentStore.commandPaletteVisible) {
      close()
    } else {
      componentStore.openCommandPalette()
    }
  }
}

// 打开面板：恢复预填内容 / 指定模式（从顶部搜索框「AI 帮我找工具」进入时直接发起 AI 搜索）
watch(visible, async (opened) => {
  if (!opened) return
  query.value = componentStore.commandPaletteQuery || ''
  const initialMode = componentStore.commandPaletteMode || 'tools'
  mode.value = initialMode
  aiResult.value = null
  aiState.value = initialMode === 'ai' ? 'loading' : 'idle'
  aiError.value = ''
  activeIndex.value = 0
  void ensureToolsLoaded().then(() => {
    if (initialMode === 'ai' && query.value.trim()) {
      void runAiSearch()
    }
  })
  await nextTick()
  inputRef.value?.focus()
})

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <Teleport to="body">
    <transition name="cmdk-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[2000] flex items-start justify-center px-4 pt-[10vh] cmdk-overlay"
        @click.self="close"
      >
        <div
          class="cmdk-panel w-full max-w-[640px] max-h-[70vh] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-surface-0 border border-border-subtle shadow-2xl shadow-ink-950/20"
          role="dialog"
          aria-label="快速搜索"
        >
          <!-- 输入行 -->
          <div class="flex items-center gap-2.5 px-4 h-14 shrink-0 border-b border-border-subtle">
            <button
              v-if="mode === 'ai'"
              type="button"
              class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-accent-600 hover:bg-accent-50 dark:hover:bg-surface-3 transition-colors"
              title="返回搜索"
              aria-label="返回搜索"
              @click="backToSearch"
            >
              <IconBack class="w-4 h-4" aria-hidden="true" />
            </button>
            <IconSearch v-else class="w-5 h-5 text-ink-400 shrink-0" aria-hidden="true" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-base text-ink-900 dark:text-ink-100 placeholder:text-ink-300"
              :placeholder="mode === 'ai' ? 'AI 正在理解你的需求…' : '搜索工具，或描述你想做的事让 AI 帮你找'"
              :disabled="mode === 'ai'"
              @keydown="onKeydown"
            >
            <button
              type="button"
              class="shrink-0 h-6 px-2 rounded-md text-[11px] text-ink-400 bg-surface-2 border border-border-subtle cursor-pointer hover:text-ink-600 transition-colors"
              title="关闭"
              @click="close"
            >
              Esc
            </button>
          </div>

          <!-- 结果区 -->
          <div ref="listRef" class="flex-1 overflow-y-auto p-2 cmdk-scroll">
            <!-- AI 模式 -->
            <template v-if="mode === 'ai'">
              <div v-if="aiState === 'loading'" class="flex items-center justify-center gap-2 py-12 text-ink-500">
                <IconLoading class="w-5 h-5 animate-spin text-accent-500" aria-hidden="true" />
                <span class="text-sm">AI 正在从全站工具里帮你挑选…</span>
              </div>
              <div v-else-if="aiState === 'error'" class="py-10 text-center">
                <p class="text-sm text-ink-500 m-0">{{ aiError }}</p>
                <el-button size="small" class="mt-3" @click="runAiSearch">重试</el-button>
              </div>
              <template v-else-if="aiResult">
                <p class="px-3 pt-2 pb-1 text-xs text-ink-400 m-0 flex items-center gap-1.5">
                  <IconMagicStick class="w-3.5 h-3.5 text-accent-500" aria-hidden="true" />
                  {{ aiResult.summary }}
                </p>
                <template v-if="aiResult.matches.length > 0">
                  <div
                    v-for="(row, idx) in rows"
                    :key="row.key"
                    :data-idx="idx"
                    class="cmdk-row"
                    :class="{ 'is-active': idx === activeIndex }"
                    @mouseenter="activeIndex = idx"
                    @click="runRow(row)"
                  >
                    <template v-if="row.tool">
                      <img
                        v-if="!useSpriteLogo(row.tool, 36).style"
                        :src="row.tool.logo"
                        loading="lazy"
                        class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] object-contain rounded-lg shrink-0"
                        :alt="row.tool.title"
                      >
                      <div
                        v-else
                        class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] rounded-lg shrink-0"
                        :style="useSpriteLogo(row.tool, 36).style"
                        role="img"
                        :aria-label="row.tool.title"
                      ></div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-ink-900 truncate">
                          {{ row.tool.title }}
                          <el-tag size="small" effect="plain" class="ml-1.5">{{ row.tool.cate }}</el-tag>
                        </div>
                        <div class="text-xs text-accent-600 mt-0.5 truncate">
                          {{ row.reason || row.tool.desc }}
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
                <div v-else class="py-8 text-center text-sm text-ink-400">
                  没找到合适的工具，<button type="button" class="text-accent-600 hover:underline cursor-pointer bg-transparent border-0 p-0" @click="backToSearch">换个说法</button>试试
                </div>
              </template>
            </template>

            <!-- 工具搜索模式 -->
            <template v-else>
              <!-- 无关键词：快捷操作 -->
              <template v-if="!query.trim()">
                <p class="px-3 pt-2 pb-1 text-xs text-ink-400 m-0">快捷操作</p>
                <div
                  v-for="(row, idx) in rows"
                  :key="row.key"
                  :data-idx="idx"
                  class="cmdk-row"
                  :class="{ 'is-active': idx === activeIndex }"
                  @mouseenter="activeIndex = idx"
                  @click="runRow(row)"
                >
                  <span
                    class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] rounded-lg bg-brand-gradient-soft text-accent-600 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <component :is="row.action?.icon" class="w-[18px] h-[18px]" />
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-ink-900">{{ row.action?.label }}</div>
                    <div class="text-xs text-ink-400 mt-0.5">{{ row.action?.hint }}</div>
                  </div>
                </div>
              </template>

              <!-- 有关键词：搜索结果 + AI 入口 -->
              <template v-else>
                <div v-if="toolsLoading && flatTools.length === 0" class="py-8 text-center text-sm text-ink-400">
                  正在加载工具目录…
                </div>
                <p v-else-if="filteredTools.length > 0" class="px-3 pt-2 pb-1 text-xs text-ink-400 m-0">
                  找到 {{ filteredTools.length }} 个工具
                </p>
                <div
                  v-for="(row, idx) in rows"
                  :key="row.key"
                  :data-idx="idx"
                  class="cmdk-row"
                  :class="{ 'is-active': idx === activeIndex, 'is-ai': row.kind === 'ai' }"
                  @mouseenter="activeIndex = idx"
                  @click="runRow(row)"
                >
                  <!-- AI 入口行 -->
                  <template v-if="row.kind === 'ai'">
                    <span
                      class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] rounded-lg bg-brand-gradient text-white flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <IconMagicStick class="w-[18px] h-[18px]" />
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-accent-600">AI 帮我找工具</div>
                      <div class="text-xs text-ink-400 mt-0.5 truncate">
                        没找到？让 AI 理解「{{ query.trim() }}」并推荐合适工具
                      </div>
                    </div>
                  </template>
                  <!-- 工具行 -->
                  <template v-else-if="row.tool">
                    <img
                      v-if="!useSpriteLogo(row.tool, 36).style"
                      :src="row.tool.logo"
                      loading="lazy"
                      class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] object-contain rounded-lg shrink-0"
                      :alt="row.tool.title"
                    >
                    <div
                      v-else
                      class="w-9 h-9 min-h-[2.25rem] min-w-[2.25rem] rounded-lg shrink-0"
                      :style="useSpriteLogo(row.tool, 36).style"
                      role="img"
                      :aria-label="row.tool.title"
                    ></div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-ink-900 truncate">
                        {{ row.tool.title }}
                        <el-tag size="small" effect="plain" class="ml-1.5">{{ row.tool.cate }}</el-tag>
                      </div>
                      <div class="text-xs text-ink-400 mt-0.5 truncate">{{ row.tool.desc }}</div>
                    </div>
                  </template>
                </div>
                <div
                  v-if="!toolsLoading && filteredTools.length === 0 && rows.length <= 1"
                  class="py-4 text-center text-sm text-ink-400"
                >
                  没有匹配的工具，试试下面的 AI 推荐或换个说法
                </div>
              </template>
            </template>
          </div>

          <!-- 底部提示 -->
          <div class="h-9 px-4 flex items-center gap-3 text-[11px] text-ink-400 border-t border-border-subtle shrink-0">
            <span>↑↓ 选择</span>
            <span>↵ 打开</span>
            <span>Esc 关闭</span>
            <span class="ml-auto flex items-center gap-1">
              <IconPromotion class="w-3 h-3" aria-hidden="true" />
              AI 由 Agnes 免费驱动
            </span>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.cmdk-overlay {
  background: rgb(var(--ink-950) / 0.45);
  backdrop-filter: blur(2px);
}

/* 全局 :focus-visible 会在输入框上画蓝色 outline（Ctrl+K 唤起属键盘触焦必命中），
   面板的焦点位置已由光标 + 高亮行指示，这里去掉避免蓝圈和面板圆角打架 */
.cmdk-panel input:focus-visible {
  outline: none;
}

.cmdk-fade-enter-active,
.cmdk-fade-leave-active {
  transition: opacity 0.15s ease-out;
}
.cmdk-fade-enter-active .cmdk-panel {
  transition: transform 0.18s ease-out;
}
.cmdk-fade-enter-from,
.cmdk-fade-leave-to {
  opacity: 0;
}
.cmdk-fade-enter-from .cmdk-panel {
  transform: translateY(-12px) scale(0.98);
}

.cmdk-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  margin: 2px 0;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.cmdk-row:hover,
.cmdk-row.is-active {
  background: rgb(var(--accent-50));
}
:global(html.dark) .cmdk-row:hover,
:global(html.dark) .cmdk-row.is-active {
  background: rgb(var(--accent-500) / 0.12);
}

.cmdk-row.is-ai {
  margin-top: 6px;
  border-top: 1px dashed rgb(var(--border-default));
  border-radius: 0 0 12px 12px;
  padding-top: 12px;
}

.cmdk-scroll {
  scrollbar-width: thin;
  overscroll-behavior: contain;
}
.cmdk-scroll::-webkit-scrollbar {
  width: 5px;
}
.cmdk-scroll::-webkit-scrollbar-thumb {
  background: rgb(var(--border-default));
  border-radius: 999px;
}
</style>

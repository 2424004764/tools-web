<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import IconLightning from '~icons/ep/lightning'

interface HotItem {
  title: string
  url: string
  hot?: string | number
}

interface SourceState {
  loading: boolean
  items: HotItem[]
  error: string
  updateTime: string
}

// 支持的数据源。tab 名 / 接口 type / 展示名 三处必须保持一致。
// 后端 sources 见 functions/api/hotlist/[[type]].js 的 SOURCES map。
const SOURCES = [
  { key: 'toutiao', label: '头条热榜', icon: '📰' },
  { key: 'sspai', label: '少数派', icon: '✏️' },
  { key: 'github', label: 'GitHub', icon: '⭐' },
  { key: 'hn', label: 'Hacker News', icon: '🌐' },
  { key: 'baidu', label: '百度热搜', icon: '🔥' },
  { key: 'v2ex', label: 'V2EX', icon: '💬' },
]

// 桌面端分组切换：一次展示一组 3 个源（一行三列），把新闻区从两行压到一行
const GROUPS = [
  { key: 'hot', label: '全网热榜', icon: '📊', sources: ['toutiao', 'baidu', 'sspai'] },
  { key: 'tech', label: '技术社区', icon: '💻', sources: ['github', 'hn', 'v2ex'] },
]

const activeGroup = ref<string>('hot') // 桌面端当前分组
const active = ref<string>('toutiao') // 移动端当前源（单列模式）

// 每个源独立缓存，避免来回切换闪烁
const cache = ref<Record<string, SourceState>>(
  Object.fromEntries(
    SOURCES.map((s) => [
      s.key,
      { loading: false, items: [], error: '', updateTime: '' } as SourceState,
    ]),
  ),
)

// 当前分组对应的 3 个源
const activeGroupSources = computed(() =>
  GROUPS.find((g) => g.key === activeGroup.value)!.sources.map(
    (k) => SOURCES.find((s) => s.key === k)!,
  ),
)

const activeState = computed(() => cache.value[active.value])

// "更新于"取当前分组内最新时间
const groupTime = computed(() => {
  const times = activeGroupSources.value
    .map((s) => cache.value[s.key].updateTime)
    .filter(Boolean)
    .sort()
    .reverse()
  return formatTime(times[0] || '')
})

async function load(type: string, force = false) {
  const state = cache.value[type]
  if (!force && state.items.length > 0) return
  state.loading = true
  state.error = ''
  try {
    const resp = await axios.get(`/api/hotlist/${type}`, { timeout: 15000 })
    const data = resp.data || {}
    state.items = Array.isArray(data.items) ? data.items : []
    state.updateTime = data.updateTime || ''
    if (data.error) state.error = data.error
  } catch (err: any) {
    state.error = err?.message || '加载失败'
    state.items = []
    ElMessage.warning(`加载 ${type} 失败：${state.error}`)
  } finally {
    state.loading = false
  }
}

// 加载一组（3 个源）；已缓存的自动跳过
async function loadGroup() {
  await Promise.all(activeGroupSources.value.map((s) => load(s.key)))
}

function switchGroup(key: string) {
  if (activeGroup.value === key) return
  activeGroup.value = key
  loadGroup()
}

function switchTab(type: string) {
  if (active.value === type) return
  active.value = type
  load(type) // 首次切换按需加载，之后走缓存
}

function openItem(item: HotItem) {
  if (!item.url) return
  window.open(item.url, '_blank', 'noopener,noreferrer')
}

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(() => {
  // 首屏只拉当前分组；另一组切换时按需加载（此前首屏并发拉全部 6 个源）
  loadGroup()
})
</script>

<template>
  <section class="hotlist-card mt-8" aria-label="全球与全国热门信息">
    <!-- 标题行：桌面端右侧为分组切换 + 更新时间 -->
    <header class="hotlist-header">
      <div class="flex items-center gap-2.5">
        <span
          class="w-7 h-7 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-sm shadow-accent-500/30 shrink-0"
          aria-hidden="true"
        >
          <IconLightning class="w-4 h-4" />
        </span>
        <h2 class="text-h3 font-bold m-0 text-ink-900">热门资讯</h2>
        <span class="hotlist-sub">全球 · 全国 · 技术圈</span>
      </div>
      <div class="hotlist-header-right">
        <!-- 分组切换：仅 ≥768px，一次换 3 个源 -->
        <nav class="hotlist-tabs hotlist-tabs-group" role="tablist" aria-label="新闻源分组">
          <button
            v-for="g in GROUPS"
            :key="g.key"
            type="button"
            role="tab"
            :aria-selected="activeGroup === g.key"
            :class="['hotlist-tab', { 'is-active': activeGroup === g.key }]"
            @click="switchGroup(g.key)"
          >
            <span class="hotlist-tab-icon" aria-hidden="true">{{ g.icon }}</span>
            <span>{{ g.label }}</span>
          </button>
        </nav>
        <span v-if="groupTime" class="hotlist-update">更新于 {{ groupTime }}</span>
      </div>
    </header>

    <!-- 源切换：仅 <768px 单列模式 -->
    <nav class="hotlist-tabs hotlist-tabs-source" role="tablist" aria-label="新闻源">
      <button
        v-for="src in SOURCES"
        :key="src.key"
        type="button"
        role="tab"
        :aria-selected="active === src.key"
        :class="['hotlist-tab', { 'is-active': active === src.key }]"
        @click="switchTab(src.key)"
      >
        <span class="hotlist-tab-icon" aria-hidden="true">{{ src.icon }}</span>
        <span>{{ src.label }}</span>
      </button>
    </nav>

    <!-- 桌面端：当前分组一行三列，每列 6 条 -->
    <div class="hotlist-grid">
      <article v-for="src in activeGroupSources" :key="src.key" class="hotlist-col">
        <header class="hotlist-col-header">
          <span class="hotlist-col-icon" aria-hidden="true">{{ src.icon }}</span>
          <h3 class="hotlist-col-title">{{ src.label }}</h3>
          <span v-if="cache[src.key].updateTime" class="hotlist-col-time">
            {{ formatTime(cache[src.key].updateTime) }}
          </span>
        </header>

        <!-- 加载中 -->
        <ul v-if="cache[src.key].loading && cache[src.key].items.length === 0" class="hotlist-col-list">
          <li v-for="i in 6" :key="i" class="hotlist-row">
            <span class="hotlist-rank skel-block" />
            <span class="hotlist-title skel-block skel-wide" />
          </li>
        </ul>

        <!-- 空 / 错误 -->
        <div v-else-if="cache[src.key].items.length === 0" class="hotlist-empty">
          <template v-if="cache[src.key].error">
            <p>数据源暂时不可用</p>
            <button class="hotlist-retry" type="button" @click="load(src.key, true)">重试</button>
          </template>
          <template v-else>
            <p>暂无数据</p>
          </template>
        </div>

        <!-- 列表 -->
        <ol v-else class="hotlist-col-list">
          <li
            v-for="(item, idx) in cache[src.key].items.slice(0, 6)"
            :key="idx"
            class="hotlist-row hotlist-item"
            @click="openItem(item)"
          >
            <span :class="['hotlist-rank', idx < 3 ? `hotlist-rank-${idx + 1}` : '']">
              {{ idx + 1 }}
            </span>
            <span class="hotlist-title" :title="item.title">{{ item.title }}</span>
            <span v-if="item.hot" class="hotlist-hot">{{ item.hot }}</span>
          </li>
        </ol>
      </article>
    </div>

    <!-- 移动端：当前源单列 6 条 -->
    <!-- 加载中 -->
    <div v-if="activeState.loading && activeState.items.length === 0" class="hotlist-list">
      <div v-for="i in 6" :key="i" class="hotlist-row">
        <span class="hotlist-rank skel-block" />
        <span class="hotlist-title skel-block skel-wide" />
      </div>
    </div>

    <!-- 空 / 错误 -->
    <div v-else-if="activeState.items.length === 0" class="hotlist-empty">
      <template v-if="activeState.error">
        <p>数据源暂时不可用</p>
        <button class="hotlist-retry" type="button" @click="load(active, true)">重试</button>
      </template>
      <template v-else>
        <p>暂无数据</p>
      </template>
    </div>

    <!-- 列表 -->
    <ol v-else class="hotlist-list">
      <li
        v-for="(item, idx) in activeState.items.slice(0, 6)"
        :key="idx"
        class="hotlist-row hotlist-item"
        @click="openItem(item)"
      >
        <span :class="['hotlist-rank', idx < 3 ? `hotlist-rank-${idx + 1}` : '']">
          {{ idx + 1 }}
        </span>
        <span class="hotlist-title" :title="item.title">{{ item.title }}</span>
        <span v-if="item.hot" class="hotlist-hot">{{ item.hot }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.hotlist-card {
  background: rgb(var(--surface-0));
  border-radius: 20px;
  border: 1px solid rgb(var(--border-subtle));
  box-shadow: 0 4px 20px rgb(var(--ink-950) / 0.04);
  padding: 24px 28px;
  overflow: hidden;
}

.hotlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.hotlist-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.hotlist-sub {
  font-size: 12px;
  color: rgb(var(--ink-500));
  background: rgb(var(--accent-50));
  padding: 3px 10px;
  border-radius: 999px;
}

.hotlist-update {
  font-size: 12px;
  color: rgb(var(--ink-400));
}

/* Tab 栏通用：屏幕不够时自动换行，全部 tab 可见，不依赖横向滚动 */
.hotlist-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

/* 分组切换（桌面端）：放在标题行右侧，不吃单独一行 */
.hotlist-tabs-group {
  display: none;
  margin-bottom: 0;
}

/* 源切换（移动端单列模式） */
.hotlist-tabs-source {
  display: flex;
}

@media (min-width: 768px) {
  .hotlist-tabs-group {
    display: flex;
  }
  .hotlist-tabs-source {
    display: none;
  }
}

.hotlist-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border: none;
  border-radius: 999px;
  background: rgb(var(--surface-2));
  color: rgb(var(--ink-700));
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.hotlist-tab:hover {
  color: rgb(var(--accent-600));
}
.hotlist-tab.is-active {
  background: linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--violet-500)) 100%);
  color: #fff;
  font-weight: 600;
}
.hotlist-tab-icon {
  font-size: 14px;
}

/* 桌面端三列网格：<768px 隐藏（走单列模式） */
.hotlist-grid {
  display: none;
}

@media (min-width: 768px) {
  .hotlist-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
  }
}

.hotlist-col {
  min-width: 0;
}

.hotlist-col-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 10px;
  margin-bottom: 6px;
  border-bottom: 1px solid rgb(var(--border-subtle));
}

.hotlist-col-icon {
  font-size: 16px;
}

.hotlist-col-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: rgb(var(--ink-900));
  flex: 1;
}

.hotlist-col-time {
  font-size: 11px;
  color: rgb(var(--ink-400));
  font-weight: normal;
}

.hotlist-col-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* 移动端单列列表：≥768px 隐藏（走三列网格） */
.hotlist-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 2px;
}

@media (min-width: 768px) {
  .hotlist-list {
    display: none;
  }
}

.hotlist-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 8px;
  min-width: 0;
}

.hotlist-item {
  cursor: pointer;
  transition: background 0.15s ease;
}
.hotlist-item:hover {
  background: rgb(var(--accent-50));
}
html.dark .hotlist-item:hover {
  background: rgb(var(--accent-500) / 0.12);
}

.hotlist-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: rgb(var(--ink-500));
  background: rgb(var(--surface-2));
  flex-shrink: 0;
}
.hotlist-rank-1 {
  background: linear-gradient(135deg, #ff7d4d 0%, #ff4d6a 100%);
  color: #fff;
}
.hotlist-rank-2 {
  background: linear-gradient(135deg, #ffc247 0%, #ff9f2e 100%);
  color: #fff;
}
.hotlist-rank-3 {
  background: linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--violet-500)) 100%);
  color: #fff;
}

.hotlist-title {
  flex: 1;
  font-size: 13px;
  color: rgb(var(--ink-900));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.hotlist-hot {
  flex-shrink: 0;
  font-size: 11px;
  color: rgb(var(--ink-400));
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skel-block {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgb(var(--surface-2)) 0%,
    rgb(var(--border-subtle)) 50%,
    rgb(var(--surface-2)) 100%
  );
  background-size: 200% 100%;
  animation: hotlist-shimmer 1.4s linear infinite;
}
.skel-wide { flex: 1; }
@keyframes hotlist-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.hotlist-empty {
  text-align: center;
  padding: 30px 0;
  font-size: 13px;
  color: rgb(var(--ink-500));
}
.hotlist-retry {
  margin-top: 8px;
  padding: 4px 14px;
  border-radius: 999px;
  border: 1px solid rgb(var(--accent-500));
  background: transparent;
  color: rgb(var(--accent-600));
  cursor: pointer;
  font-size: 12px;
}
.hotlist-retry:hover {
  background: rgb(var(--accent-50));
}
html.dark .hotlist-retry:hover {
  background: rgb(var(--accent-500) / 0.12);
}

/* 移动端紧凑化 */
@media (max-width: 767px) {
  .hotlist-card {
    padding: 16px;
    border-radius: 16px;
  }
  .hotlist-update {
    display: none;
  }
}
</style>

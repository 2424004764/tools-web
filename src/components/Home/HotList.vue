<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

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
  { key: 'bilibili', label: 'B站热门', icon: '📺' },
  { key: 'github', label: 'GitHub', icon: '⭐' },
  { key: 'hn', label: 'Hacker News', icon: '🌐' },
]

// 移动端默认 active tab；桌面端不使用此字段（所有列同时展示）
const active = ref<string>('toutiao')

// 每个源独立缓存，避免重渲染闪烁
const cache = ref<Record<string, SourceState>>(
  Object.fromEntries(
    SOURCES.map((s) => [
      s.key,
      { loading: false, items: [], error: '', updateTime: '' } as SourceState,
    ]),
  ),
)

// 顶部"更新于"显示最近一次任意源的时间戳
const lastUpdate = computed(() => {
  const times = Object.values(cache.value)
    .map((s) => s.updateTime)
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

// 一次性并发拉所有源（响应式布局需要同时展示）
async function loadAll() {
  await Promise.all(SOURCES.map((s) => load(s.key)))
}

function switchTab(type: string) {
  active.value = type
  load(type) // 移动端切 tab 时按需补齐
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
  loadAll()
})
</script>

<template>
  <section class="hotlist-card mt-8" aria-label="全球与全国热门信息">
    <!-- 标题行 -->
    <header class="hotlist-header">
      <div class="flex items-center gap-2">
        <h2 class="text-h3 font-bold m-0 text-ink-900">热门资讯</h2>
        <span class="hotlist-sub">全球 · 全国 · 技术圈</span>
      </div>
      <span v-if="lastUpdate" class="hotlist-update">更新于 {{ lastUpdate }}</span>
    </header>

    <!-- Tab 栏：仅 < 1024px 显示 -->
    <nav class="hotlist-tabs" role="tablist">
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

    <!-- 多列网格：< 768px 退化为单列只显示 active；≥ 768px 2 列；≥ 1024px 3 列 -->
    <div class="hotlist-grid" role="list">
      <article
        v-for="src in SOURCES"
        :key="src.key"
        class="hotlist-col"
        :class="{ 'is-active': active === src.key }"
        role="listitem"
      >
        <header class="hotlist-col-header">
          <span class="hotlist-col-icon" aria-hidden="true">{{ src.icon }}</span>
          <h3 class="hotlist-col-title">{{ src.label }}</h3>
          <span v-if="cache[src.key].updateTime" class="hotlist-col-time">
            {{ formatTime(cache[src.key].updateTime) }}
          </span>
        </header>

        <!-- 加载中 -->
        <ul v-if="cache[src.key].loading && cache[src.key].items.length === 0" class="hotlist-col-list">
          <li v-for="i in 6" :key="i" class="hotlist-col-skel">
            <span class="hotlist-rank skel-block" />
            <span class="hotlist-title skel-block skel-wide" />
          </li>
        </ul>

        <!-- 空 / 错误 -->
        <div v-else-if="cache[src.key].items.length === 0" class="hotlist-col-empty">
          <template v-if="cache[src.key].error">
            <p>数据源暂时不可用</p>
            <button class="hotlist-col-retry" type="button" @click="load(src.key, true)">重试</button>
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
            class="hotlist-col-item"
            @click="openItem(item)"
          >
            <span :class="['hotlist-rank', idx < 3 ? 'hotlist-rank-top' : '']">
              {{ idx + 1 }}
            </span>
            <span class="hotlist-title" :title="item.title">{{ item.title }}</span>
            <span v-if="item.hot" class="hotlist-hot">{{ item.hot }}</span>
          </li>
        </ol>
      </article>
    </div>
  </section>
</template>

<style scoped>
.hotlist-card {
  background: white;
  border-radius: 16px;
  border: 1px solid rgb(var(--border-default));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  padding: 20px 24px;
  overflow: hidden;
}

.hotlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}

.hotlist-sub {
  font-size: 12px;
  color: rgb(var(--ink-500));
  background: rgb(var(--accent-50));
  padding: 2px 8px;
  border-radius: 999px;
}

.hotlist-update {
  font-size: 12px;
  color: rgb(var(--ink-500));
}

/* Tab 栏：< 768px 时显示，≥ 768px 隐藏（768px+ 进入 2 列/3 列网格模式，不再需要 tab 切换） */
.hotlist-tabs {
  display: flex;
  flex-wrap: wrap; /* 屏幕不够时自动换行，5 个 tab 全部可见，不依赖横向滚动 */
  gap: 6px;
  border-bottom: 1px solid rgb(var(--border-subtle));
  margin-bottom: 12px;
}

@media (min-width: 768px) {
  .hotlist-tabs {
    display: none;
  }
}

.hotlist-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
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
  color: rgb(var(--accent-600));
  border-bottom-color: rgb(var(--accent-500));
  font-weight: 600;
}
.hotlist-tab-icon {
  font-size: 14px;
}

/* 网格布局 */
.hotlist-grid {
  display: block; /* < 768px：单列，仅 .is-active 显示 */
}

.hotlist-col {
  display: none; /* < 768px：默认隐藏 */
  min-width: 0;
}

.hotlist-col.is-active {
  display: block; /* < 768px：active 列显示 */
}

@media (min-width: 768px) {
  .hotlist-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .hotlist-col {
    display: flex !important; /* 覆盖 .is-active display: block */
    flex-direction: column;
  }
}

@media (min-width: 1024px) {
  .hotlist-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
}

/* 列内容 */
.hotlist-col-header {
  display: none; /* < 768px 单列模式下隐藏（与 tab 标题重复） */
}

@media (min-width: 768px) {
  .hotlist-col-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid rgb(var(--border-subtle));
  }
}

.hotlist-col-icon {
  font-size: 16px;
}

.hotlist-col-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--ink-900));
  flex: 1;
}

.hotlist-col-time {
  font-size: 11px;
  color: rgb(var(--ink-500));
  font-weight: normal;
}

.hotlist-col-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.hotlist-col-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.hotlist-col-item:hover {
  background: rgb(var(--accent-50));
}

.hotlist-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--ink-600));
  background: rgb(var(--surface-2));
  flex-shrink: 0;
}
.hotlist-rank-top {
  background: rgb(var(--accent-500));
  color: white;
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
  color: rgb(var(--ink-500));
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hotlist-col-skel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 6px;
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

.hotlist-col-empty {
  text-align: center;
  padding: 30px 0;
  font-size: 13px;
  color: rgb(var(--ink-500));
}
.hotlist-col-retry {
  margin-top: 8px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid rgb(var(--accent-500));
  background: white;
  color: rgb(var(--accent-600));
  cursor: pointer;
  font-size: 12px;
}
.hotlist-col-retry:hover {
  background: rgb(var(--accent-50));
}

/* 移动端紧凑化 */
@media (max-width: 767px) {
  .hotlist-card {
    padding: 16px;
  }
  .hotlist-update {
    display: none;
  }
}
</style>
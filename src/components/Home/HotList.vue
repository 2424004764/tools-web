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
      <span v-if="lastUpdate" class="hotlist-update">更新于 {{ lastUpdate }}</span>
    </header>

    <!-- Tab 栏：仅 < 768px 显示 -->
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

    <!-- 多列网格：< 768px 单列只显示 active；≥ 768px 2 列；≥ 1280px 3 列源 + 右侧装饰面板 -->
    <div class="hotlist-grid" role="list">
      <article
        v-for="src in SOURCES.slice(0, 3)"
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
            <span :class="['hotlist-rank', idx < 3 ? `hotlist-rank-${idx + 1}` : '']">
              {{ idx + 1 }}
            </span>
            <span class="hotlist-title" :title="item.title">{{ item.title }}</span>
            <span v-if="item.hot" class="hotlist-hot">{{ item.hot }}</span>
          </li>
        </ol>
      </article>

      <!-- 装饰面板：仅 ≥1280px 显示，跨两行占最右列 -->
      <div class="hotlist-deco" aria-hidden="true">
        <span class="hotlist-deco-ring"></span>
        <span class="hotlist-deco-ring hotlist-deco-ring-sm"></span>
        <div class="hotlist-deco-glass">
          <IconLightning class="w-8 h-8" />
        </div>
      </div>

      <!-- 第 4 个及之后的源（768-1280px 补齐 2x2；≥1280px 换行到第二行） -->
      <article
        v-for="src in SOURCES.slice(3)"
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

        <ul v-if="cache[src.key].loading && cache[src.key].items.length === 0" class="hotlist-col-list">
          <li v-for="i in 6" :key="i" class="hotlist-col-skel">
            <span class="hotlist-rank skel-block" />
            <span class="hotlist-title skel-block skel-wide" />
          </li>
        </ul>

        <div v-else-if="cache[src.key].items.length === 0" class="hotlist-col-empty">
          <template v-if="cache[src.key].error">
            <p>数据源暂时不可用</p>
            <button class="hotlist-col-retry" type="button" @click="load(src.key, true)">重试</button>
          </template>
          <template v-else>
            <p>暂无数据</p>
          </template>
        </div>

        <ol v-else class="hotlist-col-list">
          <li
            v-for="(item, idx) in cache[src.key].items.slice(0, 6)"
            :key="idx"
            class="hotlist-col-item"
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
  margin-bottom: 18px;
  flex-wrap: wrap;
  gap: 8px;
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

/* Tab 栏：< 768px 时显示，≥ 768px 隐藏（768px+ 进入多列网格模式，不再需要 tab 切换） */
.hotlist-tabs {
  display: flex;
  flex-wrap: wrap; /* 屏幕不够时自动换行，全部 tab 可见，不依赖横向滚动 */
  gap: 6px;
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

/* 网格布局：< 768px 单列（仅 active），≥ 768px 2 列，≥ 1280px 3 列源 + 装饰列 */
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

@media (min-width: 1280px) {
  .hotlist-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 0.85fr);
    gap: 20px;
  }
}

/* 装饰面板 */
.hotlist-deco {
  display: none;
}
@media (min-width: 1280px) {
  .hotlist-deco {
    display: flex;
    align-items: center;
    justify-content: center;
    grid-row: span 2;
    position: relative;
    border-radius: 20px;
    background: linear-gradient(
      135deg,
      rgb(var(--accent-100)) 0%,
      rgb(var(--accent-50)) 45%,
      rgb(var(--violet-100)) 100%
    );
    overflow: hidden;
    min-height: 260px;
  }
}
.hotlist-deco-ring {
  position: absolute;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  border: 1.5px solid rgb(255 255 255 / 0.65);
  right: -70px;
  top: -70px;
}
.hotlist-deco-ring-sm {
  width: 170px;
  height: 170px;
  right: -25px;
  top: -25px;
  border-color: rgb(255 255 255 / 0.5);
}
.hotlist-deco-glass {
  width: 92px;
  height: 92px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--accent-600));
  background: rgb(255 255 255 / 0.75);
  border: 1px solid rgb(255 255 255 / 0.9);
  box-shadow: 0 12px 32px rgb(var(--accent-500) / 0.18);
  backdrop-filter: blur(6px);
  transform: rotate(-6deg);
}
html.dark .hotlist-deco {
  background: linear-gradient(
    135deg,
    rgb(var(--accent-500) / 0.18) 0%,
    rgb(var(--violet-500) / 0.16) 100%
  );
}
html.dark .hotlist-deco-ring {
  border-color: rgb(var(--accent-300) / 0.25);
}
html.dark .hotlist-deco-ring-sm {
  border-color: rgb(var(--accent-300) / 0.18);
}
html.dark .hotlist-deco-glass {
  background: rgb(var(--surface-0) / 0.7);
  border-color: rgb(var(--accent-300) / 0.3);
}

/* 列内容 */
.hotlist-col-header {
  display: none; /* < 768px 单列模式下隐藏（与 tab 标题重复） */
}

@media (min-width: 768px) {
  .hotlist-col-header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding-bottom: 10px;
    margin-bottom: 6px;
    border-bottom: 1px solid rgb(var(--border-subtle));
  }
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

.hotlist-col-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.hotlist-col-item:hover {
  background: rgb(var(--accent-50));
}
html.dark .hotlist-col-item:hover {
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

.hotlist-col-skel {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
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
  padding: 4px 14px;
  border-radius: 999px;
  border: 1px solid rgb(var(--accent-500));
  background: transparent;
  color: rgb(var(--accent-600));
  cursor: pointer;
  font-size: 12px;
}
.hotlist-col-retry:hover {
  background: rgb(var(--accent-50));
}
html.dark .hotlist-col-retry:hover {
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

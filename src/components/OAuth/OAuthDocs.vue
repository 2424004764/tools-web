<script setup lang="ts">
// OAuth2 子站接入文档（公开页，供接入方在线查阅）
// 独立于站点框架渲染（App.vue 对 oauthDocs 路由跳过 Header/分类栏/评论）：
// 左侧为文档目录（桌面端 sticky 侧栏，移动端收进抽屉）。
// 内容单一来源：docs/oauth-provider.md，构建时以 ?raw 内联，避免两份文案不同步
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { renderMarkdownWithToc } from '@/components/Blog/blog-markdown'
import docSource from '../../../docs/oauth-provider.md?raw'

const { html, toc } = renderMarkdownWithToc(docSource)

// ---------- 目录交互 ----------
const activeId = ref('')
const drawerOpen = ref(false)

const jumpTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
  drawerOpen.value = false
}

// 滚动高亮：取视口顶部以下最近的一个标题
let ticking = false
const onScroll = () => {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    let current = ''
    for (const item of toc) {
      const el = document.getElementById(item.id)
      if (!el) continue
      if (el.getBoundingClientRect().top <= 110) current = item.id
      else break
    }
    activeId.value = current
  })
}

onMounted(() => {
  nextTick(() => {
    // 支持 #锚点 直达（如外部链接带 hash 打开）
    const initial = location.hash.slice(1)
    if (initial && document.getElementById(initial)) {
      document.getElementById(initial)!.scrollIntoView({ block: 'start' })
    }
    onScroll()
  })
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div class="min-h-screen bg-surface-1 flex flex-col">
    <!-- 顶部条：品牌 + 文档名 + 返回（无搜索框） -->
    <header class="sticky top-0 z-40 bg-surface-0 border-b border-border-subtle">
      <div class="max-w-[1180px] mx-auto px-4 h-14 flex items-center gap-2">
        <a href="/" class="flex items-center gap-1.5 text-body-sm font-semibold text-ink-800 hover:text-accent-600 transition-colors">
          一方工具箱
        </a>
        <span class="text-ink-300 select-none">/</span>
        <span class="text-body-sm text-ink-500 truncate">OAuth2 接入文档</span>
        <button
          type="button"
          class="c-md:hidden ml-auto h-8 px-3 rounded-lg border border-border-subtle text-body-sm text-ink-600 hover:bg-surface-2 transition-colors flex items-center gap-1"
          @click="drawerOpen = true"
        >
          目录
        </button>
        <a
          href="/"
          class="hidden c-md:inline-flex ml-auto h-8 px-3 rounded-lg bg-accent-500 text-white text-body-sm font-medium hover:bg-accent-600 transition-colors items-center"
        >
          返回工具站
        </a>
      </div>
    </header>

    <div class="max-w-[1180px] w-full mx-auto px-4 py-6 md:py-8 flex gap-8 items-start flex-1">
      <!-- 左侧目录（桌面端） -->
      <aside class="hidden c-md:block w-56 shrink-0 sticky top-[72px] max-h-[calc(100vh-96px)] overflow-y-auto pb-4">
        <div class="text-caption font-medium text-ink-400 mb-2 px-3">目录</div>
        <nav>
          <a
            v-for="item in toc"
            :key="item.id"
            :href="`#${item.id}`"
            class="block py-1.5 pr-3 rounded-lg text-body-sm leading-snug transition-colors"
            :class="[
              item.level === 3 ? 'pl-7' : 'pl-3 font-medium',
              activeId === item.id ? 'text-accent-600 bg-accent-100' : 'text-ink-600 hover:text-ink-900 hover:bg-surface-2',
            ]"
            @click.prevent="jumpTo(item.id)"
          >{{ item.text }}</a>
        </nav>
      </aside>

      <!-- 正文 -->
      <article class="flex-1 min-w-0 bg-surface-0 border border-border-subtle rounded-2xl px-5 md:px-10 py-8 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.08)]">
        <div class="doc-markdown" v-html="html"></div>
      </article>
    </div>

    <!-- 左侧目录（移动端抽屉） -->
    <el-drawer v-model="drawerOpen" size="260px" direction="ltr" :with-header="false" :lock-scroll="false">
      <div class="h-full overflow-y-auto py-2">
        <div class="text-caption font-medium text-ink-400 mb-2 px-3">目录</div>
        <nav>
          <a
            v-for="item in toc"
            :key="item.id"
            :href="`#${item.id}`"
            class="block py-1.5 pr-3 rounded-lg text-body-sm leading-snug transition-colors"
            :class="[
              item.level === 3 ? 'pl-7' : 'pl-3 font-medium',
              activeId === item.id ? 'text-accent-600 bg-accent-100' : 'text-ink-600 hover:bg-surface-2',
            ]"
            @click.prevent="jumpTo(item.id)"
          >{{ item.text }}</a>
        </nav>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.doc-markdown {
  color: rgb(var(--ink-700));
  font-size: 14.5px;
  line-height: 1.75;
  word-break: break-word;
}
.doc-markdown :deep(h1),
.doc-markdown :deep(h2),
.doc-markdown :deep(h3),
.doc-markdown :deep(h4) {
  color: rgb(var(--ink-900));
  font-weight: 600;
  margin: 1.4em 0 0.6em;
  line-height: 1.35;
  scroll-margin-top: 76px;
}
.doc-markdown :deep(h1) {
  font-size: 1.5em;
  margin-top: 0;
  padding-bottom: 0.4em;
  border-bottom: 1px solid rgb(var(--border-subtle));
}
.doc-markdown :deep(h2) {
  font-size: 1.25em;
}
.doc-markdown :deep(h3) {
  font-size: 1.1em;
}
.doc-markdown :deep(h4) {
  font-size: 1em;
}
.doc-markdown :deep(p) {
  margin: 0.85em 0;
}
.doc-markdown :deep(a) {
  color: rgb(var(--accent-600));
  text-decoration: none;
}
.doc-markdown :deep(a:hover) {
  text-decoration: underline;
}
.doc-markdown :deep(ul),
.doc-markdown :deep(ol) {
  padding-left: 1.5em;
  margin: 0.85em 0;
}
.doc-markdown :deep(ul) {
  list-style: disc;
}
.doc-markdown :deep(ol) {
  list-style: decimal;
}
.doc-markdown :deep(li) {
  margin: 0.3em 0;
}
.doc-markdown :deep(li > ul),
.doc-markdown :deep(li > ol) {
  margin: 0.3em 0;
}
.doc-markdown :deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 3px solid rgb(var(--accent-400));
  background: rgb(var(--surface-1));
  border-radius: 0 8px 8px 0;
  color: rgb(var(--ink-600));
}
.doc-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875em;
  background: rgb(var(--surface-2));
  padding: 0.15em 0.4em;
  border-radius: 5px;
  color: rgb(var(--accent-700));
}
html.dark .doc-markdown :deep(code) {
  color: rgb(var(--accent-300));
}
.doc-markdown :deep(pre) {
  margin: 1em 0;
  padding: 14px 16px;
  background: rgb(var(--surface-2));
  border: 1px solid rgb(var(--border-subtle));
  border-radius: 10px;
  overflow-x: auto;
  line-height: 1.6;
}
.doc-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  color: rgb(var(--ink-800));
  font-size: 13px;
}
html.dark .doc-markdown :deep(pre code) {
  color: rgb(var(--ink-300));
}
.doc-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 13.5px;
  display: block;
  overflow-x: auto;
}
.doc-markdown :deep(th),
.doc-markdown :deep(td) {
  border: 1px solid rgb(var(--border-subtle));
  padding: 7px 12px;
  text-align: left;
}
.doc-markdown :deep(th) {
  background: rgb(var(--surface-1));
  font-weight: 600;
  color: rgb(var(--ink-800));
  white-space: nowrap;
}
.doc-markdown :deep(hr) {
  border: none;
  border-top: 1px solid rgb(var(--border-subtle));
  margin: 1.6em 0;
}
.doc-markdown :deep(img) {
  max-width: 100%;
}
</style>

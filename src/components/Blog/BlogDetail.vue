<script setup lang="ts">
// 博客详情页：Markdown 正文渲染 + 相关工具推荐（引流位）+ 标签
// 评论区由 App.vue 的全局 Discuss 自动挂载（page_path = /blog/<slug>）
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchBlogPost, type BlogPost } from '@/api/blog'
import { renderMarkdown } from './blog-markdown'
import { useToolsStore } from '@/store/modules/tools'
import { functionsRequest } from '@/utils/functionsRequest'
import type { ToolsInfo } from '@/components/Tools/tools.type'
import View from '~icons/ep/view'
import Back from '~icons/ep/back'
import magicStick from '~icons/ep/magic-stick'

const route = useRoute()
const router = useRouter()
const toolsStore = useToolsStore()

const loading = ref(true)
const notFound = ref(false)
const post = ref<BlogPost | null>(null)

const html = computed(() => (post.value ? renderMarkdown(post.value.content) : ''))

const tagsOf = computed(() =>
  String(post.value?.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
)

const formatDate = (value: string | null) => (value ? String(value).slice(0, 10) : '')

const avatarBg = (name: string) => {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${hash}, 65%, 55%)`
}

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/blog')
}

// ---- 相关工具（引流推荐位） ----
const relatedTools = ref<ToolsInfo[]>([])

const normalizeUrl = (u: string) => (u !== '/' && u.endsWith('/') ? u.slice(0, -1) : u)

// related_tools 有值：从工具库按 url 匹配（保证只有站内启用工具）；
// 为空：回退展示热门工具（/api/tools/hot），同样是引流位
const loadRelatedTools = async () => {
  relatedTools.value = []
  const urls = String(post.value?.related_tools || '')
    .split(',')
    .map((u) => normalizeUrl(u.trim()))
    .filter(Boolean)

  if (urls.length) {
    if (!toolsStore.list.length) {
      try {
        await toolsStore.loadToolsFromApi()
      } catch {
        /* store 内部有兜底 */
      }
    }
    const matched = urls
      .map((u) => toolsStore.list.find((t) => normalizeUrl(t.url || '') === u))
      .filter((t): t is ToolsInfo => !!t)
    if (matched.length) {
      relatedTools.value = matched.slice(0, 6)
      return
    }
  }

  // 回退：热门工具 Top 6
  try {
    const res = await functionsRequest.get('/api/tools/hot')
    const list: ToolsInfo[] = res.data?.data || []
    relatedTools.value = list
      .filter((t) => normalizeUrl(t.url || '') !== normalizeUrl(route.path))
      .slice(0, 6)
  } catch (e) {
    console.error('load hot tools for blog failed:', e)
  }
}

const openTool = (tool: ToolsInfo) => {
  if (!tool.url) return
  if (/^https?:/.test(tool.url)) window.open(tool.url, '_blank', 'noopener,noreferrer')
  else router.push(tool.url)
}

const load = async () => {
  const slug = String(route.params.slug || '')
  loading.value = true
  notFound.value = false
  post.value = null
  try {
    post.value = await fetchBlogPost(slug)
    document.title = `${post.value.title} | 博客`
    await loadRelatedTools()
  } catch (e: any) {
    // 404/其它错误统一按未找到处理
    notFound.value = true
  } finally {
    loading.value = false
  }
}

watch(() => route.params.slug, (nv, ov) => {
  if (nv && nv !== ov && route.path.startsWith('/blog/')) load()
})

onMounted(load)
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 pt-6 pb-2 w-full">
    <!-- 加载中 -->
    <div v-if="loading" class="mt-16 text-center text-sm text-ink-400">加载中…</div>

    <!-- 未找到 -->
    <div v-else-if="notFound || !post" class="mt-16 text-center">
      <p class="text-ink-500 dark:text-ink-400 text-sm">文章不存在或未发布</p>
      <el-button class="mt-4" @click="goBack">返回博客列表</el-button>
    </div>

    <template v-else>
      <article class="rounded-2xl border border-border-subtle bg-white dark:bg-surface-1 px-6 md:px-10 py-8">
        <!-- 标题与元信息 -->
        <h1 class="text-2xl md:text-3xl font-bold text-ink-900 dark:text-ink-100 leading-snug m-0">
          {{ post.title }}
        </h1>
        <div class="mt-4 flex items-center gap-2.5 flex-wrap text-xs text-ink-400">
          <img
            v-if="post.author_avatar"
            :src="post.author_avatar"
            :alt="post.author_name"
            class="w-7 h-7 rounded-full object-cover"
          />
          <span
            v-else
            class="w-7 h-7 rounded-full text-white text-xs flex items-center justify-center shrink-0"
            :style="{ background: avatarBg(post.author_name || '客') }"
          >
            {{ (post.author_name || '客').slice(0, 1) }}
          </span>
          <span class="text-sm text-ink-700 dark:text-ink-200">{{ post.author_name }}</span>
          <span
            v-if="post.author_type === 'admin'"
            class="px-1.5 py-px rounded bg-accent-100 dark:bg-accent-500/20 text-accent-700 dark:text-accent-300 text-[10px] font-medium"
          >
            站长
          </span>
          <span class="inline-flex items-center gap-1">
            <View class="w-3.5 h-3.5" aria-hidden="true" />
            {{ post.views }}
          </span>
          <span>发布于 {{ formatDate(post.published_at) }}</span>
        </div>

        <!-- 标签 -->
        <div v-if="tagsOf.length" class="mt-3 flex items-center gap-1.5 flex-wrap">
          <router-link
            v-for="tag in tagsOf"
            :key="tag"
            to="/blog"
            class="px-2 py-0.5 rounded-md bg-surface-2 dark:bg-surface-3 text-[11px] text-ink-500 dark:text-ink-400 no-underline hover:text-accent-600 transition-colors"
          >
            # {{ tag }}
          </router-link>
        </div>

        <!-- 封面 -->
        <img
          v-if="post.cover"
          :src="post.cover"
          :alt="post.title"
          class="mt-5 w-full max-h-96 object-cover rounded-xl"
        />

        <!-- 正文（markdown-it html:false 渲染，原生 HTML 已转义） -->
        <div class="blog-markdown mt-6" v-html="html"></div>
      </article>

      <!-- 相关工具推荐（引流位） -->
      <section
        v-if="relatedTools.length"
        class="mt-6 rounded-2xl border border-border-subtle bg-white dark:bg-surface-1 p-5"
        aria-label="相关工具推荐"
      >
        <div class="flex items-center gap-2 mb-4">
          <span
            class="w-7 h-7 rounded-full bg-brand-gradient text-white flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <magicStick class="w-4 h-4" />
          </span>
          <h2 class="text-base font-bold text-ink-900 dark:text-ink-100 m-0">
            {{ post?.related_tools ? '文中相关工具' : '热门工具推荐' }}
          </h2>
          <span class="text-xs text-ink-400">在线免费用</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            v-for="tool in relatedTools"
            :key="tool.url"
            type="button"
            class="flex items-center gap-3 p-3 rounded-xl border border-border-subtle bg-white dark:bg-surface-2 border-0 cursor-pointer text-left hover:border-accent-400 hover:shadow-md hover:shadow-accent-500/10 transition-all duration-150"
            @click="openTool(tool)"
          >
            <img
              v-if="tool.logo"
              :src="tool.logo"
              :alt="tool.title"
              loading="lazy"
              class="w-9 h-9 rounded-lg object-contain shrink-0"
            />
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                {{ tool.title }}
              </div>
              <div class="text-xs text-ink-400 truncate mt-0.5">
                {{ tool.desc || '免费在线使用' }}
              </div>
            </div>
          </button>
        </div>
      </section>

      <!-- 返回列表 -->
      <div class="mt-6 mb-2 text-center">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-sm border border-border-subtle bg-white dark:bg-surface-1 text-ink-600 dark:text-ink-300 border-0 cursor-pointer hover:border-accent-400 hover:text-accent-600 transition-colors"
          @click="goBack"
        >
          <Back class="w-4 h-4" aria-hidden="true" />
          返回博客列表
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Markdown 正文排版：全部走设计 token，暗色模式自动适配 */
.blog-markdown {
  color: rgb(var(--ink-800));
  font-size: 15px;
  line-height: 1.85;
  word-break: break-word;
}
.blog-markdown :deep(h1),
.blog-markdown :deep(h2),
.blog-markdown :deep(h3),
.blog-markdown :deep(h4) {
  color: rgb(var(--ink-900));
  font-weight: 700;
  line-height: 1.4;
  margin: 1.6em 0 0.7em;
}
html.dark .blog-markdown :deep(h1),
html.dark .blog-markdown :deep(h2),
html.dark .blog-markdown :deep(h3),
html.dark .blog-markdown :deep(h4) {
  color: rgb(var(--ink-100));
}
.blog-markdown :deep(h1) { font-size: 1.5em; }
.blog-markdown :deep(h2) { font-size: 1.3em; }
.blog-markdown :deep(h3) { font-size: 1.15em; }
.blog-markdown :deep(h4) { font-size: 1.05em; }
.blog-markdown :deep(p) { margin: 0.9em 0; }
.blog-markdown :deep(a) {
  color: rgb(var(--accent-600));
  text-decoration: none;
  border-bottom: 1px solid rgb(var(--accent-300));
}
.blog-markdown :deep(a:hover) {
  color: rgb(var(--accent-500));
  border-bottom-color: rgb(var(--accent-500));
}
html.dark .blog-markdown :deep(a) { color: rgb(var(--accent-300)); }
.blog-markdown :deep(ul),
.blog-markdown :deep(ol) {
  padding-left: 1.5em;
  margin: 0.9em 0;
}
.blog-markdown :deep(ul) { list-style: disc; }
.blog-markdown :deep(ol) { list-style: decimal; }
.blog-markdown :deep(li) { margin: 0.35em 0; }
.blog-markdown :deep(blockquote) {
  margin: 1.1em 0;
  padding: 0.6em 1em;
  border-left: 3px solid rgb(var(--accent-400));
  background: rgb(var(--accent-50));
  border-radius: 0 8px 8px 0;
  color: rgb(var(--ink-600));
}
html.dark .blog-markdown :deep(blockquote) {
  background: rgb(var(--accent-500) / 0.1);
  color: rgb(var(--ink-300));
}
.blog-markdown :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88em;
  background: rgb(var(--surface-2));
  border: 1px solid rgb(var(--border-subtle));
  border-radius: 5px;
  padding: 0.15em 0.4em;
}
.blog-markdown :deep(pre) {
  margin: 1.1em 0;
  padding: 1em 1.2em;
  background: rgb(var(--surface-2));
  border: 1px solid rgb(var(--border-subtle));
  border-radius: 10px;
  overflow-x: auto;
  line-height: 1.6;
}
.blog-markdown :deep(pre code) {
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 0.88em;
}
.blog-markdown :deep(img) {
  max-width: 100%;
  border-radius: 10px;
  margin: 1em auto;
  display: block;
}
.blog-markdown :deep(hr) {
  border: 0;
  border-top: 1px solid rgb(var(--border-subtle));
  margin: 2em 0;
}
.blog-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1.1em 0;
  font-size: 0.92em;
  display: block;
  overflow-x: auto;
}
.blog-markdown :deep(th),
.blog-markdown :deep(td) {
  border: 1px solid rgb(var(--border-subtle));
  padding: 0.5em 0.85em;
  text-align: left;
}
.blog-markdown :deep(th) {
  background: rgb(var(--surface-2));
  font-weight: 600;
  color: rgb(var(--ink-900));
}
</style>

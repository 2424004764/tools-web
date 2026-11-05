<script setup lang="ts">
// 博客列表页：文章卡片流 + 标签筛选 + 关键词搜索 + 加载更多
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchBlogPosts, fetchMyBlogPosts, type BlogHotTag, type BlogPostItem, type MyBlogPost } from '@/api/blog'
import { useUserStore } from '@/store/modules/user'
import EditPen from '~icons/ep/edit-pen'
import View from '~icons/ep/view'
import Search from '~icons/ep/search'
import Loading from '~icons/ep/loading'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const myPostsLoading = ref(false)
const myPostsLoaded = ref(false)
const myPosts = ref<MyBlogPost[]>([])
const viewMode = ref<'public' | 'mine'>('public')
const list = ref<BlogPostItem[]>([])
const hotTags = ref<BlogHotTag[]>([])
const activeTag = ref('')
const keyword = ref('')
const searchInput = ref('')
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const loadedOnce = ref(false)

// 卡片摘要：列表接口无正文，直接用后端摘要截断展示
const summaryText = (item: BlogPostItem) => (item.summary || '点击阅读全文').slice(0, 140)

const tagsOf = (item: BlogPostItem) =>
  String(item.tags || '').split(',').map((t) => t.trim()).filter(Boolean)

const formatDate = (value: string | null) => (value ? String(value).slice(0, 10) : '')

const myPostSummary = (item: MyBlogPost) => {
  if (item.summary) return item.summary
  if (item.status === 'pending') return '内容已提交，正在审核中'
  if (item.status === 'rejected') return '暂无摘要，可编辑后重新提交审核'
  if (item.status === 'draft') return '草稿尚未提交，可继续编辑并提交审核'
  return '暂无摘要'
}

const statusLabels: Record<MyBlogPost['status'], string> = {
  draft: '草稿',
  pending: '审核中',
  published: '已发布',
  rejected: '未通过',
}

const statusClasses: Record<MyBlogPost['status'], string> = {
  draft: 'bg-surface-2 text-ink-500 dark:text-ink-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const loadMyPosts = async () => {
  if (!isLoggedIn.value || myPostsLoading.value || myPostsLoaded.value) return
  myPostsLoading.value = true
  try {
    myPosts.value = await fetchMyBlogPosts()
    myPostsLoaded.value = true
  } catch (e) {
    console.error('load my blog posts failed:', e)
    myPosts.value = []
  } finally {
    myPostsLoading.value = false
  }
}

const openMine = async () => {
  if (!isLoggedIn.value) {
    router.push({ path: '/login', query: { redirect: '/blog' } })
    return
  }
  viewMode.value = 'mine'
  await loadMyPosts()
}

const showPublicPosts = () => {
  viewMode.value = 'public'
}

const editMyPost = (post: MyBlogPost) => {
  router.push({ path: '/blog/write', query: { id: post.id } })
}

const openMyPublishedPost = (post: MyBlogPost) => {
  if (post.status === 'published') router.push(`/blog/${post.slug}`)
}

const avatarBg = (name: string) => {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${hash}, 65%, 55%)`
}

const isLoggedIn = computed(() => userStore.getLoginStatus)

if (isLoggedIn.value) loadMyPosts()

const goWrite = () => {
  if (isLoggedIn.value) {
    router.push('/blog/write')
  } else {
    router.push({ path: '/login', query: { redirect: '/blog/write' } })
  }
}

const load = async (append = false) => {
  loading.value = true
  try {
    const res = await fetchBlogPosts({
      page: page.value,
      pageSize: 12,
      tag: activeTag.value || undefined,
      keyword: keyword.value || undefined,
    })
    list.value = append ? [...list.value, ...res.list] : res.list
    hotTags.value = res.hotTags || []
    total.value = res.pagination.total
    totalPages.value = res.pagination.totalPages
    loadedOnce.value = true
  } catch (e) {
    console.error('load blog posts failed:', e)
    if (!append) list.value = []
  } finally {
    loading.value = false
  }
}

const reload = () => {
  page.value = 1
  load(false)
}

const toggleTag = (tag: string) => {
  activeTag.value = activeTag.value === tag ? '' : tag
  reload()
}

const handleSearch = () => {
  keyword.value = searchInput.value.trim()
  reload()
}

const loadMore = () => {
  if (page.value >= totalPages.value || loading.value) return
  page.value += 1
  load(true)
}

const goDetail = (item: BlogPostItem) => router.push(`/blog/${item.slug}`)

onMounted(reload)
</script>

<template>
  <div class="w-full px-4 md:px-6 pt-6 pb-2">
    <!-- 页头 -->
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-ink-900 dark:text-ink-100">博客</h1>
          <span v-if="loadedOnce" class="text-sm text-ink-400">{{ total }} 篇</span>
        </div>
        <p class="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
          技巧、教程与工具使用心得，学以致用
        </p>
      </div>
      <div class="ml-auto flex items-center justify-end gap-3 shrink-0">
        <button
          v-if="isLoggedIn"
          type="button"
          class="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border-subtle bg-white dark:bg-surface-1 text-sm text-ink-600 dark:text-ink-300 cursor-pointer hover:border-accent-400 hover:text-accent-600 transition-colors"
          @click="openMine"
        >
          我的投稿
          <span v-if="myPostsLoaded" class="text-xs opacity-65">{{ myPosts.length }}</span>
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-gradient text-white text-sm font-medium shadow-md shadow-accent-500/25 border-0 cursor-pointer hover:opacity-90 transition-opacity"
          @click="goWrite"
        >
          <EditPen class="w-4 h-4" aria-hidden="true" />
          <span>写文章</span>
        </button>
      </div>
    </div>

    <template v-if="viewMode === 'public'">
    <!-- 标签筛选 + 搜索 -->
    <div class="mt-5 flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        <button
          type="button"
          class="h-7 px-3 rounded-full text-xs border cursor-pointer transition-colors duration-150"
          :class="
            !activeTag
              ? 'bg-brand-gradient text-white border-transparent font-medium'
              : 'bg-white dark:bg-surface-2 text-ink-600 dark:text-ink-300 border-border-subtle hover:border-accent-400 hover:text-accent-600'
          "
          @click="toggleTag('')"
        >
          全部
        </button>
        <button
          v-for="hot in hotTags"
          :key="hot.tag"
          type="button"
          class="h-7 px-3 rounded-full text-xs border cursor-pointer transition-colors duration-150"
          :class="
            activeTag === hot.tag
              ? 'bg-brand-gradient text-white border-transparent font-medium'
              : 'bg-white dark:bg-surface-2 text-ink-600 dark:text-ink-300 border-border-subtle hover:border-accent-400 hover:text-accent-600'
          "
          @click="toggleTag(hot.tag)"
        >
          {{ hot.tag }}
          <span class="opacity-60 ml-0.5">{{ hot.count }}</span>
        </button>
      </div>
      <el-input
        v-model="searchInput"
        placeholder="搜索文章标题 / 摘要"
        clearable
        class="!w-56"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      >
        <template #suffix>
          <Search
            class="w-4 h-4 text-ink-400 cursor-pointer hover:text-accent-600 transition-colors"
            @click="handleSearch"
          />
        </template>
      </el-input>
    </div>

    <!-- 文章卡片列表 -->
    <div v-if="list.length" class="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
      <article
        v-for="item in list"
        :key="item.id"
        class="group flex flex-col rounded-xl border border-border-subtle bg-white dark:bg-surface-1 overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-ink-950/5 hover:border-accent-300 dark:hover:border-accent-500/50 transition-all duration-200"
        @click="goDetail(item)"
      >
        <div
          v-if="item.cover"
          class="h-40 overflow-hidden bg-surface-2 shrink-0"
        >
          <img
            :src="item.cover"
            :alt="item.title"
            loading="lazy"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div class="flex flex-col flex-1 p-4">
          <h2 class="text-base font-semibold text-ink-900 dark:text-ink-100 leading-snug line-clamp-2 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
            {{ item.title }}
          </h2>
          <p class="mt-2 text-sm text-ink-500 dark:text-ink-400 leading-relaxed line-clamp-2 flex-1">
            {{ summaryText(item) }}
          </p>
          <div class="mt-3 flex items-center gap-2 text-xs text-ink-400">
            <img
              v-if="item.author_avatar"
              :src="item.author_avatar"
              :alt="item.author_name"
              loading="lazy"
              class="w-5 h-5 rounded-full object-cover"
            />
            <span
              v-else
              class="w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center shrink-0"
              :style="{ background: avatarBg(item.author_name || '客') }"
            >
              {{ (item.author_name || '客').slice(0, 1) }}
            </span>
            <span class="text-ink-600 dark:text-ink-300 truncate max-w-[120px]">{{ item.author_name }}</span>
            <span
              v-if="item.author_type === 'admin'"
              class="px-1.5 py-px rounded bg-accent-100 dark:bg-accent-500/20 text-accent-700 dark:text-accent-300 text-[10px] font-medium shrink-0"
            >
              站长
            </span>
            <span class="ml-auto inline-flex items-center gap-1 shrink-0" :title="`发布于 ${formatDate(item.published_at)}`">
              <View class="w-3.5 h-3.5" aria-hidden="true" />
              {{ item.views }}
            </span>
            <span class="shrink-0">{{ formatDate(item.published_at) }}</span>
          </div>
          <div v-if="tagsOf(item).length" class="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span
              v-for="tag in tagsOf(item).slice(0, 4)"
              :key="tag"
              class="px-2 py-0.5 rounded-md bg-surface-2 dark:bg-surface-3 text-[11px] text-ink-500 dark:text-ink-400"
            >
              # {{ tag }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <!-- 空状态 / 加载中 -->
    <div v-if="!list.length && loading" class="mt-16 flex items-center justify-center gap-2 text-sm text-ink-400">
      <Loading class="w-4 h-4 animate-spin" aria-hidden="true" />
      加载中…
    </div>
    <el-empty
      v-else-if="!list.length && loadedOnce"
      :description="activeTag || keyword ? '没有符合条件的文章' : '还没有文章，快来写第一篇吧'"
      class="mt-16"
    >
      <el-button v-if="activeTag || keyword" @click="toggleTag(''); keyword = ''; searchInput = ''">
        清除筛选
      </el-button>
    </el-empty>

    <!-- 加载更多 -->
    <div v-if="list.length && page < totalPages" class="mt-6 text-center pb-2">
      <button
        type="button"
        :disabled="loading"
        class="h-9 px-6 rounded-full text-sm border border-border-subtle bg-white dark:bg-surface-1 text-ink-600 dark:text-ink-300 cursor-pointer hover:border-accent-400 hover:text-accent-600 disabled:opacity-60 transition-colors"
        @click="loadMore"
      >
        {{ loading ? '加载中…' : `加载更多（共 ${total} 篇）` }}
      </button>
    </div>
    </template>

    <section v-else class="mt-5">
      <div class="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3">
          <h2 class="m-0 text-lg font-semibold text-ink-900 dark:text-ink-100">我的投稿</h2>
        </div>
        <button
          type="button"
          class="h-8 px-3 rounded-full border border-border-subtle bg-white dark:bg-surface-1 text-xs text-ink-600 dark:text-ink-300 cursor-pointer hover:border-accent-400 hover:text-accent-600 transition-colors"
          @click="showPublicPosts"
        >
          返回博客
        </button>
      </div>
      <div v-if="myPostsLoading" class="py-16 flex items-center justify-center gap-2 text-sm text-ink-400">
        <Loading class="w-4 h-4 animate-spin" aria-hidden="true" />
        加载中…
      </div>
      <el-empty v-else-if="myPostsLoaded && !myPosts.length" description="还没有投稿记录" />
      <div v-else-if="myPosts.length" class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
        <article
          v-for="item in myPosts"
          :key="item.id"
          class="flex min-w-0 flex-col rounded-xl border border-border-subtle bg-white dark:bg-surface-1 p-4"
          :class="item.status === 'published' ? 'cursor-pointer hover:shadow-md transition-shadow' : ''"
          @click="openMyPublishedPost(item)"
        >
          <div class="flex items-start justify-between gap-3">
            <h3 class="m-0 min-w-0 text-base font-semibold leading-snug text-ink-900 dark:text-ink-100 line-clamp-2">{{ item.title }}</h3>
            <span class="shrink-0 rounded-full px-2 py-1 text-xs font-medium" :class="statusClasses[item.status]">
              {{ statusLabels[item.status] || '处理中' }}
            </span>
          </div>
          <p class="mt-2 min-h-10 text-sm leading-relaxed text-ink-500 dark:text-ink-400 line-clamp-2">
            {{ myPostSummary(item) }}
          </p>
          <p v-if="item.status === 'rejected'" class="mt-2 text-xs text-red-600 dark:text-red-400">
            未通过原因：{{ item.reject_reason || '该记录未填写具体理由，请联系站长确认。' }}
          </p>
          <div class="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-ink-400">
            <span>{{ formatDate(item.updated_at || item.created_at) }}</span>
            <button
              v-if="item.status !== 'published'"
              type="button"
              class="h-7 px-3 rounded-full border-0 bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300 cursor-pointer hover:bg-accent-100 dark:hover:bg-accent-500/20"
              @click.stop="editMyPost(item)"
            >
              编辑
            </button>
            <span v-else class="inline-flex items-center gap-1"><View class="w-3.5 h-3.5" aria-hidden="true" />{{ item.views }}</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// 分类工具列表页（设计稿2）：顶部大图标 + 分类名 + 搜索，下方网格卡片
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconSearch from '~icons/ep/search'
import IconArrowRight from '~icons/ep/arrow-right'
import IconStarFilled from '~icons/ep/star-filled'
import IconStar from '~icons/ep/star'
import { useToolsStore } from '@/store/modules/tools'
import { useUserStore } from '@/store/modules/user'
import { getCateIcon } from './cateIcons'
import { useSpriteLogo } from '@/components/Tools/useSpriteLogo'
import {
  fetchFavoriteToolUrls,
  addFavoriteTool,
  removeFavoriteTool,
  normalizeToolUrl,
} from '@/api/favorite-tools'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const toolsStore = useToolsStore()
const userStore = useUserStore()

const keyword = ref('')

const cate = computed(() => {
  const id = Number(route.params.id)
  return toolsStore.cates.find((c) => c.id === id) || null
})

const cateTitle = computed(() => cate.value?.title || '分类')
const CateIcon = computed(() => getCateIcon(cateTitle.value))

const filteredList = computed(() => {
  const list = cate.value?.list || []
  const k = keyword.value.trim().toLowerCase()
  if (!k) return list
  return list.filter(
    (t) =>
      (t.title || '').toLowerCase().includes(k) ||
      (t.desc || '').toLowerCase().includes(k),
  )
})

// ===== 收藏（与 Home.vue 同源逻辑） =====
const favoriteUrls = ref<Set<string>>(new Set())

const isFavorited = (toolUrl: string) =>
  favoriteUrls.value.has(normalizeToolUrl(toolUrl))

const ensureFavoritesLoaded = async () => {
  if (!userStore.getLoginStatus) {
    favoriteUrls.value = new Set()
    return
  }
  try {
    favoriteUrls.value = new Set(await fetchFavoriteToolUrls())
  } catch {
    // 静默失败：收藏条不阻塞主内容
  }
}

const toggleFavorite = async (rawUrl: string) => {
  if (!userStore.getLoginStatus) {
    ElMessage.warning('登录后即可收藏工具')
    return
  }
  const toolUrl = normalizeToolUrl(rawUrl)
  const favorited = favoriteUrls.value.has(toolUrl)
  if (favorited) favoriteUrls.value.delete(toolUrl)
  else favoriteUrls.value.add(toolUrl)
  try {
    if (favorited) {
      await removeFavoriteTool(toolUrl)
      ElMessage.success('已取消收藏')
    } else {
      await addFavoriteTool(toolUrl)
      ElMessage.success('已收藏')
    }
  } catch {
    if (favorited) favoriteUrls.value.add(toolUrl)
    else favoriteUrls.value.delete(toolUrl)
  }
}

// 挂载后把浏览器标题换成具体分类名（SEO meta 仍是通用的「分类工具」）
onMounted(async () => {
  if (toolsStore.cates.length === 0) {
    try {
      await toolsStore.getToolCate()
    } catch {
      // store 内部已有本地兜底
    }
  }
  if (cate.value) document.title = `${cate.value.title}-${import.meta.env.VITE_APP_TITLE || '工具坊'}`
  ensureFavoritesLoaded()
})

const goHome = () => router.push('/')
</script>

<template>
  <div class="max-w-[1440px] mx-auto">
    <!-- 页头：渐变圆角图标 + 分类名 + 右侧搜索 -->
    <header class="flex items-center gap-4 mt-8 mb-6 flex-wrap">
      <div
        class="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-md shadow-accent-500/25 shrink-0"
      >
        <component :is="CateIcon" class="w-7 h-7" aria-hidden="true" />
      </div>
      <h1 class="text-h2 font-bold m-0 text-ink-900">{{ cateTitle }}</h1>

      <div class="ml-auto relative w-full sm:w-64">
        <IconSearch
          class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          v-model="keyword"
          type="search"
          placeholder="搜索工具..."
          aria-label="在当前分类中搜索工具"
          class="w-full h-11 pl-10 pr-4 rounded-full bg-white dark:bg-surface-0 border border-border-default text-sm text-ink-900 placeholder:text-ink-400 outline-none transition-shadow focus:ring-2 focus:ring-accent-500/40"
        />
      </div>
    </header>

    <!-- 工具网格 -->
    <div
      v-if="filteredList.length > 0"
      class="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      <router-link
        v-for="item in filteredList"
        :key="item.id"
        :to="item.url"
        class="group block"
        :aria-label="item.title"
      >
        <!-- 悬浮效果挂在固定不动的内层卡片上：外层链接是静止热区，
             避免卡片上移后鼠标滑出热区造成悬浮/失焦循环抖动 -->
        <div
          class="relative rounded-2xl p-5 bg-white dark:bg-surface-0 ring-1 ring-transparent group-hover:ring-accent-300/70 dark:group-hover:ring-accent-500/40 shadow-sm shadow-ink-950/5 group-hover:shadow-[0_12px_32px_-10px_rgb(var(--accent-500)/0.35)] group-hover:bg-gradient-to-br group-hover:from-accent-100 group-hover:via-accent-50 group-hover:to-violet-100 dark:group-hover:from-accent-500/15 dark:group-hover:via-surface-0 dark:group-hover:to-violet-500/15 group-hover:-translate-y-1 transition-all duration-200"
        >
        <!-- 箭头角标：悬停时以白色圆标形式显示 -->
        <span
          class="absolute top-4 right-4 w-6 h-6 rounded-full bg-surface-2 text-ink-400 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-white/90 group-hover:text-accent-600 group-hover:shadow-sm transition-all duration-200"
          aria-hidden="true"
        >
          <IconArrowRight class="w-3.5 h-3.5" />
        </span>
        <!-- 收藏星标 -->
        <button
          type="button"
          class="absolute top-3.5 right-11 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150"
          :class="
            isFavorited(item.url)
              ? 'text-accent-500'
              : 'text-ink-300 hover:text-accent-400'
          "
          :title="
            userStore.getLoginStatus
              ? isFavorited(item.url)
                ? '取消收藏'
                : '收藏工具'
              : '登录后可用'
          "
          :aria-label="
            userStore.getLoginStatus
              ? isFavorited(item.url)
                ? `取消收藏 ${item.title}`
                : `收藏 ${item.title}`
              : `登录后可收藏 ${item.title}`
          "
          @click.stop.prevent="toggleFavorite(item.url)"
        >
          <IconStarFilled v-if="isFavorited(item.url)" class="w-4 h-4" />
          <IconStar v-else class="w-4 h-4" />
        </button>

        <div class="flex items-start gap-3">
          <img
            v-if="!useSpriteLogo(item, 44).style"
            :src="item.logo"
            loading="lazy"
            class="w-11 h-11 min-h-[2.75rem] min-w-[2.75rem] object-contain rounded-xl"
            :alt="item.title"
          >
          <div
            v-else
            class="w-11 h-11 min-h-[2.75rem] min-w-[2.75rem] rounded-xl"
            :style="useSpriteLogo(item, 44).style"
            role="img"
            :aria-label="item.title"
          ></div>
          <div class="min-w-0 pr-8">
            <div class="font-semibold text-base text-ink-900 truncate">
              {{ item.title }}
            </div>
            <div class="text-xs text-ink-400 mt-0.5">{{ item.cate }}</div>
          </div>
        </div>
        <p class="mt-3 mb-0 text-[13px] leading-relaxed text-ink-500 line-clamp-2 min-h-[2.6em]">
          {{ item.desc }}
        </p>
        </div>
      </router-link>
    </div>

    <!-- 空 / 未找到 -->
    <div v-else class="py-24 text-center">
      <p class="text-ink-500 mb-4">
        {{ keyword ? `没有找到与「${keyword}」匹配的工具` : '该分类下暂无工具' }}
      </p>
      <button
        type="button"
        class="px-6 h-10 rounded-full bg-brand-gradient text-white text-sm font-medium border-0 cursor-pointer"
        @click="keyword ? (keyword = '') : goHome()"
      >
        {{ keyword ? '清除搜索' : '返回首页' }}
      </button>
    </div>
  </div>
</template>

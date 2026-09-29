<script setup lang="ts">
/**
 * 自建评论组件（对应后台「站点设置 → 评论系统」里的"自建评论系统"模式）
 * - 未登录：填昵称 + 邮箱即可评论（信息本地记住，下次免填）
 * - 已登录：直接评论，昵称/头像取自账号
 * - 所有评论提交后进入待审核，审核通过才会公开展示；本会话内提交的评论带「审核中」标记
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { fetchSiteComments, submitSiteComment, type SiteComment } from '@/api/comments'

const route = useRoute()
const userStore = useUserStore()

const MAX_CONTENT = 1000
const GUEST_INFO_KEY = 'comment_guest_info'

const user = computed(() => userStore.user)

// ---- 表单状态 ----
const content = ref('')
const nickname = ref('')
const email = ref('')
const submitting = ref(false)
const contentRef = ref<HTMLTextAreaElement | null>(null)

// 游客信息本地记住
try {
  const saved = JSON.parse(localStorage.getItem(GUEST_INFO_KEY) || '{}')
  nickname.value = saved.nickname || ''
  email.value = saved.email || ''
} catch {
  /* ignore */
}

// ---- 列表状态 ----
const loading = ref(false)
const list = ref<SiteComment[]>([])
const total = ref(0)
const page = ref(1)
const hasNext = ref(false)
/** 本会话内刚提交、待审核的评论 id（用于展示「审核中」标记） */
const pendingIds = ref<Set<string>>(new Set())

const currentPagePath = computed(() => route.path)

const load = async (append = false) => {
  loading.value = true
  try {
    const result = await fetchSiteComments(currentPagePath.value, page.value)
    if (!append) list.value = []
    list.value = append ? [...list.value, ...result.list] : result.list
    total.value = result.pagination.total
    hasNext.value = result.pagination.hasNext
  } catch (err) {
    console.error('[comments] 加载评论失败', err)
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  page.value += 1
  load(true)
}

// 路由切换时重置并重新加载
watch(currentPagePath, () => {
  page.value = 1
  pendingIds.value = new Set()
  load()
})

onMounted(() => {
  load()
})

// ---- 表情选择器 ----
const EMOJI_GROUPS = [
  {
    name: '笑脸',
    emojis: ['😄', '😂', '🤣', '😊', '😍', '😘', '😜', '🤪', '🤔', '🤨', '😐', '😴', '😅', '😭', '😢', '😤', '😡', '🤯', '😱', '🥵', '🥶', '😎', '🥳', '🤗', '🤡', '😮', '😷', '🤒', '🥺', '🙃'],
  },
  {
    name: '手势',
    emojis: ['👍', '👎', '👌', '✌️', '🤝', '🙏', '💪', '👏', '🫶', '🤙', '👆', '👇', '👉', '👈', '✋', '🤟', '🫡', '🫰', '🤛', '🤜'],
  },
  {
    name: '爱心',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '😻'],
  },
  {
    name: '热门',
    emojis: ['🎉', '🎊', '🔥', '💯', '⭐', '🌟', '✨', '⚡', '☀️', '🌙', '🌈', '🍉', '🍔', '🍟', '☕', '🍵', '🍺', '🎁', '🐶', '🐱', '🐼', '🦄', '🌸', '💩', '💀', '👻', '🤖', '🎃'],
  },
]
const activeEmojiGroup = ref(0)
const showPicker = ref(false)
const pickerRef = ref<HTMLElement | null>(null)
const emojiBtnRef = ref<HTMLElement | null>(null)

// 点击面板和按钮以外区域时收起
const onDocClick = (e: MouseEvent) => {
  if (!showPicker.value) return
  const target = e.target as Node
  if (pickerRef.value?.contains(target) || emojiBtnRef.value?.contains(target)) return
  showPicker.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

// 在光标处插入表情
const insertEmoji = (emoji: string) => {
  const el = contentRef.value
  if (!el) {
    content.value += emoji
    return
  }
  const start = el.selectionStart ?? content.value.length
  const end = el.selectionEnd ?? content.value.length
  content.value = content.value.slice(0, start) + emoji + content.value.slice(end)
  nextTick(() => {
    el.focus()
    el.selectionStart = el.selectionEnd = start + emoji.length
  })
}

// ---- 头像 ----
// 游客 / 无头像用户：按昵称哈希取一组渐变色，展示昵称首字
const AVATAR_GRADIENTS = [
  'from-sky-400 to-indigo-500',
  'from-rose-400 to-orange-400',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-fuchsia-400 to-pink-500',
  'from-violet-400 to-purple-500',
  'from-cyan-400 to-blue-500',
  'from-lime-400 to-green-500',
]

const hashString = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const avatarGradient = (name: string) => AVATAR_GRADIENTS[hashString(name || '?') % AVATAR_GRADIENTS.length]

const initial = (name: string) => (name || '客').trim().charAt(0).toUpperCase()

const avatarError = ref<Set<string>>(new Set())
const isImgAvatar = (c: { id: string; avatar: string }) => !!c.avatar && !avatarError.value.has(c.id)
const onAvatarError = (id: string) => {
  avatarError.value = new Set([...avatarError.value, id])
}

// ---- 时间 ----
const formatTime = (s: string) => {
  const d = new Date(String(s || '').replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  const diff = Date.now() - d.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ---- 提交 ----
const canSubmit = computed(() => {
  if (submitting.value) return false
  if (!content.value.trim()) return false
  if (!userStore.isLoggedIn) return !!(nickname.value.trim() && email.value.trim())
  return true
})

const handleSubmit = async () => {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const payload: Parameters<typeof submitSiteComment>[0] = {
      path: currentPagePath.value,
      content: content.value.trim(),
      page_title: document.title || '',
    }
    if (!userStore.isLoggedIn) {
      payload.nickname = nickname.value.trim()
      payload.email = email.value.trim()
      try {
        localStorage.setItem(GUEST_INFO_KEY, JSON.stringify({ nickname: payload.nickname, email: payload.email }))
      } catch {
        /* ignore */
      }
    }
    const { comment, message } = await submitSiteComment(payload)
    ElMessage.success(message)
    // 本地插入带「审核中」标记的评论（仅本会话可见）
    pendingIds.value = new Set([...pendingIds.value, comment.id])
    list.value = [comment, ...list.value]
    total.value += 1
    content.value = ''
  } catch (err: any) {
    // 错误信息由 axios 拦截器统一弹出
    console.error('[comments] 提交评论失败', err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="custom-comments">
    <!-- 发表表单 -->
    <div class="rounded-xl border border-border-subtle bg-surface-1 dark:bg-surface-2/40 p-4 sm:p-5">
      <!-- 身份行 -->
      <div class="flex items-center gap-3 mb-3">
        <!-- 已登录：账号头像 + 昵称 -->
        <template v-if="userStore.isLoggedIn && user">
          <img
            v-if="user.avatar"
            :src="user.avatar"
            :alt="user.username"
            class="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-surface-2 shadow-sm"
            referrerpolicy="no-referrer"
          />
          <span
            v-else
            class="w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-semibold shadow-sm"
            :class="avatarGradient(user.username)"
          >{{ initial(user.username) }}</span>
          <span class="text-body-sm font-medium text-ink-900">{{ user.username }}</span>
          <span class="text-caption text-ink-400">已登录</span>
        </template>

        <!-- 游客：昵称 + 邮箱 -->
        <template v-else>
          <span class="text-body-sm text-ink-600 shrink-0">游客评论</span>
          <el-input
            v-model="nickname"
            placeholder="昵称（必填）"
            maxlength="20"
            class="!w-36 comment-guest-input"
          />
          <el-input
            v-model="email"
            placeholder="邮箱（必填，仅后台可见）"
            maxlength="100"
            class="!w-56 comment-guest-input"
          />
        </template>
      </div>

      <!-- 内容输入 -->
      <textarea
        ref="contentRef"
        v-model="content"
        :maxlength="MAX_CONTENT"
        rows="3"
        placeholder="写下你的评论或建议…"
        class="comment-textarea w-full resize-y rounded-lg border border-border-subtle bg-white dark:bg-surface-1 px-3.5 py-2.5 text-body-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-accent-400 dark:focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition"
      ></textarea>

      <!-- 底部：表情 + 提示 + 计数 + 提交 -->
      <div class="flex items-center gap-2 sm:gap-3 mt-2.5">
        <span class="text-caption text-ink-400 flex items-center gap-1 mr-auto">
          <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9z" clip-rule="evenodd" />
          </svg>
          评论将在审核通过后展示
        </span>

        <span class="text-caption text-ink-400 tabular-nums">{{ content.length }}/{{ MAX_CONTENT }}</span>

        <!-- 表情选择器 -->
        <div class="relative">
          <button
            ref="emojiBtnRef"
            type="button"
            title="插入表情"
            aria-label="插入表情"
            class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink-500 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-surface-2 transition"
            @click="showPicker = !showPicker"
          >
            <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
          </button>

          <div
            v-if="showPicker"
            ref="pickerRef"
            class="absolute bottom-full right-0 mb-2 z-20 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-border-subtle bg-white dark:bg-surface-1 shadow-xl p-3"
          >
            <div class="flex items-center gap-1 mb-2 flex-wrap">
              <button
                v-for="(g, gi) in EMOJI_GROUPS"
                :key="g.name"
                type="button"
                class="px-2 py-0.5 rounded-md text-caption transition"
                :class="activeEmojiGroup === gi
                  ? 'bg-accent-50 text-accent-700 font-medium dark:bg-accent-500/15 dark:text-accent-300'
                  : 'text-ink-500 hover:text-ink-700 hover:bg-surface-2'"
                @click="activeEmojiGroup = gi"
              >{{ g.name }}</button>
            </div>
            <div class="grid grid-cols-7 gap-0.5 max-h-40 overflow-y-auto overflow-x-hidden">
              <button
                v-for="e in EMOJI_GROUPS[activeEmojiGroup].emojis"
                :key="e"
                type="button"
                class="h-8 w-8 rounded-md text-lg leading-none flex items-center justify-center hover:bg-surface-2 transition"
                :title="'插入 ' + e"
                @click="insertEmoji(e)"
              >{{ e }}</button>
            </div>
          </div>
        </div>

        <button
          type="button"
          :disabled="!canSubmit"
          class="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-body-sm font-medium text-white shadow-sm transition
                 bg-gradient-to-r from-accent-500 to-violet-500 hover:brightness-110 active:scale-[0.98]
                 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
          @click="handleSubmit"
        >
          <svg v-if="submitting" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ submitting ? '提交中…' : '发表评论' }}
        </button>
      </div>
    </div>

    <!-- 评论列表 -->
    <div v-loading="loading && list.length === 0" class="mt-5">
      <div v-if="!loading && list.length === 0" class="py-10 text-center">
        <svg class="w-10 h-10 mx-auto text-ink-300 dark:text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
        <p class="mt-3 text-body-sm text-ink-400">还没有评论，快来抢沙发～</p>
      </div>

      <ul v-else class="space-y-1">
        <li
          v-for="c in list"
          :key="c.id"
          class="flex gap-3 py-3.5 px-2 -mx-2 rounded-xl transition-colors hover:bg-surface-1 dark:hover:bg-surface-2/40"
        >
          <!-- 头像 -->
          <img
            v-if="isImgAvatar(c)"
            :src="c.avatar"
            :alt="c.nickname"
            class="w-9 h-9 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-surface-2 shadow-sm"
            referrerpolicy="no-referrer"
            @error="onAvatarError(c.id)"
          />
          <span
            v-else
            class="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-sm font-semibold shadow-sm select-none"
            :class="avatarGradient(c.nickname)"
          >{{ initial(c.nickname) }}</span>

          <!-- 内容区 -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <span class="text-body-sm font-medium text-ink-900">{{ c.nickname }}</span>
              <span
                v-if="pendingIds.has(c.id)"
                class="inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-medium bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400"
              >审核中</span>
              <span class="text-caption text-ink-400">{{ formatTime(c.created_at) }}</span>
            </div>
            <p class="mt-1 text-body-sm text-ink-700 whitespace-pre-line break-words">{{ c.content }}</p>

            <!-- 站长回复（后台回复，嵌套展示） -->
            <div v-if="c.replies?.length" class="mt-2.5 space-y-3 border-l-2 border-accent-100 dark:border-accent-500/25 pl-3">
              <div v-for="r in c.replies" :key="r.id" class="flex gap-2.5">
                <img
                  v-if="isImgAvatar(r)"
                  :src="r.avatar"
                  :alt="r.nickname"
                  class="w-7 h-7 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-surface-2 shadow-sm"
                  referrerpolicy="no-referrer"
                  @error="onAvatarError(r.id)"
                />
                <span
                  v-else
                  class="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-semibold shadow-sm select-none"
                  :class="avatarGradient(r.nickname)"
                >{{ initial(r.nickname) }}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                    <span class="text-body-sm font-medium text-ink-900">{{ r.nickname }}</span>
                    <span
                      class="inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-medium bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400"
                    >站长</span>
                    <span class="text-caption text-ink-400">{{ formatTime(r.created_at) }}</span>
                  </div>
                  <p class="mt-0.5 text-body-sm text-ink-700 whitespace-pre-line break-words">{{ r.content }}</p>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ul>

      <!-- 加载更多 -->
      <div v-if="hasNext" class="flex justify-center mt-3">
        <button
          type="button"
          :disabled="loading"
          class="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-4 py-1.5 text-body-sm text-ink-600
                 hover:border-accent-400 hover:text-accent-600 dark:hover:text-accent-400 transition
                 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="loadMore"
        >
          <svg v-if="loading" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ loading ? '加载中…' : `加载更多评论（共 ${total} 条）` }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-guest-input {
  --el-input-bg-color: transparent;
}

/* 暗色下 el-input 边框融入卡片 */
:global(html.dark) .comment-guest-input :deep(.el-input__wrapper) {
  background-color: rgb(var(--surface-1));
  box-shadow: 0 0 0 1px rgb(var(--border-subtle)) inset;
}
</style>

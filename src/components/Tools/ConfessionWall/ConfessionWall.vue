<script setup lang="ts">
import { reactive, ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen, Refresh, Sunny, Plus, User } from '@element-plus/icons-vue'
import { confessionDb, type ConfessionMessage, type ConfessionGroup } from '@/utils/confessionDb'
import { supabase } from '@/utils/supabase'
import { useUserStore } from '@/store/modules/user'

const router = useRouter()
const userStore = useUserStore()

// 用户指纹（用于反应去重，存于 localStorage）
const getFingerprint = (): string => {
  let fp = localStorage.getItem('confession-fp')
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem('confession-fp', fp)
  }
  return fp
}
const myFingerprint = getFingerprint()

// 我的反应状态：消息 id → Set<'like'|'hug'>
const myReactions = reactive<Record<string, Set<'like' | 'hug'>>>({})

const info = reactive({ title: '匿名告白墙' })

// 数据状态
const groups = ref<ConfessionGroup[]>([])
const groupsLoading = ref(false)
const currentGroupId = ref<string | null>(null)
const messages = ref<ConfessionMessage[]>([])
const totalCount = ref(0)
const onlineCount = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const isComposing = ref(false)
const isSending = ref(false)
const sortMode = ref<'latest' | 'hot'>('latest')
const showCreateGroup = ref(false)

// 管理员登录态（复用项目自身的 JWT 认证 + user.is_admin）
const isLoggedIn = computed(() => userStore.getLoginStatus)
const isAdmin = computed(() => userStore.getIsAdmin)

// 表单
const formData = reactive({
  content: '',
  mood: '😊',
  color: '#FFE4E1',
  group_id: '' as string,
})
const newGroupForm = reactive({
  name: '',
  icon: '📝',
  color: '#FFE4E1',
  description: '',
})

const moodOptions = ['😊', '😢', '🥰', '😍', '🤔', '😎', '🤗', '😴', '🥺', '😭', '😡', '🤐']
const colorOptions = ['#FFE4E1', '#FFDAB9', '#FFFACD', '#E0FFE0', '#E0E0FF', '#F0E0FF']
const groupIconOptions = ['🌆', '🌳', '💌', '✨', '🤬', '🎯', '🎨', '🎵', '📚', '☕', '🌙', '🍀']

// 客户端限流：1 分钟 1 条
const lastSendTime = ref(0)
const SEND_COOLDOWN = 60 * 1000

// Supabase 配置检测
const isSupabaseConfigured = computed(() => {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  return url && key && !url.includes('your-project') && !key.includes('your-anon-key')
})

const configSteps = [
  '1. 访问 https://supabase.com 创建免费项目',
  '2. 在 SQL Editor 执行项目根目录 supabase/confession-wall.sql 中的 SQL',
  '3. 在 Project Settings > API 复制 URL 和 anon key',
  '4. 将配置填入 .env.development 与 .env.production 文件',
]

// 实时订阅句柄
let newMessageChannel: any = null
let messageDeleteChannel: any = null
let reactionChannel: any = null
let presenceChannel: any = null
let groupsChannel: any = null

// 当前分组对象
const currentGroup = computed(() => {
  if (!currentGroupId.value) return null
  return groups.value.find((g) => g.id === currentGroupId.value) || null
})

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const loadGroups = async () => {
  if (!isSupabaseConfigured.value) return
  groupsLoading.value = true
  try {
    const list = await confessionDb.getGroups()
    groups.value = list

    // 优先级：URL ?group=<slug> > is_default 默认分组 > 第一个
    if (!currentGroupId.value) {
      const url = new URL(window.location.href)
      const urlGroupSlug = url.searchParams.get('group')
      let target: ConfessionGroup | undefined
      if (urlGroupSlug) {
        target = list.find((g) => g.slug === urlGroupSlug)
        // URL slug 无效（用户输错 / 分组已删）：清理掉避免分享无效链接
        if (!target) url.searchParams.delete('group')
      }
      if (!target) {
        target = list.find((g) => g.is_default) || list[0]
      }
      if (target) {
        currentGroupId.value = target.id
        // 同步 URL：让"分享 URL"始终有效
        if (url.searchParams.get('group') !== target.slug) {
          url.searchParams.set('group', target.slug)
        }
        window.history.replaceState({}, '', url.toString())
      }
    }
  } catch (err) {
    console.error('加载分组失败:', err)
    ElMessage.error('加载分组失败')
  } finally {
    groupsLoading.value = false
  }
}

const loadMessages = async () => {
  if (!isSupabaseConfigured.value) return
  loading.value = true
  try {
    const data = await confessionDb.getMessages(sortMode.value, undefined, currentGroupId.value)
    messages.value = data
    hasMore.value = data.length >= 20

    // 加载我的反应状态
    const userReactions = await confessionDb.getUserReactions(myFingerprint)
    Object.keys(myReactions).forEach((k) => delete myReactions[k])
    Object.entries(userReactions).forEach(([k, v]) => {
      myReactions[k] = v
    })

    // 获取总数（按当前分组）
    try {
      totalCount.value = await confessionDb.getTotalCount(currentGroupId.value)
    } catch {
      /* 忽略 */
    }
  } catch (err) {
    console.error('加载告白失败:', err)
    ElMessage.error('加载告白失败')
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value || loadingMore.value || messages.value.length === 0) return
  loadingMore.value = true
  try {
    const oldest = messages.value[messages.value.length - 1]
    const data = await confessionDb.getMessages(sortMode.value, oldest.created_at, currentGroupId.value)
    if (data.length === 0) {
      hasMore.value = false
    } else {
      messages.value.push(...data)
      hasMore.value = data.length >= 20
    }
  } catch (err) {
    console.error('加载更多失败:', err)
  } finally {
    loadingMore.value = false
  }
}

const switchGroup = async (groupId: string) => {
  if (currentGroupId.value === groupId) return
  currentGroupId.value = groupId
  // 同步 URL（用 slug 而非 UUID，分享链接更友好）
  const group = groups.value.find((g) => g.id === groupId)
  if (group) {
    const url = new URL(window.location.href)
    url.searchParams.set('group', group.slug)
    window.history.replaceState({}, '', url.toString())
  }
  // 切换分组时重订阅 message channel + delete channel
  if (newMessageChannel) {
    supabase.removeChannel(newMessageChannel)
    newMessageChannel = null
  }
  if (messageDeleteChannel) {
    supabase.removeChannel(messageDeleteChannel)
    messageDeleteChannel = null
  }
  await loadMessages()
  setupNewMessageChannel()
  setupMessageDeleteChannel()
}

const openCompose = () => {
  if (!isSupabaseConfigured.value) {
    ElMessage.warning('请先配置 Supabase')
    return
  }
  if (groups.value.length === 0) {
    ElMessage.warning('暂无可用分组，请先创建')
    return
  }
  formData.content = ''
  formData.mood = '😊'
  formData.color = colorOptions[Math.floor(Math.random() * colorOptions.length)]
  formData.group_id = currentGroupId.value || groups.value[0]?.id || ''
  isComposing.value = true
}

const sendMessage = async () => {
  const content = formData.content.trim()
  if (!content) {
    ElMessage.warning('写点什么吧～')
    return
  }
  if (content.length > 500) {
    ElMessage.warning('内容最多 500 字')
    return
  }
  const now = Date.now()
  if (now - lastSendTime.value < SEND_COOLDOWN) {
    const remain = Math.ceil((SEND_COOLDOWN - (now - lastSendTime.value)) / 1000)
    ElMessage.warning(`发送太频繁，${remain} 秒后再试`)
    return
  }

  isSending.value = true
  try {
    await confessionDb.sendMessage({
      content,
      mood: formData.mood,
      color: formData.color,
      group_id: formData.group_id || null,
    })
    lastSendTime.value = now
    isComposing.value = false
    ElMessage.success('告白已发布 ✨')
  } catch (err: any) {
    console.error('发送失败:', err)
    ElMessage.error('发送失败：' + (err?.message || '未知错误'))
  } finally {
    isSending.value = false
  }
}

const createGroup = async () => {
  const name = newGroupForm.name.trim()
  if (!name) {
    ElMessage.warning('请输入分组名')
    return
  }
  if (!isAdmin.value) {
    ElMessage.warning('仅管理员可创建分组')
    return
  }
  try {
    await confessionDb.createGroup({
      name,
      icon: newGroupForm.icon,
      color: newGroupForm.color,
      description: newGroupForm.description,
    })
    ElMessage.success('分组创建成功 🎉')
    showCreateGroup.value = false
    newGroupForm.name = ''
    newGroupForm.icon = '📝'
    newGroupForm.color = '#FFE4E1'
    newGroupForm.description = ''
    // 无需手动 reload：Supabase Realtime 会推送 INSERT 事件，
    // subscribeGroups 监听到后会自动调用 loadGroups()
  } catch (err: any) {
    console.error('创建分组失败:', err)
    // 401 / 403 时引导用户登录
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      ElMessage.error('管理员身份验证失败，请重新登录')
    } else {
      ElMessage.error('创建失败：' + (err?.message || '未知错误'))
    }
  }
}

const confirmDeleteGroup = async (group: ConfessionGroup) => {
  if (!isAdmin.value) {
    ElMessage.warning('仅管理员可删除分组')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除分组「${group.icon} ${group.name}」吗？\n\n该分组下的所有告白也会被永久删除（无法恢复）！`,
      '删除分组',
      {
        confirmButtonText: '永久删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await confessionDb.deleteGroup(group.id)
    ElMessage.success('分组已删除')

    // 本地立即更新 UI（不等 Realtime，瞬时反馈）
    if (currentGroupId.value === group.id) {
      // 当前分组被删：切到第一个剩余分组
      const fallback = groups.value.find((g) => g.id !== group.id)
      currentGroupId.value = fallback?.id || null
      // 同步更新 URL（避免分享链接 404）
      const url = new URL(window.location.href)
      if (fallback) {
        url.searchParams.set('group', fallback.slug)
      } else {
        url.searchParams.delete('group')
      }
      window.history.replaceState({}, '', url.toString())
      if (currentGroupId.value) {
        // 重新订阅 message channel + delete channel
        if (newMessageChannel) {
          supabase.removeChannel(newMessageChannel)
          newMessageChannel = null
        }
        if (messageDeleteChannel) {
          supabase.removeChannel(messageDeleteChannel)
          messageDeleteChannel = null
        }
        await loadMessages()
        setupNewMessageChannel()
        setupMessageDeleteChannel()
      }
    }
    // 从本地数组移除被删分组（避免 UI 闪烁）
    groups.value = groups.value.filter((g) => g.id !== group.id)
    // 注：无需再手动 loadGroups() —— Supabase Realtime 会推送 DELETE 事件，
    //     subscribeGroups 监听到后会调用 loadGroups() 做最终一致性确认（仅 1 次请求）
  } catch (err: any) {
    // 用户取消或 API 失败
    if (err !== 'cancel' && err?.message) {
      console.error('删除分组失败:', err)
      ElMessage.error('删除失败：' + (err.message || '未知错误'))
    }
  }
}

const confirmDeleteMessage = async (msg: ConfessionMessage) => {
  if (!isAdmin.value) {
    ElMessage.warning('仅管理员可删除告白')
    return
  }
  const preview = (msg.content || '').slice(0, 30)
  try {
    await ElMessageBox.confirm(
      `确定永久删除这条告白吗？\n\n「${msg.mood || '😊'} ${preview}${
        (msg.content || '').length > 30 ? '...' : ''
      }」\n\n删除后将连同所有点赞/抱抱一并清除（无法恢复）！`,
      '删除告白',
      {
        confirmButtonText: '永久删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    // 乐观更新：立即从本地移除，等 Realtime DELETE 事件做最终一致性
    messages.value = messages.value.filter((m) => m.id !== msg.id)
    totalCount.value = Math.max(0, totalCount.value - 1)

    await confessionDb.deleteMessage(msg.id)
    ElMessage.success('告白已删除')
    // 注：无需再手动 loadMessages() —— Supabase Realtime DELETE 事件
    //     会推到所有客户端（messageDeleteChannel），最终一致性
  } catch (err: any) {
    // 用户取消 → 回滚乐观更新
    if (err === 'cancel' || /cancel/i.test(err?.message || '')) {
      // 这里不重置：用户取消的乐观更新已"误删"显示。最稳的做法是 reload 当前分组。
      // 但考虑到只有管理员能看到删除按钮，且操作低频，简单 reload 也可接受。
      await loadMessages()
      return
    }
    // 真实失败：回滚 + 提示
    await loadMessages()
    console.error('删除告白失败:', err)
    ElMessage.error('删除失败：' + (err?.message || '未知错误'))
  }
}

// ---------- 管理员登录（复用项目 JWT 认证）----------

const loadCurrentUser = () => {
  // 复用项目自身的 user store —— 从 localStorage 读 JWT 解出 is_admin
  userStore.initUserState()
}

const goToLogin = () => {
  // 跳转到项目现有的登录页，登录后回到当前页面
  router.push({
    path: '/login',
    query: { redirect: '/confession-wall/' },
  })
}

const toggleReaction = async (msg: ConfessionMessage, type: 'like' | 'hug') => {
  if (!isSupabaseConfigured.value) return

  const set = myReactions[msg.id] || new Set()
  const had = set.has(type)
  const column = type === 'like' ? 'likes_count' : 'hugs_count'
  msg[column] = Math.max(0, msg[column] + (had ? -1 : 1))

  if (had) {
    set.delete(type)
  } else {
    set.add(type)
  }
  if (set.size === 0) {
    delete myReactions[msg.id]
  } else {
    myReactions[msg.id] = set
  }

  try {
    await confessionDb.toggleReaction(msg.id, type, myFingerprint)
  } catch (err) {
    msg[column] = Math.max(0, msg[column] + (had ? 1 : -1))
    if (had) {
      set.add(type)
    } else {
      set.delete(type)
    }
    if (set.size === 0) {
      delete myReactions[msg.id]
    } else {
      myReactions[msg.id] = set
    }
    ElMessage.error('操作失败')
  }
}

const switchSort = async (mode: string | number | boolean | undefined) => {
  if (mode !== 'latest' && mode !== 'hot') return
  if (sortMode.value === mode) return
  sortMode.value = mode
  await loadMessages()
}

const randomColor = () => {
  const idx = Math.floor(Math.random() * colorOptions.length)
  formData.color = colorOptions[idx]
}

const refresh = () => loadMessages()

const setupPresence = () => {
  presenceChannel = confessionDb.subscribePresence({
    onSync: (count) => (onlineCount.value = count),
  })
}

const setupNewMessageChannel = () => {
  newMessageChannel = confessionDb.subscribeNewMessages(
    (msg) => {
      // 避免重复插入
      if (messages.value.some((m) => m.id === msg.id)) return
      // 当前分组过滤（虽然订阅已过滤，客户端再校验一次保险）
      if (currentGroupId.value && msg.group_id !== currentGroupId.value) return
      if (sortMode.value === 'latest') {
        messages.value.unshift(msg)
      } else {
        loadMessages()
      }
      totalCount.value++
    },
    currentGroupId.value
  )
}

const setupMessageDeleteChannel = () => {
  messageDeleteChannel = confessionDb.subscribeMessageDeletes(
    (deletedId) => {
      const idx = messages.value.findIndex((m) => m.id === deletedId)
      if (idx !== -1) {
        messages.value.splice(idx, 1)
        totalCount.value = Math.max(0, totalCount.value - 1)
      }
    },
    currentGroupId.value
  )
}

const setupRealtime = () => {
  setupNewMessageChannel()
  setupMessageDeleteChannel()

  reactionChannel = confessionDb.subscribeReactions((msgId, type, delta) => {
    const msg = messages.value.find((m) => m.id === msgId)
    if (!msg) return
    const column = type === 'like' ? 'likes_count' : 'hugs_count'
    msg[column] = Math.max(0, msg[column] + delta)
  })

  // 分组变化：任何用户新建分组都实时反映
  groupsChannel = confessionDb.subscribeGroups(async () => {
    await loadGroups()
  })
}

const teardown = () => {
  if (newMessageChannel) supabase.removeChannel(newMessageChannel)
  if (messageDeleteChannel) supabase.removeChannel(messageDeleteChannel)
  if (reactionChannel) supabase.removeChannel(reactionChannel)
  if (presenceChannel) supabase.removeChannel(presenceChannel)
  if (groupsChannel) supabase.removeChannel(groupsChannel)
  newMessageChannel = null
  messageDeleteChannel = null
  reactionChannel = null
  presenceChannel = null
  groupsChannel = null
}

onMounted(async () => {
  if (!isSupabaseConfigured.value) return
  loadCurrentUser()
  await loadGroups()
  if (currentGroupId.value) {
    await loadMessages()
    setupRealtime()
    setupPresence()
  }
})

onUnmounted(() => {
  teardown()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- Supabase 未配置 -->
    <div v-if="!isSupabaseConfigured" class="bg-white rounded-lg shadow-sm p-6 max-w-2xl mx-auto">
      <div class="text-center mb-6">
        <div class="text-6xl mb-4">💌</div>
        <h2 class="text-h3 font-semibold text-gray-800 mb-2">需要配置 Supabase</h2>
        <p class="text-gray-500 text-body-sm">匿名告白墙需要 Supabase 提供实时数据库支持</p>
        <p class="text-gray-400 text-caption mt-2">💡 提示：发告白、点赞完全匿名，无需登录。只有分组管理才需要登录。</p>
      </div>

      <div class="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-4">
        <h3 class="font-semibold text-pink-800 mb-3">📋 配置步骤：</h3>
        <ol class="space-y-2 text-body-sm text-pink-700">
          <li v-for="(step, index) in configSteps" :key="index" class="flex gap-2">
            <span class="flex-shrink-0 w-5 h-5 bg-pink-200 text-pink-800 rounded-full flex items-center justify-center text-caption font-bold">
              {{ index + 1 }}
            </span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </div>

      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <h3 class="font-semibold text-gray-800 mb-2">📝 建表 SQL</h3>
        <p class="text-body-sm text-gray-600 mb-2">
          打开项目根目录下的 <code class="bg-gray-200 px-1 rounded">supabase/confession-wall.sql</code>，
          复制全部内容粘贴到 Supabase SQL Editor 点击 Run 即可。
        </p>
        <p class="text-caption text-gray-500">
          脚本已使用 <code class="bg-gray-200 px-1 rounded">IF NOT EXISTS</code> 等幂等语法，可重复执行不报错。
        </p>
      </div>

      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 class="font-semibold text-gray-800 mb-2">📝 环境变量</h3>
        <p class="text-body-sm text-gray-600 mb-2">
          在 <code class="bg-gray-200 px-1 rounded">.env.development</code> 中添加：
        </p>
        <pre class="bg-gray-800 text-green-400 p-3 rounded text-caption overflow-x-auto"><code>VITE_SUPABASE_URL='https://your-project.supabase.co'
VITE_SUPABASE_ANON_KEY='your-anon-key'</code></pre>
        <p class="text-body-sm text-gray-500 mt-3">⚠️ 配置完成后重启 <code class="bg-gray-200 px-1 rounded">pnpm dev</code> 即可生效</p>
      </div>

      <div class="mt-4 text-center">
        <el-button type="primary" @click="refresh">配置完成，刷新页面</el-button>
      </div>
    </div>

    <!-- 正常情况 -->
    <div v-else class="bg-white rounded-lg shadow-sm p-4 md:p-6">
      <!-- 分组标签栏 -->
      <div class="group-tabs-wrapper mb-4">
        <!-- 加载中：骨架屏 -->
        <div v-if="groupsLoading" class="group-tabs-skeleton">
          <div
            v-for="(w, i) in [72, 64, 80, 60, 76]"
            :key="i"
            class="skeleton-pill"
            :style="{ width: w + 'px' }"
          />
        </div>
        <!-- 加载完成：实际标签 -->
        <div v-else class="group-tabs">
          <div
            v-for="g in groups"
            :key="g.id"
            class="group-tab-wrapper"
          >
            <button
              class="group-tab"
              :class="{ active: currentGroupId === g.id, 'has-delete': isAdmin }"
              :style="currentGroupId === g.id && g.color ? { background: g.color, borderColor: g.color } : {}"
              @click="switchGroup(g.id)"
            >
              <span class="group-icon">{{ g.icon }}</span>
              <span class="group-name">{{ g.name }}</span>
              <!-- 删除按钮：放在 tab 内部右上角，绝对定位；不受外层 overflow 影响 -->
              <span
                v-if="isAdmin"
                class="group-delete-btn"
                title="删除分组（管理员）"
                @click.stop="confirmDeleteGroup(g)"
              >
                ×
              </span>
            </button>
          </div>
          <button
            v-if="isAdmin"
            class="group-tab group-tab-add"
            @click="showCreateGroup = true"
            title="创建新分组"
          >
            <el-icon><Plus /></el-icon>
            <span>新分组</span>
          </button>
        </div>
      </div>

      <!-- 顶部统计栏 -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div class="flex items-center gap-3 text-body-sm text-gray-600 flex-wrap">
          <span
            v-if="currentGroup"
            class="px-3 py-1 rounded-full"
            :style="{ background: (currentGroup.color || '#FFE4E1') + '55', color: '#9a3412' }"
          >
            {{ currentGroup.icon }} {{ currentGroup.name }} · 共 {{ totalCount }} 条
          </span>
          <span class="px-3 py-1 bg-green-50 text-green-700 rounded-full">
            🟢 在线 {{ onlineCount }} 人
          </span>
          <span
            v-if="isAdmin"
            class="px-3 py-1 bg-amber-50 text-amber-700 rounded-full font-medium"
            title="你是管理员，可以创建/删除分组，也可以删除任意告白"
          >
            🔑 管理员
          </span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <el-radio-group v-model="sortMode" size="small" @change="switchSort">
            <el-radio-button value="latest">最新</el-radio-button>
            <el-radio-button value="hot">最热</el-radio-button>
          </el-radio-group>
          <el-button :icon="Refresh" size="small" @click="refresh" :loading="loading" circle />

          <!-- 管理入口：仅未登录时显示登录引导；登录后完全融入匿名氛围 -->
          <el-button
            v-if="!isLoggedIn"
            :icon="User"
            size="small"
            plain
            @click="goToLogin"
            title="登录后可管理分组（匿名发帖无需登录）"
          >
            🔑 管理
          </el-button>
          <!-- 登录用户：不显示任何东西；管理员标识由 🔑 徽章呈现 -->

          <el-button type="primary" :icon="EditPen" @click="openCompose">
            写告白
          </el-button>
        </div>
      </div>

      <!-- 告白墙 -->
      <div v-loading="loading" class="confession-grid">
        <div v-if="messages.length === 0 && !loading" class="empty-state">
          <div class="text-5xl mb-3">{{ currentGroup?.icon || '🌸' }}</div>
          <p class="text-gray-500">「{{ currentGroup?.name || '这个分组' }}」还没有告白，做第一个吧～</p>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="confession-card float-in"
          :style="{ background: msg.color || '#FFE4E1' }"
        >
          <!-- 管理员删除按钮（悬停显示） -->
          <span
            v-if="isAdmin"
            class="card-delete-btn"
            title="删除告白（管理员）"
            @click.stop="confirmDeleteMessage(msg)"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <line x1="2" y1="2" x2="8" y2="8" />
              <line x1="8" y1="2" x2="2" y2="8" />
            </svg>
          </span>
          <div class="card-mood">{{ msg.mood || '😊' }}</div>
          <p class="card-content">{{ msg.content }}</p>
          <div class="card-footer">
            <span class="card-time">{{ formatTime(msg.created_at) }}</span>
            <div class="card-actions">
              <button
                class="action-btn"
                :class="{ active: myReactions[msg.id]?.has('like') }"
                @click="toggleReaction(msg, 'like')"
                title="点赞"
              >
                <span class="emoji">❤</span>
                <span class="count">{{ msg.likes_count || 0 }}</span>
              </button>
              <button
                class="action-btn"
                :class="{ active: myReactions[msg.id]?.has('hug') }"
                @click="toggleReaction(msg, 'hug')"
                title="送抱抱"
              >
                <span class="emoji">🫂</span>
                <span class="count">{{ msg.hugs_count || 0 }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="messages.length > 0" class="text-center mt-4">
        <el-button text :loading="loadingMore" :disabled="!hasMore" @click="loadMore">
          {{ hasMore ? (loadingMore ? '加载中...' : '加载更多') : '已经到底啦 🌷' }}
        </el-button>
      </div>
    </div>

    <!-- 发布告白弹窗 -->
    <el-dialog
      v-model="isComposing"
      title="写一句告白"
      width="90%"
      max-width="500px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="space-y-4">
        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">选择分组</label>
          <div class="group-picker">
            <button
              v-for="g in groups"
              :key="g.id"
              type="button"
              class="group-pick-btn"
              :class="{ selected: formData.group_id === g.id }"
              :style="formData.group_id === g.id && g.color ? { background: g.color, borderColor: g.color } : {}"
              @click="formData.group_id = g.id"
            >
              <span>{{ g.icon }}</span>
              <span>{{ g.name }}</span>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">你的心情</label>
          <div class="mood-picker">
            <button
              v-for="m in moodOptions"
              :key="m"
              type="button"
              class="mood-btn"
              :class="{ selected: formData.mood === m }"
              @click="formData.mood = m"
            >
              {{ m }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">卡片颜色</label>
          <div class="color-picker">
            <button
              v-for="c in colorOptions"
              :key="c"
              type="button"
              class="color-btn"
              :class="{ selected: formData.color === c }"
              :style="{ background: c }"
              @click="formData.color = c"
            />
            <el-button size="small" text @click="randomColor" :icon="Sunny">
              随机
            </el-button>
          </div>
        </div>

        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">告白内容</label>
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="5"
            placeholder="想对世界说点什么？匿名发布，没人知道你是谁..."
            maxlength="500"
            show-word-limit
          />
        </div>

        <div class="text-caption text-gray-400">
          ⚠️ 同一设备 1 分钟内只能发布一条，请文明发言
        </div>
      </div>
      <template #footer>
        <el-button @click="isComposing = false">取消</el-button>
        <el-button type="primary" :loading="isSending" :disabled="!formData.content.trim()" @click="sendMessage">
          发布
        </el-button>
      </template>
    </el-dialog>

    <!-- 创建分组弹窗 -->
    <el-dialog
      v-model="showCreateGroup"
      title="创建新分组"
      width="90%"
      max-width="450px"
      :close-on-click-modal="false"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">分组名</label>
          <el-input
            v-model="newGroupForm.name"
            placeholder="如：深夜食堂、给陌生人的信..."
            maxlength="20"
            show-word-limit
          />
        </div>

        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">图标</label>
          <div class="group-icon-picker">
            <button
              v-for="ic in groupIconOptions"
              :key="ic"
              type="button"
              class="icon-btn"
              :class="{ selected: newGroupForm.icon === ic }"
              @click="newGroupForm.icon = ic"
            >
              {{ ic }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">主题色</label>
          <div class="color-picker">
            <button
              v-for="c in colorOptions"
              :key="c"
              type="button"
              class="color-btn"
              :class="{ selected: newGroupForm.color === c }"
              :style="{ background: c }"
              @click="newGroupForm.color = c"
            />
          </div>
        </div>

        <div>
          <label class="block text-body-sm font-medium text-gray-700 mb-2">简介（可选）</label>
          <el-input
            v-model="newGroupForm.description"
            placeholder="一句话介绍这个分组..."
            maxlength="50"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="showCreateGroup = false">取消</el-button>
        <el-button type="primary" :disabled="!newGroupForm.name.trim()" @click="createGroup">
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <el-text>
        在线匿名告白墙，基于 Supabase Realtime 实现实时互动。无需注册，写下一句真心话或小情绪，发布后以彩色卡片形式展示在墙上。
        <br><br>
        <strong>特色：</strong>
        <br>• <strong>分组隔离</strong>：内置广场/树洞/表白/许愿/吐槽五个分组，每个分组的告白独立展示
        <br>• <strong>自定义分组</strong>：点击右上角"+ 新分组"创建专属话题墙，所有用户都能创建
        <br>• <strong>完全匿名</strong>：无需注册，写下即发布
        <br>• <strong>实时飘字</strong>：同一分组内的新告白会实时飘入你的屏幕
        <br>• <strong>互动反应</strong>：对喜欢的告白点 ❤ 或送 🫂，对方计数实时更新
        <br>• <strong>卡片定制</strong>：选择心情 emoji 和卡片颜色
        <br>• <strong>文明社区</strong>：客户端 1 分钟限流，限制 spam
        <br><br>
        <strong>使用方法：</strong>
        <br>1. 顶部选择想看的分组（默认"广场"）
        <br>2. 点击"写告白"
        <br>3. 选择分组、心情和颜色
        <br>3. 输入告白内容（最多 500 字）
        <br>4. 点击发布
        <br>5. 在墙上点赞或送抱抱给他人
        <br>6. 想开辟新话题？登录后管理员账号可点"+ 新分组"创建专属墙
        <br><br>
        <strong>匿名 vs 管理：</strong>
        <br>• <strong>普通用户完全匿名</strong>：发告白、点赞、送抱抱无需任何账号
        <br>• <strong>仅分组管理需登录</strong>：复用项目自身登录系统（不是 Supabase Auth）
        <br>• <strong>管理员判断</strong>：依据项目 D1 `user.is_admin` 字段（与其他工具统一）
        <br>• <strong>创建/删除分组</strong>：经 Cloudflare Function 校验 JWT + is_admin，写入 Supabase
        <br>• <strong>删除任意告白</strong>：管理员可删除墙上任意告白（含点赞/抱抱），其他客户端自动实时消失
        <br>• 完整鉴权架构见 <code class="bg-gray-200 px-1 rounded">.claude/project/confession-wall-auth.md</code>
        <br><br>
        <strong>实现原理：</strong>
        <br>• 使用 <strong>Supabase Realtime</strong> 实时推送新告白与反应
        <br>• 三张表：confession_groups（分组）、confession_messages（消息）、confession_reactions（反应）
        <br>• 分组订阅过滤：切换分组时 channel 重新订阅，只接收当前分组的实时事件
        <br>• 数据存储在 Supabase PostgreSQL，免费档 500MB 容量足够使用
        <br>• 用户指纹存于 localStorage 用于反应去重（不收集任何个人信息）
        <br>• RLS 行级安全策略确保任何人都能读写，但有字段长度校验防滥用
        <br>• 完整建表 SQL 见项目根目录 <code class="bg-gray-200 px-1 rounded">supabase/confession-wall.sql</code>
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.confession-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.confession-card {
  border-radius: 16px;
  padding: 18px 20px 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-height: 140px;
  display: flex;
  flex-direction: column;
}

.confession-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.1);
}

.card-mood {
  font-size: 28px;
  line-height: 1;
  margin-bottom: 8px;
}

.card-content {
  color: #2d3748;
  font-size: 15px;
  line-height: 1.65;
  margin: 0 0 12px 0;
  word-break: break-word;
  white-space: pre-wrap;
  flex: 1;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 10px;
  gap: 8px;
}

.card-time {
  font-size: 12px;
  color: #718096;
}

.card-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 999px;
  padding: 4px 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #4a5568;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: scale(1.05);
}

.action-btn.active {
  background: rgba(255, 105, 180, 0.18);
  border-color: rgba(255, 105, 180, 0.4);
  color: #d53f8c;
  font-weight: 600;
}

.action-btn .emoji {
  font-size: 14px;
}

.action-btn .count {
  font-variant-numeric: tabular-nums;
  min-width: 14px;
  text-align: center;
}

/* 飘字入场动画 */
@keyframes float-in {
  0% {
    opacity: 0;
    transform: translateY(40px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.float-in {
  animation: float-in 0.6s ease-out both;
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: #a0aec0;
}

/* Mood 选择器 */
.mood-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mood-btn {
  width: 40px;
  height: 40px;
  font-size: 22px;
  border-radius: 10px;
  border: 2px solid transparent;
  background: #f7fafc;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mood-btn:hover {
  background: #edf2f7;
  transform: scale(1.08);
}

.mood-btn.selected {
  border-color: #ed64a6;
  background: #fff5f7;
}

/* 颜色选择器 */
.color-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.color-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.selected {
  border-color: #2d3748;
  box-shadow: 0 0 0 2px white inset;
}

/* 分组标签栏：padding-top 给右上角 × 留出伸出空间，margin-top 抵消让 tab 视觉位置不变 */
.group-tabs-wrapper {
  overflow-x: auto;
  scrollbar-width: thin;
  padding-top: 8px;
  margin-top: -8px;
}

/* 骨架屏（分组加载中） */
.group-tabs-skeleton {
  display: flex;
  gap: 8px;
  padding-bottom: 4px;
}

.skeleton-pill {
  height: 32px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    #f1f5f9 0%,
    #e2e8f0 50%,
    #f1f5f9 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.group-tabs-wrapper::-webkit-scrollbar {
  height: 4px;
}

.group-tabs {
  display: inline-flex;
  gap: 8px;
  padding-bottom: 4px;
}

.group-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  color: #4a5568;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.group-tab.has-delete {
  padding-right: 30px;  /* 给右上角删除按钮留位置 */
}

.group-tab:hover {
  border-color: #cbd5e0;
  background: #f7fafc;
}

.group-tab.active {
  color: #2d3748;
  font-weight: 600;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.group-tab-add {
  border-style: dashed;
  color: #a0aec0;
}

.group-tab-add:hover {
  color: #667eea;
  border-color: #667eea;
}

.group-icon {
  font-size: 16px;
  line-height: 1;
}

/* 分组标签 wrapper（仅用于布局对齐） */
.group-tab-wrapper {
  display: inline-flex;
  flex-shrink: 0;
}

/* 删除按钮：伸出 tab 右上角（top:-4px），不会被裁剪
   因为外层 .group-tabs-wrapper 有 padding-top: 8px 兜底空间 */
.group-delete-btn {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f56565;
  color: white;
  font-size: 13px;
  line-height: 18px;
  text-align: center;
  border: 1.5px solid white;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}

.group-tab:hover .group-delete-btn {
  opacity: 1;
}

.group-delete-btn:hover {
  background: #c53030;
  transform: scale(1.15);
}

/* 告白卡片删除按钮：右上角，悬停卡片时显示 */
.card-delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #f56565;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid white;
  box-sizing: border-box;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
  z-index: 2;
}

.card-delete-btn svg {
  display: block;  /* 消除 svg 自身行框造成的几何偏移 */
}

.confession-card:hover .card-delete-btn {
  opacity: 1;
}

.card-delete-btn:hover {
  background: #c53030;
  transform: scale(1.15);
}

/* 分组选择器（弹窗内） */
.group-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.group-pick-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid #e2e8f0;
  background: #fff;
  color: #4a5568;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.group-pick-btn:hover {
  border-color: #cbd5e0;
}

.group-pick-btn.selected {
  font-weight: 600;
  color: #2d3748;
  border-color: transparent;
}

/* 分组图标选择器 */
.group-icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.icon-btn {
  width: 38px;
  height: 38px;
  font-size: 20px;
  border-radius: 10px;
  border: 2px solid transparent;
  background: #f7fafc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  background: #edf2f7;
  transform: scale(1.05);
}

.icon-btn.selected {
  border-color: #ed64a6;
  background: #fff5f7;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .confession-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .confession-card {
    padding: 14px 16px 12px;
  }
  .card-mood {
    font-size: 24px;
  }
  .card-content {
    font-size: 14px;
  }
}
</style>
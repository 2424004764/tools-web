<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'
import { getLocalToken, isTokenExpired } from '@/utils/user'

const info = reactive({
  title: '短链接生成器',
})

interface LinkItem {
  slug: string
  url: string
  title: string
  expireAt?: string
}

const state = reactive({
  url: '',
  titleText: '',
  expireAt: null as Date | null,
  resultSlug: '',
  loading: false,
  recentLinks: [] as LinkItem[],
})

const siteBase = window.location.origin + '/s/'

const token = getLocalToken()
const loggedIn = !!(token && !isTokenExpired(token))

// 获取请求头（携带 token）
const authHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token && !isTokenExpired(token)) {
    h['Authorization'] = `Bearer ${token}`
  }
  return h
}

// 从服务端加载链接列表
const fetchServerLinks = async () => {
  try {
    const res = await fetch('/api/links', { headers: authHeaders() })
    if (!res.ok) return
    const body = await res.json()
    if (body?.data?.data) {
      state.recentLinks = body.data.data.map((item: any) => ({
        slug: item.slug,
        url: item.url,
        title: item.title || '',
        expireAt: item.expireAt,
      }))
    }
  } catch {
    // ignore
  }
}

// 从 localStorage 加载最近链接
const loadLocalLinks = () => {
  try {
    const saved = localStorage.getItem('short_links_recent')
    if (saved) {
      state.recentLinks = JSON.parse(saved)
    }
  } catch {
    // ignore
  }
}

const saveLocalLinks = () => {
  try {
    localStorage.setItem('short_links_recent', JSON.stringify(state.recentLinks.slice(0, 20)))
  } catch {
    // ignore
  }
}

// 初始化：登录用户从服务端加载，未登录从 localStorage 加载
if (loggedIn) {
  fetchServerLinks()
} else {
  loadLocalLinks()
}

const generate = async () => {
  if (!state.url) {
    ElMessage.warning('请输入长链接')
    return
  }

  const url = state.url.trim()
  if (!url) {
    ElMessage.warning('请输入链接')
    return
  }

  if (!/^(https?:\/\/)?([\w-]+\.)+\w+/i.test(url) && url !== 'localhost') {
    ElMessage.error('请输入有效的链接或域名')
    return
  }

  state.loading = true
  state.resultSlug = ''

  try {
    const body: Record<string, string> = { url }
    if (state.titleText.trim()) {
      body.title = state.titleText.trim()
    }
    if (state.expireAt) {
      body.expireAt = state.expireAt.toISOString()
    }

    const res = await fetch('/api/links', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      ElMessage.error(data.error || '创建失败')
      return
    }

    state.resultSlug = data.slug

    if (loggedIn) {
      await fetchServerLinks()
    } else {
      state.recentLinks.unshift({
        slug: data.slug,
        url: state.url,
        title: data.title || '',
      })
      saveLocalLinks()
    }

    ElMessage.success('短链接生成成功！')
  } catch {
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    state.loading = false
  }
}

const copySlug = (slug: string) => {
  copy(siteBase + slug)
  ElMessage.success('已复制到剪贴板')
}

const openLink = (slug: string) => {
  window.open(siteBase + slug, '_blank')
}

const deleteRecent = async (index: number) => {
  const item = state.recentLinks[index]
  if (!item) return
  if (loggedIn) {
    try {
      await fetch(`/api/links/${item.slug}`, { method: 'DELETE', headers: authHeaders() })
    } catch {
      // ignore
    }
    await fetchServerLinks()
  } else {
    state.recentLinks.splice(index, 1)
    saveLocalLinks()
  }
}

const clearRecent = () => {
  state.recentLinks = []
  if (!loggedIn) saveLocalLinks()
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-4 rounded-2xl bg-white space-y-4">
      <!-- 长链接输入 -->
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">长链接</label>
        <el-input
          v-model="state.url"
          type="textarea"
          :rows="3"
          placeholder="输入需要缩短的长链接，例如 https://example.com/very/long/url"
        />
      </div>

      <!-- 标题 -->
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">标题（可选）</label>
        <el-input
          v-model="state.titleText"
          placeholder="给这个链接加个备注"
          maxlength="100"
        />
      </div>

      <!-- 过期时间 -->
      <div>
        <label class="block text-sm font-medium mb-1 text-gray-700">
          过期时间（可选）
          <span class="text-gray-400 text-xs">不填永不过期</span>
        </label>
        <el-date-picker
          v-model="state.expireAt"
          type="datetime"
          placeholder="选择过期时间"
          :disabled-date="(t: Date) => {
            const today = new Date(); today.setHours(0, 0, 0, 0); return t < today
          }"
          clearable
          style="width: 100%"
        />
      </div>

      <!-- 生成按钮 -->
      <el-button type="primary" size="large" class="!w-full" :loading="state.loading" @click="generate">
        {{ state.loading ? '生成中...' : '生成短链接' }}
      </el-button>

      <!-- 结果 -->
      <div v-if="state.resultSlug" class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="text-sm font-medium text-green-700 mb-2">生成成功！</div>
        <div class="flex items-center gap-2">
          <span class="text-lg font-mono font-bold text-green-600 select-all">{{ state.resultSlug }}</span>
          <el-button type="success" size="small" @click="copySlug(state.resultSlug)">复制短链接</el-button>
        </div>
      </div>
    </div>

    <!-- 最近链接 -->
    <div v-if="state.recentLinks.length > 0" class="mt-4 p-4 rounded-2xl bg-white">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-medium text-gray-700">最近生成的链接</h3>
        <el-button text size="small" type="danger" @click="clearRecent">清空记录</el-button>
      </div>
      <div class="space-y-2">
        <div
          v-for="(link, index) in state.recentLinks"
          :key="index"
          class="flex flex-wrap items-start gap-1 p-2 rounded-lg hover:bg-gray-50 border border-gray-100"
        >
          <div class="flex-1 min-w-0">
            <div v-if="link.title" class="text-sm font-medium text-gray-700 truncate">{{ link.title }}</div>
            <div class="text-xs text-gray-400 truncate">{{ link.url }}</div>
            <div class="text-xs text-blue-500 font-mono truncate">{{ siteBase }}{{ link.slug }}</div>
          </div>
          <div class="flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end sm:justify-start">
            <el-button text size="small" @click="copySlug(link.slug)">复制</el-button>
            <el-button text size="small" @click="openLink(link.slug)">访问</el-button>
            <el-button text size="small" type="danger" @click="deleteRecent(index)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>
        在线短链接生成工具。将冗长的 URL 转换为简短链接，方便分享与记忆。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.select-all {
  user-select: all;
}
</style>

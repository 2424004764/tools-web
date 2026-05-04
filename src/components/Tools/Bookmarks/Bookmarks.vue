<script setup lang="ts">
import { reactive, ref, computed, onMounted, watch } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Edit, Refresh, Search, Upload, Download, StarFilled, Star, Connection, Link } from '@element-plus/icons-vue'
import { v4 as uuidv4 } from 'uuid'
import functionsRequest from '@/utils/functionsRequest'
import { useUserStore } from '@/store/modules/user'

interface Bookmark {
  id: string
  url: string
  title: string
  description: string
  tags: string[]
  isRead: boolean
  createTime: string
  updateTime: string
}

interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const STORAGE_KEY = 'tools-web-bookmarks'
const userStore = useUserStore()

const goToLogin = () => {
  window.location.href = '/login?redirect=/bookmarks/'
}

const info = reactive({
  title: '收藏夹/稍后读',
})

const bookmarks = ref<Bookmark[]>([])
const searchQuery = ref('')
const selectedTag = ref('')
const filterMode = ref<'all' | 'unread' | 'read'>('all')
const showForm = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const loading = ref(false)
const syncing = ref(false)
const pagination = ref<Pagination>({
  total: 0,
  page: 1,
  pageSize: 100,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
})

const formData = reactive({
  url: '',
  title: '',
  description: '',
  tagsInput: '',
})

// 是否使用后端存储
const useRemote = computed(() => userStore.isLoggedIn)

// 所有标签（自动收集）
const allTags = computed(() => {
  const tagSet = new Set<string>()
  bookmarks.value.forEach(b => b.tags.forEach(t => tagSet.add(t)))
  return Array.from(tagSet).sort()
})

// 未读数量
const unreadCount = computed(() => bookmarks.value.filter(b => !b.isRead).length)

// 过滤后的书签
const filteredBookmarks = computed(() => {
  let list = bookmarks.value.filter(b => {
    if (filterMode.value === 'unread' && b.isRead) return false
    if (filterMode.value === 'read' && !b.isRead) return false
    if (selectedTag.value && !b.tags.includes(selectedTag.value)) return false
    return true
  })

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  return list.sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime())
})

// ==================== 数据加载 ====================

// 登录状态变化时重新加载
watch(() => userStore.isLoggedIn, async (loggedIn) => {
  if (loggedIn) {
    // 登录后检查本地数据，同步到云端
    await syncLocalToRemote()
  }
  loadData()
})

// 从 localStorage 加载
const loadLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    bookmarks.value = raw ? JSON.parse(raw) : []
  } catch {
    bookmarks.value = []
  }
}

// 保存到 localStorage
const saveLocal = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks.value))
}

// 从后端加载
const loadRemote = async () => {
  try {
    loading.value = true
    const response = await functionsRequest.get('/api/bookmarks', {
      params: { page: 1, pageSize: 10000 }
    })
    if (response.status === 200) {
      const data = response.data
      const items = (data.data || []).map((item: any) => ({
        ...item,
        isRead: !!item.isRead,
      }))
      bookmarks.value = items
      if (data.pagination) {
        pagination.value = data.pagination
      }
    }
  } catch (error) {
    console.error('获取书签列表失败:', error)
    bookmarks.value = []
  } finally {
    loading.value = false
  }
}

// 加载数据（根据登录状态自动选择）
const loadData = () => {
  if (useRemote.value) {
    loadRemote()
  } else {
    loadLocal()
  }
}

// 登录后将本地书签同步到云端
const syncLocalToRemote = async () => {
  let local
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    local = raw ? JSON.parse(raw) : []
  } catch {
    return
  }
  if (!local || local.length === 0) return

  syncing.value = true
  let successCount = 0
  for (const item of local) {
    if (!item.url) continue
    try {
      const res = await functionsRequest.post('/api/bookmarks', {
        url: item.url,
        title: item.title || '',
        description: item.description || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        isRead: !!item.isRead,
      })
      if (res.status === 201) successCount++
    } catch {
      // 跳过重复等错误
    }
  }
  if (successCount > 0) {
    ElMessage.success(`已将 ${successCount} 条本地书签同步到云端`)
    localStorage.removeItem(STORAGE_KEY)
  }
  syncing.value = false
}

// ==================== 添加/编辑 ====================

const handleSubmit = async () => {
  if (!formData.url.trim()) {
    ElMessage.warning('请输入链接地址')
    return
  }

  let url = formData.url.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }

  const tags = formData.tagsInput
    .split(/[,，\s]+/)
    .map(t => t.trim())
    .filter(Boolean)

  const now = new Date().toISOString()

  if (useRemote.value) {
    if (isEditing.value && editingId.value) {
      try {
        loading.value = true
        const response = await functionsRequest.put(`/api/bookmarks/${editingId.value}`, {
          url,
          title: formData.title.trim() || extractTitle(url),
          description: formData.description.trim(),
          tags,
        })
        if (response.status === 200) {
          ElMessage.success('更新成功')
          showForm.value = false
          resetForm()
          await loadRemote()
        }
      } catch (error) {
        console.error('更新书签失败:', error)
        ElMessage.error('更新失败')
      } finally {
        loading.value = false
      }
    } else {
      try {
        loading.value = true
        const response = await functionsRequest.post('/api/bookmarks', {
          url,
          title: formData.title.trim() || extractTitle(url),
          description: formData.description.trim(),
          tags,
          isRead: false,
        })
        if (response.status === 201) {
          ElMessage.success('收藏成功')
          showForm.value = false
          resetForm()
          await loadRemote()
        }
      } catch (error) {
        console.error('创建书签失败:', error)
        ElMessage.error('收藏失败')
      } finally {
        loading.value = false
      }
    }
  } else {
    // localStorage 模式
    if (isEditing.value && editingId.value) {
      const idx = bookmarks.value.findIndex(b => b.id === editingId.value)
      if (idx !== -1) {
        bookmarks.value[idx] = {
          ...bookmarks.value[idx],
          url,
          title: formData.title.trim() || extractTitle(url),
          description: formData.description.trim(),
          tags,
          updateTime: now,
        }
      }
      ElMessage.success('更新成功')
    } else {
      const bookmark: Bookmark = {
        id: uuidv4(),
        url,
        title: formData.title.trim() || extractTitle(url),
        description: formData.description.trim(),
        tags,
        isRead: false,
        createTime: now,
        updateTime: now,
      }
      bookmarks.value.unshift(bookmark)
      ElMessage.success('收藏成功')
    }
    saveLocal()
    resetForm()
    showForm.value = false
  }
}

// ==================== 删除 ====================

const deleteBookmark = async (bookmark: Bookmark) => {
  await ElMessageBox.confirm(`确定删除「${bookmark.title}」吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })

  if (useRemote.value) {
    try {
      loading.value = true
      const response = await functionsRequest.delete(`/api/bookmarks/${bookmark.id}`)
      if (response.status === 200) {
        ElMessage.success('已删除')
        await loadRemote()
      }
    } catch (error) {
      console.error('删除书签失败:', error)
      ElMessage.error('删除失败')
    } finally {
      loading.value = false
    }
  } else {
    bookmarks.value = bookmarks.value.filter(b => b.id !== bookmark.id)
    saveLocal()
    ElMessage.success('已删除')
  }
}

// ==================== 其他操作 ====================

const editBookmark = (bookmark: Bookmark) => {
  isEditing.value = true
  editingId.value = bookmark.id
  formData.url = bookmark.url
  formData.title = bookmark.title
  formData.description = bookmark.description
  formData.tagsInput = bookmark.tags.join(', ')
  showForm.value = true
}

const newBookmark = () => {
  isEditing.value = false
  editingId.value = null
  resetForm()
  showForm.value = true
}

const resetForm = () => {
  formData.url = ''
  formData.title = ''
  formData.description = ''
  formData.tagsInput = ''
}

const toggleRead = async (bookmark: Bookmark) => {
  bookmark.isRead = !bookmark.isRead
  bookmark.updateTime = new Date().toISOString()

  if (useRemote.value) {
    try {
      await functionsRequest.put(`/api/bookmarks/${bookmark.id}`, {
        isRead: bookmark.isRead,
      })
    } catch (error) {
      console.error('更新阅读状态失败:', error)
      // 回滚
      bookmark.isRead = !bookmark.isRead
      return
    }
  } else {
    saveLocal()
  }
}

const openUrl = (url: string) => {
  window.open(url, '_blank')
}

const extractTitle = (url: string) => {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const getFavicon = (url: string) => {
  try {
    const u = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`
  } catch {
    return ''
  }
}

// ==================== 导入/导出 ====================

const exportData = () => {
  const data = JSON.stringify(bookmarks.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

const downloadTemplate = () => {
  const sample = [
    {
      url: 'https://github.com',
      title: 'GitHub',
      description: '代码托管平台，全球最大的开源社区',
      tags: ['开发', '代码'],
      isRead: false
    },
    {
      url: 'https://news.ycombinator.com',
      title: 'Hacker News',
      description: '科技新闻与讨论社区',
      tags: ['资讯'],
      isRead: true
    }
  ]
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bookmarks-template.json'
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已下载导入模板')
}

const importData = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('格式错误')

      if (useRemote.value) {
        // 逐个导入到后端
        let success = 0
        for (const item of data) {
          if (!item.url) continue
          try {
            const res = await functionsRequest.post('/api/bookmarks', {
              url: item.url,
              title: item.title || '',
              description: item.description || '',
              tags: Array.isArray(item.tags) ? item.tags : [],
              isRead: !!item.isRead,
            })
            if (res.status === 201) success++
          } catch {
            // skip duplicates
          }
        }
        ElMessage.success(`导入完成，成功 ${success} 条`)
        await loadRemote()
      } else {
        const existingIds = new Set(bookmarks.value.map(b => b.id))
        let added = 0
        data.forEach((item: any) => {
          if (item.id && item.url && !existingIds.has(item.id)) {
            bookmarks.value.push({
              id: item.id,
              url: item.url,
              title: item.title || '',
              description: item.description || '',
              tags: Array.isArray(item.tags) ? item.tags : [],
              isRead: !!item.isRead,
              createTime: item.createTime || new Date().toISOString(),
              updateTime: item.updateTime || new Date().toISOString(),
            })
            existingIds.add(item.id)
            added++
          }
        })
        saveLocal()
        ElMessage.success(`导入成功，新增 ${added} 条书签`)
      }
    } catch {
      ElMessage.error('导入失败，请检查 JSON 格式是否正确，可点击 ? 按钮下载导入模板参考')
    }
  }
  input.click()
}

const formatTime = (timeStr: string) => {
  return new Date(timeStr).toLocaleString('zh-CN')
}

const relativeTime = (timeStr: string) => {
  const diff = Date.now() - new Date(timeStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return formatTime(timeStr)
}

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    const searchInput = document.querySelector('.search-input input') as HTMLInputElement
    searchInput?.focus()
  }
}

onMounted(async () => {
  // 如果已登录且有本地书签，先同步到云端
  if (userStore.isLoggedIn) {
    await syncLocalToRemote()
  }
  loadData()
  document.addEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="bookmarks-container">
      <!-- 未登录提示 -->
      <div v-if="!userStore.isLoggedIn" class="mode-banner mode-local" style="justify-content:space-between">
        <span>
          <el-icon class="mode-icon"><Link /></el-icon>
          本地存储模式，登录后可同步到云端
        </span>
        <el-button size="small" type="primary" @click="goToLogin">登录</el-button>
      </div>
      <div v-else class="mode-banner mode-remote">
        <el-icon class="mode-icon"><Connection /></el-icon>
        <span>已连接到云端，数据自动同步</span>
      </div>

      <!-- 统计栏 -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">总收藏</span>
          <span class="stat-value">{{ bookmarks.length }}</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-label">未读</span>
          <span class="stat-value">{{ unreadCount }}</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-label">已读</span>
          <span class="stat-value">{{ bookmarks.length - unreadCount }}</span>
        </div>
      </div>

      <!-- 搜索与操作栏 -->
      <div class="toolbar">
        <div class="toolbar-search">
          <el-input
            v-model="searchQuery"
            placeholder="搜索标题、链接、描述或标签... (Ctrl+K)"
            :prefix-icon="Search"
            size="large"
            clearable
            class="search-input"
          />
        </div>
        <div class="toolbar-actions">
          <el-button
            class="action-btn"
            @click="loadData"
            :icon="Refresh"
            :loading="loading"
            circle
          />
          <el-button
            class="action-btn"
            @click="importData"
            :icon="Upload"
            circle
          />
          <el-button
            class="action-btn"
            @click="exportData"
            :icon="Download"
            circle
          />
          <el-tooltip content="下载导入模板" placement="bottom">
            <el-button
              class="action-btn"
              @click="downloadTemplate"
              circle
            >
              <span style="font-size:16px;font-weight:700">?</span>
            </el-button>
          </el-tooltip>
          <el-button
            type="primary"
            @click="newBookmark"
            :icon="Plus"
            class="add-btn"
          >
            添加收藏
          </el-button>
        </div>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <div class="filter-tabs">
          <button
            class="filter-tab"
            :class="{ active: filterMode === 'all' }"
            @click="filterMode = 'all'"
          >
            全部
          </button>
          <button
            class="filter-tab"
            :class="{ active: filterMode === 'unread' }"
            @click="filterMode = 'unread'"
          >
            稍后读
            <span v-if="unreadCount > 0" class="tab-badge">{{ unreadCount }}</span>
          </button>
          <button
            class="filter-tab"
            :class="{ active: filterMode === 'read' }"
            @click="filterMode = 'read'"
          >
            已读
          </button>
        </div>
        <div v-if="allTags.length > 0" class="tag-filters">
          <span class="tag-label">标签：</span>
          <button
            class="tag-chip"
            :class="{ active: selectedTag === '' }"
            @click="selectedTag = ''"
          >
            全部
          </button>
          <button
            v-for="tag in allTags"
            :key="tag"
            class="tag-chip"
            :class="{ active: selectedTag === tag }"
            @click="selectedTag = selectedTag === tag ? '' : tag"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <!-- 书签列表 -->
      <div v-loading="loading" class="bookmark-list">
        <div v-if="filteredBookmarks.length > 0" class="card-grid">
          <TransitionGroup name="list">
            <div
              v-for="bookmark in filteredBookmarks"
              :key="bookmark.id"
              class="bookmark-card"
            >
              <div class="card-favicon">
              <img
                :src="getFavicon(bookmark.url)"
                :alt="bookmark.title"
                @error="(e: any) => { e.target.src = '/images/logo/link.png'; e.target.onerror = null }"
              />
            </div>
            <div class="card-body" @click="openUrl(bookmark.url)">
              <div class="card-title-row">
                <h3 class="card-title">{{ bookmark.title }}</h3>
                <el-tag
                  v-if="!bookmark.isRead"
                  size="small"
                  type="warning"
                  effect="dark"
                  class="unread-tag"
                >
                  稍后读
                </el-tag>
              </div>
              <p class="card-domain">{{ getDomain(bookmark.url) }}</p>
              <p v-if="bookmark.description" class="card-desc">{{ bookmark.description }}</p>
              <div class="card-meta">
                <div v-if="bookmark.tags.length > 0" class="card-tags">
                  <el-tag
                    v-for="tag in bookmark.tags"
                    :key="tag"
                    size="small"
                    class="card-tag"
                    type="info"
                    effect="plain"
                  >
                    {{ tag }}
                  </el-tag>
                </div>
                <span class="card-time">{{ relativeTime(bookmark.updateTime) }}</span>
              </div>
            </div>
            <div class="card-actions">
              <el-button
                size="small"
                :icon="Link"
                @click="openUrl(bookmark.url)"
                circle
                plain
                title="打开链接"
              />
              <el-button
                size="small"
                :icon="bookmark.isRead ? StarFilled : Star"
                :type="bookmark.isRead ? 'warning' : 'default'"
                @click="toggleRead(bookmark)"
                circle
                plain
                :title="bookmark.isRead ? '标记为未读' : '标记为已读'"
                :disabled="loading"
              />
              <el-button
                size="small"
                type="primary"
                :icon="Edit"
                @click="editBookmark(bookmark)"
                circle
                plain
                :disabled="loading"
              />
              <el-button
                size="small"
                type="danger"
                :icon="Delete"
                @click="deleteBookmark(bookmark)"
                circle
                plain
                :disabled="loading"
              />
            </div>
          </div>
        </TransitionGroup>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredBookmarks.length === 0 && !loading" class="empty-state">
          <div class="empty-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" opacity="0.5"/>
            </svg>
          </div>
          <h3 class="empty-title" v-if="bookmarks.length === 0">还没有收藏</h3>
          <h3 class="empty-title" v-else>没有匹配的书签</h3>
          <p class="empty-desc" v-if="bookmarks.length === 0">开始收藏你感兴趣的网页链接吧</p>
          <p class="empty-desc" v-else>试试其他搜索词或筛选条件</p>
          <el-button
            v-if="bookmarks.length === 0"
            type="primary"
            @click="newBookmark"
            :icon="Plus"
          >
            添加第一个收藏
          </el-button>
        </div>
      </div>

      <!-- 底部栏 -->
      <div v-if="bookmarks.length > 0" class="footer-bar">
        <span class="footer-count">共 {{ bookmarks.length }} 条收藏</span>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog
      v-model="showForm"
      :title="isEditing ? '编辑收藏' : '添加收藏'"
      width="90%"
      max-width="580px"
      class="bookmark-dialog"
      @close="isEditing = false"
      destroy-on-close
    >
      <div class="form-container">
        <el-form :model="formData" label-position="top">
          <el-form-item label="链接地址" required class="form-item">
            <el-input
              v-model="formData.url"
              placeholder="https://example.com"
              size="large"
              class="url-input"
            />
          </el-form-item>
          <el-form-item label="标题" class="form-item">
            <el-input
              v-model="formData.title"
              placeholder="留空则自动使用域名"
              size="large"
              class="title-input"
            />
          </el-form-item>
          <el-form-item label="描述" class="form-item">
            <el-input
              v-model="formData.description"
              type="textarea"
              :rows="3"
              placeholder="简要描述这个链接的内容..."
              class="desc-textarea"
              resize="vertical"
            />
          </el-form-item>
          <el-form-item label="标签" class="form-item">
            <el-input
              v-model="formData.tagsInput"
              placeholder="用逗号分隔多个标签，如：技术, 前端, Vue"
              class="tags-input"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            size="large"
            :disabled="loading"
            @click="showForm = false; isEditing = false"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            :disabled="loading"
            @click="handleSubmit"
          >
            {{ isEditing ? '保存修改' : '添加收藏' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- desc -->
    <ToolDetail title="工具描述">
      <el-text>
        在线收藏夹与稍后读工具，帮你收藏和管理感兴趣的网页链接。支持标签分类、阅读状态标记、搜索筛选。
        未登录时数据保存在浏览器本地，登录后自动同步到云端，多设备共享。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.bookmarks-container {
  padding: 24px;
  min-height: 600px;
  background: #fef7ed;
  border-radius: 16px;
  border: 1.5px solid #fdead5;
}

/* 模式提示 */
.mode-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  margin-bottom: 20px;
  font-size: 13px;
  font-weight: 500;
}

.mode-banner.mode-remote {
  background: #ecfdf5;
  color: #065f46;
}

.mode-banner.mode-local {
  background: #fffbeb;
  color: #92400e;
}

.mode-icon {
  font-size: 16px;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #7c2d12;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #b45309;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: #fdba74;
}

/* 操作栏 */
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.toolbar-search {
  flex: 1;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 10px;
  background: #fff;
  border: 1.5px solid #fdba74;
  transition: all 0.2s ease;
  box-shadow: none;
}

.search-input :deep(.el-input__wrapper:hover),
.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: #f97316;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.08);
}

.toolbar-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.action-btn {
  border: 1.5px solid #fdba74 !important;
  background: #fff !important;
  color: #b45309 !important;
  box-shadow: none !important;
  transition: all 0.2s ease;
}

.action-btn:hover {
  border-color: #f97316 !important;
  color: #f97316 !important;
  transform: none !important;
  box-shadow: none !important;
}

.add-btn {
  background: #f97316 !important;
  border: none !important;
  padding: 10px 20px;
  font-weight: 600;
  box-shadow: none !important;
}

.add-btn:hover {
  background: #ea580c !important;
  transform: none !important;
  box-shadow: none !important;
}

/* 筛选栏 */
.filter-bar {
  background: #fff;
  border: 1.5px solid #fdead5;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 20px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
}

.filter-tab {
  padding: 5px 14px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #b45309;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
}

.filter-tab:hover {
  background: #ffedd5;
  color: #7c2d12;
}

.filter-tab.active {
  background: #fff7ed;
  color: #f97316;
  font-weight: 600;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #f97316;
  color: #fff;
  font-size: 11px;
  margin-left: 4px;
}

.tag-filters {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding-top: 10px;
  border-top: 1px solid #fdead5;
}

.tag-label {
  font-size: 13px;
  color: #fdba74;
  margin-right: 4px;
}

.tag-chip {
  padding: 2px 10px;
  border-radius: 6px;
  border: 1px solid #fdba74;
  background: #fff;
  color: #b45309;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tag-chip:hover {
  border-color: #f97316;
  color: #f97316;
}

.tag-chip.active {
  background: #fff7ed;
  color: #f97316;
  border-color: #f97316;
}

/* 书签列表 */
.bookmark-list {
  margin-bottom: 16px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 6px;
}

.bookmark-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #fffbeb;
  border: 1.5px solid #fdead5;
  border-radius: 10px;
  padding: 10px 12px;
  transition: all 0.15s ease;
  cursor: default;
}

.bookmark-card:hover {
  border-color: #fdba74;
  background: #fff;
}

.card-favicon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #fdead5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-favicon img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.card-body {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: #7c2d12;
  margin: 0;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-tag {
  flex-shrink: 0;
  padding: 0 5px;
  height: 16px;
  line-height: 16px;
  font-size: 9px;
  border-radius: 2px;
  background: #fef3c7 !important;
  color: #b45309 !important;
  border: none !important;
  font-weight: 600;
}

.card-domain {
  font-size: 11px;
  color: #fdba74;
  margin: 0;
  line-height: 1.2;
}

.card-desc {
  font-size: 12px;
  color: #92400e;
  margin: 2px 0 0 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.card-tags {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.card-tag {
  padding: 0 5px;
  height: 18px;
  line-height: 18px;
  font-size: 9px !important;
  border-radius: 2px !important;
  background: #ffedd5 !important;
  border: none !important;
  color: #b45309 !important;
}

.card-time {
  font-size: 10px;
  color: #b45309;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.bookmark-card:hover .card-actions {
  opacity: 1;
}

.card-actions .el-button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none !important;
  background: transparent !important;
  color: #b45309 !important;
  transition: color 0.15s ease;
  margin-left: 0 !important;
}

.card-actions .el-button:hover {
  transform: none !important;
}

.card-actions .el-button--warning {
  color: #f59e0b !important;
}

.card-actions .el-button--primary:hover {
  color: #f97316 !important;
}

.card-actions .el-button--danger:hover {
  color: #ef4444 !important;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: #fff;
  border: 1.5px solid #f1f5f9;
  border-radius: 12px;
}

.empty-icon {
  color: #cbd5e0;
  margin-bottom: 20px;
  text-align: center;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 6px 0;
}

.empty-desc {
  font-size: 14px;
  color: #94a3b8;
  margin: 0 0 24px 0;
}

/* 底部栏 */
.footer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border: 1.5px solid #f1f5f9;
  border-radius: 10px;
  backdrop-filter: blur(20px);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.footer-count {
  font-size: 14px;
  color: #718096;
}

/* 弹窗样式 */
:deep(.bookmark-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
}

:deep(.bookmark-dialog .el-dialog__header) {
  background: #fff;
  color: #1e293b;
  padding: 20px 28px;
  border-bottom: 1.5px solid #f1f5f9;
}

:deep(.bookmark-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
}

:deep(.bookmark-dialog .el-dialog__body) {
  padding: 24px 28px;
  background: #fff;
}

.form-container {
  max-width: 100%;
}

.form-item {
  margin-bottom: 18px;
}

:deep(.form-item .el-form-item__label) {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

:deep(.url-input .el-input__wrapper),
:deep(.title-input .el-input__wrapper),
:deep(.tags-input .el-input__wrapper) {
  border-radius: 8px;
  padding: 8px 12px;
  border: 1.5px solid #e2e8f0;
  transition: all 0.2s ease;
  background: #f8fafc;
}

:deep(.url-input .el-input__wrapper:hover),
:deep(.title-input .el-input__wrapper:hover),
:deep(.tags-input .el-input__wrapper:hover) {
  border-color: #2563eb;
  background: #fff;
}

:deep(.url-input .el-input__wrapper.is-focus),
:deep(.title-input .el-input__wrapper.is-focus),
:deep(.tags-input .el-input__wrapper.is-focus) {
  border-color: #2563eb;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

:deep(.desc-textarea .el-textarea__inner) {
  border-radius: 8px;
  padding: 10px 12px;
  border: 1.5px solid #e2e8f0;
  transition: all 0.2s ease;
  font-family: inherit;
  background: #f8fafc;
}

:deep(.desc-textarea .el-textarea__inner:hover) {
  border-color: #2563eb;
  background: #fff;
}

:deep(.desc-textarea .el-textarea__inner:focus) {
  border-color: #2563eb;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 28px;
  background: #fff;
  border-top: 1.5px solid #f1f5f9;
}

/* 列表动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.list-move {
  transition: transform 0.4s ease;
}

/* 响应式 */
@media (max-width: 768px) {
  .bookmarks-container {
    padding: 0;
  }

  .stats-bar {
    gap: 16px;
  }

  .stat-value {
    font-size: 18px;
  }

  .toolbar {
    flex-direction: column;
  }

  .toolbar-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .filter-bar {
    padding: 12px 14px;
  }

  .filter-tabs {
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .filter-tab {
    white-space: nowrap;
    font-size: 13px;
    padding: 4px 12px;
  }

  .card-grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .bookmark-card {
    padding: 8px 10px;
  }

  .card-favicon {
    width: 24px;
    height: 24px;
  }

  .card-favicon img {
    width: 14px;
    height: 14px;
  }

  .card-actions {
    opacity: 1;
  }

  .card-title {
    font-size: 13px;
  }

  :deep(.bookmark-dialog .el-dialog__body) {
    padding: 20px;
  }

  :deep(.bookmark-dialog .el-dialog__header) {
    padding: 18px 20px;
  }
}
</style>

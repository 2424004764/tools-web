<script setup lang="ts">
import { reactive } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'
import { getLocalToken, isTokenExpired } from '@/utils/user'

const info = reactive({
  title: '在线写信工具',
})

interface Letter {
  id?: number
  slug: string
  title: string
  recipient: string
  sender: string
  style: string
  theme: string
  content: string
  createdAt?: string
}

const state = reactive({
  // 表单数据
  title: '',
  recipient: '',
  sender: '',
  style: 'formal',
  theme: 'other',
  content: '',

  // 生成结果
  resultSlug: '',
  loading: false,

  // 历史记录
  recentLetters: [] as Letter[],

  // 预览开关
  showPreview: false,
})

const siteBase = window.location.origin + '/letter/'

const token = getLocalToken()
const loggedIn = !!(token && !isTokenExpired(token))

// 风格选项
const styleOptions = [
  { value: 'formal', label: '正式商务' },
  { value: 'casual', label: '友好随意' },
  { value: 'romantic', label: '浪漫温馨' },
  { value: 'vintage', label: '复古怀旧' },
  { value: 'modern', label: '简约现代' },
]

// 主题选项
const themeOptions = [
  { value: 'thanks', label: '感谢信' },
  { value: 'invitation', label: '邀请函' },
  { value: 'apology', label: '道歉信' },
  { value: 'blessing', label: '祝福信' },
  { value: 'love', label: '情书' },
  { value: 'other', label: '其他' },
]

// 获取请求头（携带 token）
const authHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token && !isTokenExpired(token)) {
    h['Authorization'] = `Bearer ${token}`
  }
  return h
}

// 从服务端加载信件列表
const fetchServerLetters = async () => {
  try {
    const res = await fetch('/api/letters', { headers: authHeaders() })
    if (!res.ok) return
    const body = await res.json()
    if (body?.data?.data) {
      state.recentLetters = body.data.data.map((item: any) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        recipient: item.recipient,
        sender: item.sender,
        style: item.style,
        theme: item.theme,
        content: item.content,
        createdAt: new Date(item.createTime).toLocaleString(),
      }))
    }
  } catch {
    // ignore
  }
}

// 从 localStorage 加载最近信件
const loadLocalLetters = () => {
  try {
    const saved = localStorage.getItem('letters_recent')
    if (saved) {
      state.recentLetters = JSON.parse(saved)
    }
  } catch {
    // ignore
  }
}

const saveLocalLetters = () => {
  try {
    localStorage.setItem('letters_recent', JSON.stringify(state.recentLetters.slice(0, 20)))
  } catch {
    // ignore
  }
}

// 初始化：登录用户从服务端加载，未登录从 localStorage 加载
if (loggedIn) {
  fetchServerLetters()
} else {
  loadLocalLetters()
}

// 生成信件
const generate = async () => {
  if (!state.title.trim()) {
    ElMessage.warning('请输入信件标题')
    return
  }

  if (!state.recipient.trim()) {
    ElMessage.warning('请输入收件人')
    return
  }

  if (!state.sender.trim()) {
    ElMessage.warning('请输入署名')
    return
  }

  if (!state.content.trim()) {
    ElMessage.warning('请输入信件内容')
    return
  }

  state.loading = true
  state.resultSlug = ''

  try {
    if (loggedIn) {
      // 登录用户：调用服务器 API
      const body = {
        title: state.title.trim(),
        recipient: state.recipient.trim(),
        sender: state.sender.trim(),
        style: state.style,
        theme: state.theme,
        content: state.content.trim(),
      }

      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        ElMessage.error(data.error || '创建失败')
        return
      }

      state.resultSlug = data.data.slug
      await fetchServerLetters()
    } else {
      // 未登录用户：本地生成 slug 和保存
      const slug = Math.random().toString(36).substring(2, 10)

      const letter = {
        slug: slug,
        title: state.title.trim(),
        recipient: state.recipient.trim(),
        sender: state.sender.trim(),
        style: state.style,
        theme: state.theme,
        content: state.content.trim(),
        createTime: Date.now(),
      }

      // 保存到本地存储（用于查看页面读取）
      const localLetters = JSON.parse(localStorage.getItem('letters_storage') || '{}')
      localLetters[slug] = letter
      localStorage.setItem('letters_storage', JSON.stringify(localLetters))

      state.resultSlug = slug

      // 添加到历史记录
      state.recentLetters.unshift({
        slug: slug,
        title: letter.title,
        recipient: letter.recipient,
        sender: letter.sender,
        style: letter.style,
        theme: letter.theme,
        content: letter.content,
        createdAt: new Date().toLocaleString(),
      })
      saveLocalLetters()
    }

    ElMessage.success('信件创建成功！')
  } catch (error) {
    console.error('创建信件失败:', error)
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    state.loading = false
  }
}

// 复制链接
const copySlug = (slug: string) => {
  copy(siteBase + slug)
  ElMessage.success('已复制到剪贴板')
}

// 打开信件
const openLetter = (slug: string) => {
  window.open(siteBase + slug, '_blank')
}

// 删除信件
const deleteRecent = async (index: number) => {
  const item = state.recentLetters[index]
  if (!item) return
  if (loggedIn && item.id) {
    try {
      await fetch(`/api/letters/${item.id}`, { method: 'DELETE', headers: authHeaders() })
    } catch {
      // ignore
    }
    await fetchServerLetters()
  } else {
    state.recentLetters.splice(index, 1)
    saveLocalLetters()
  }
  ElMessage.success('已删除')
}

// 清空表单
const clearForm = () => {
  state.title = ''
  state.recipient = ''
  state.sender = ''
  state.style = 'formal'
  state.theme = 'other'
  state.content = ''
  state.resultSlug = ''
}

// 获取主题的中文名称
const getThemeLabel = (theme: string) => {
  return themeOptions.find(t => t.value === theme)?.label || '其他'
}

// 获取风格样式类名
const getStyleClass = (style: string) => {
  const styleMap: Record<string, string> = {
    formal: 'letter-formal',
    casual: 'letter-casual',
    romantic: 'letter-romantic',
    vintage: 'letter-vintage',
    modern: 'letter-modern',
  }
  return styleMap[style] || 'letter-formal'
}

// 切换预览
const togglePreview = () => {
  state.showPreview = !state.showPreview
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- 编辑区和预览区 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- 左侧：编辑表单 -->
      <div class="p-4 rounded-2xl bg-white space-y-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-medium text-gray-800">编辑信件</h3>
          <el-button
            type="primary"
            link
            @click="togglePreview"
            class="lg:hidden"
          >
            {{ state.showPreview ? '隐藏预览' : '显示预览' }}
          </el-button>
        </div>

        <!-- 收件人 -->
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-700">收件人</label>
          <el-input
            v-model="state.recipient"
            placeholder="请输入收件人姓名"
            maxlength="100"
          />
        </div>

        <!-- 信件标题 -->
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-700">信件标题</label>
          <el-input
            v-model="state.title"
            placeholder="请输入信件标题"
            maxlength="200"
          />
        </div>

        <!-- 风格和主题 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700">信纸风格</label>
            <el-select v-model="state.style" placeholder="选择风格" style="width: 100%">
              <el-option
                v-for="option in styleOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-700">信件主题</label>
            <el-select v-model="state.theme" placeholder="选择主题" style="width: 100%">
              <el-option
                v-for="option in themeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>
        </div>

        <!-- 正文内容 -->
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-700">信件正文</label>
          <el-input
            v-model="state.content"
            type="textarea"
            :rows="10"
            placeholder="请输入信件内容..."
            maxlength="10000"
            show-word-limit
          />
        </div>

        <!-- 署名 -->
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-700">署名/落款</label>
          <el-input
            v-model="state.sender"
            placeholder="请输入署名"
            maxlength="100"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2">
          <el-button type="primary" size="large" class="flex-1" :loading="state.loading" @click="generate">
            {{ state.loading ? '生成中...' : '💌 生成信件链接' }}
          </el-button>
          <el-button size="large" @click="clearForm">清空</el-button>
        </div>

        <!-- 结果 -->
        <div v-if="state.resultSlug" class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="text-sm font-medium text-green-700 mb-2">生成成功！</div>
          <div class="flex flex-col md:flex-row items-start md:items-center gap-2">
            <span class="text-base font-mono font-bold text-green-600 select-all break-all">
              {{ siteBase + state.resultSlug }}
            </span>
            <div class="flex gap-2">
              <el-button type="success" size="small" @click="copySlug(state.resultSlug)">📋 复制链接</el-button>
              <el-button type="success" size="small" plain @click="openLetter(state.resultSlug)">📖 查看信件</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：实时预览 -->
      <div
        class="p-4 rounded-2xl bg-white"
        :class="state.showPreview || 'hidden lg:block'"
      >
        <h3 class="text-lg font-medium text-gray-800 mb-4">实时预览</h3>

        <div v-if="!state.title && !state.recipient && !state.content && !state.sender" class="flex items-center justify-center h-[400px] text-gray-400">
          <div class="text-center">
            <div class="text-6xl mb-4">📝</div>
            <div>在左侧填写信件内容后<br>这里会显示预览效果</div>
          </div>
        </div>

        <div v-else :class="['letter-preview', getStyleClass(state.style)]">
          <!-- 信头 -->
          <div class="letter-header" v-if="state.recipient">
            <div class="letter-recipient">致: {{ state.recipient }}</div>
          </div>

          <!-- 标题 -->
          <div class="letter-title" v-if="state.title">{{ state.title }}</div>

          <!-- 正文 -->
          <div class="letter-content" v-if="state.content">{{ state.content }}</div>

          <!-- 落款 -->
          <div class="letter-footer" v-if="state.sender">
            <div class="letter-sender">{{ state.sender }}</div>
            <div class="letter-date">{{ new Date().toLocaleDateString() }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的信件历史 -->
    <div v-if="state.recentLetters.length > 0" class="mt-4 p-4 rounded-2xl bg-white">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-medium text-gray-700">我的信件历史</h3>
        <span class="text-xs text-gray-400">{{ loggedIn ? '云端保存' : '本地保存' }}</span>
      </div>
      <div class="space-y-2">
        <div
          v-for="(item, index) in state.recentLetters"
          :key="item.slug"
          class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
        >
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-800 truncate">{{ item.title }}</div>
            <div class="text-sm text-gray-500">
              收件人: {{ item.recipient }} | 主题: {{ getThemeLabel(item.theme) }}
            </div>
            <div v-if="item.createdAt" class="text-xs text-gray-400 mt-1">{{ item.createdAt }}</div>
          </div>
          <div class="flex gap-1 flex-shrink-0">
            <el-button size="small" @click="openLetter(item.slug)">查看</el-button>
            <el-button size="small" @click="copySlug(item.slug)">复制</el-button>
            <el-button size="small" type="danger" @click="deleteRecent(index)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="描述">
      <el-text>
        在线写信工具，支持多种精美信纸风格和主题。编写信件后会生成唯一的分享链接，永久保存，可随时查看和分享。<br>
        <strong>已登录用户：</strong>信件保存在云端，可在任意设备查看历史记录。<br>
        <strong>未登录用户：</strong>信件保存在本地浏览器，仅当前设备可见。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 预览信件样式 */
.letter-preview {
  background: white;
  border-radius: 8px;
  padding: 2rem 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  line-height: 1.8;
  font-size: 15px;
  min-height: 400px;
}

@media (min-width: 768px) {
  .letter-preview {
    padding: 3rem 2rem;
  }
}

.letter-header {
  margin-bottom: 1.5rem;
}

.letter-recipient {
  font-size: 1rem;
  color: #4b5563;
  font-weight: 500;
}

.letter-title {
  font-size: 1.3rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 1.5rem;
  color: #1f2937;
}

.letter-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 2rem;
  color: #374151;
  text-indent: 2em;
}

.letter-footer {
  text-align: right;
  color: #6b7280;
}

.letter-sender {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.letter-date {
  font-size: 0.875rem;
  color: #9ca3af;
}

/* 正式商务风格 */
.letter-formal {
  background: linear-gradient(to bottom, #ffffff 0%, #f9fafb 100%);
  font-family: 'Times New Roman', serif, '宋体';
  border: 1px solid #e5e7eb;
}

.letter-formal .letter-title {
  color: #1e40af;
  border-bottom: 2px solid #3b82f6;
  padding-bottom: 0.5rem;
}

/* 友好随意风格 */
.letter-casual {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  font-family: 'Arial', '微软雅黑', sans-serif;
  border: 2px dashed #f59e0b;
}

.letter-casual .letter-title {
  color: #ea580c;
}

/* 浪漫温馨风格 */
.letter-romantic {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  font-family: 'Georgia', '楷体', serif;
  border: 2px solid #f472b6;
  position: relative;
}

.letter-romantic::before {
  content: '💕';
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 2rem;
  opacity: 0.3;
}

.letter-romantic .letter-title {
  color: #be185d;
}

/* 复古怀旧风格 */
.letter-vintage {
  background: linear-gradient(to bottom, #fef3c7 0%, #fde68a 100%);
  font-family: 'Courier New', '仿宋', monospace;
  border: 3px double #92400e;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.letter-vintage .letter-title {
  color: #78350f;
  font-style: italic;
}

/* 简约现代风格 */
.letter-modern {
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
  border-left: 4px solid #3b82f6;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.letter-modern .letter-title {
  color: #111827;
  font-weight: 700;
  border-bottom: none;
}

.letter-modern .letter-content {
  color: #1f2937;
}
</style>

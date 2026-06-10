<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { copy } from '@/utils/string'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

const route = useRoute()

interface Letter {
  slug: string
  title: string
  recipient: string
  sender: string
  style: string
  theme: string
  content: string
  createTime: number
}

const state = reactive({
  loading: true,
  error: '',
  letter: null as Letter | null,
})

// 加载信件
const loadLetter = async () => {
  const slug = route.params.slug as string
  if (!slug) {
    state.error = '无效的链接'
    state.loading = false
    return
  }

  try {
    // 先尝试从本地存储读取
    const localLetters = JSON.parse(localStorage.getItem('letters_storage') || '{}')
    if (localLetters[slug]) {
      state.letter = localLetters[slug]
      state.loading = false
      return
    }

    // 本地没有，尝试从服务器获取
    const res = await fetch(`/api/letter/${slug}`)
    const data = await res.json()

    if (!res.ok) {
      state.error = data.error || '信件不存在'
      state.loading = false
      return
    }

    state.letter = data
    state.loading = false
  } catch (error) {
    console.error('加载信件失败:', error)
    state.error = '加载失败，请稍后重试'
    state.loading = false
  }
}

onMounted(() => {
  loadLetter()
})

// 复制全文
const copyContent = () => {
  if (!state.letter) return
  const fullText = `收件人: ${state.letter.recipient}\n\n${state.letter.title}\n\n${state.letter.content}\n\n${state.letter.sender}\n${new Date(state.letter.createTime).toLocaleDateString()}`
  copy(fullText)
  ElMessage.success('已复制到剪贴板')
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
</script>

<template>
  <div class="fixed inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-y-auto">
    <div class="min-h-screen py-8 px-4">
      <!-- 加载中 -->
      <div v-if="state.loading" class="flex items-center justify-center min-h-[400px]">
        <el-icon class="is-loading" :size="32">
          <Loading />
        </el-icon>
        <span class="ml-2 text-gray-600">加载中...</span>
      </div>

      <!-- 错误 -->
      <div v-else-if="state.error" class="flex flex-col items-center justify-center min-h-[400px]">
        <div class="text-6xl mb-4">📭</div>
        <div class="text-xl text-gray-600 mb-2">{{ state.error }}</div>
        <el-button type="primary" @click="$router.push('/letter-writer/')">返回写信工具</el-button>
      </div>

      <!-- 信件内容 -->
      <div v-else-if="state.letter" class="max-w-3xl mx-auto">
        <div :class="['letter-container', getStyleClass(state.letter.style)]">
          <!-- 信头 -->
          <div class="letter-header">
            <div class="letter-recipient">致: {{ state.letter.recipient }}</div>
          </div>

          <!-- 标题 -->
          <div class="letter-title">{{ state.letter.title }}</div>

          <!-- 正文 -->
          <div class="letter-content">{{ state.letter.content }}</div>

          <!-- 落款 -->
          <div class="letter-footer">
            <div class="letter-sender">{{ state.letter.sender }}</div>
            <div class="letter-date">{{ new Date(state.letter.createTime).toLocaleDateString() }}</div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-center gap-3 mt-6">
          <el-button type="primary" @click="copyContent">📋 复制全文</el-button>
          <el-button @click="$router.push('/letter-writer/')">✍️ 写一封信</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.letter-container {
  background: white;
  border-radius: 8px;
  padding: 3rem 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  line-height: 1.8;
  font-size: 16px;
}

@media (min-width: 768px) {
  .letter-container {
    padding: 4rem 3rem;
  }
}

.letter-header {
  margin-bottom: 2rem;
}

.letter-recipient {
  font-size: 1.1rem;
  color: #4b5563;
  font-weight: 500;
}

.letter-title {
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 2rem;
  color: #1f2937;
}

.letter-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 3rem;
  color: #374151;
  text-indent: 2em;
}

.letter-footer {
  text-align: right;
  color: #6b7280;
}

.letter-sender {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.letter-date {
  font-size: 0.9rem;
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
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
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

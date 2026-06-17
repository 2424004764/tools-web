<template>
  <div class="space-y-4">
    <!-- 应用标题 -->
    <div class="flex items-center gap-3 mb-4">
      <div class="text-3xl">{{ app.icon }}</div>
      <div>
        <h2 class="text-xl font-bold text-gray-800">{{ app.title }}</h2>
        <p class="text-sm text-gray-600">{{ app.description }}</p>
      </div>
    </div>

    <!-- 对话历史 -->
    <div
      v-if="chatMessages.length > 0"
      class="space-y-3 max-h-96 overflow-y-auto bg-gray-50 rounded-lg p-4"
    >
      <div
        v-for="(msg, index) in chatMessages"
        :key="index"
        :class="[
          'p-3 rounded-lg',
          msg.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-white mr-8'
        ]"
      >
        <div class="text-xs text-gray-500 mb-1">
          {{ msg.role === 'user' ? '我' : app.title }}
        </div>
        <div class="text-sm text-gray-800 whitespace-pre-wrap markdown-body" v-html="renderMarkdown(msg.content)"></div>
      </div>

      <!-- 流式输出中 -->
      <div v-if="streamingContent" class="p-3 rounded-lg bg-white mr-8">
        <div class="text-xs text-gray-500 mb-1">{{ app.title }}</div>
        <div class="text-sm text-gray-800 whitespace-pre-wrap markdown-body" v-html="renderMarkdown(streamingContent)"></div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="space-y-3">
      <textarea
        v-model="userInput"
        :placeholder="`输入你的问题，${app.title}会帮你解答...`"
        rows="4"
        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        :disabled="isQuerying"
        @keydown.ctrl.enter="handleSubmit"
      ></textarea>

      <div class="flex gap-3">
        <button
          @click="handleSubmit"
          :disabled="!userInput.trim() || isQuerying"
          class="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {{ isQuerying ? '思考中...' : '发送 (Ctrl+Enter)' }}
        </button>
        <button
          v-if="chatMessages.length > 0"
          @click="clearHistory"
          class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          清空历史
        </button>
      </div>
    </div>

    <div class="text-xs text-gray-500 text-center">
      提示：按 Ctrl+Enter 快速发送
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as agnesApi from './api'
import MarkdownIt from 'markdown-it'

interface Props {
  app: {
    id: string
    icon: string
    title: string
    description: string
    system_prompt: string
  }
  apiKey: string
}

const props = defineProps<Props>()

const userInput = ref('')
const chatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])
const streamingContent = ref('')
const isQuerying = ref(false)

const md = new MarkdownIt()

const renderMarkdown = (content: string) => {
  return md.render(content)
}

const handleSubmit = async () => {
  if (!props.apiKey.trim()) {
    ElMessage.warning('请先配置API Key')
    return
  }

  if (!userInput.value.trim()) {
    ElMessage.warning('请输入内容')
    return
  }

  // 保存用户消息
  chatMessages.value.push({
    role: 'user',
    content: userInput.value
  })

  const currentInput = userInput.value
  userInput.value = ''

  isQuerying.value = true
  streamingContent.value = ''

  try {
    let result: string
    const isFollowUp = chatMessages.value.length > 1

    if (isFollowUp) {
      // 追问：使用对话历史
      const messages = chatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: props.apiKey.trim(),
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          streamingContent.value = content
        }
      )
    } else {
      // 首次查询：系统提示词作为system消息，用户输入作为user消息
      const messages = [
        {
          role: 'system' as const,
          content: props.app.system_prompt
        },
        {
          role: 'user' as const,
          content: currentInput
        }
      ]

      result = await agnesApi.chatStream(
        {
          apiKey: props.apiKey.trim(),
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          streamingContent.value = content
        }
      )
    }

    // 保存AI回复
    chatMessages.value.push({
      role: 'assistant',
      content: result
    })

    ElMessage.success('回答完成')
  } catch (error: any) {
    // 移除失败的用户消息
    chatMessages.value.pop()
    ElMessage.error('查询失败: ' + (error.message || '未知错误'))
  } finally {
    isQuerying.value = false
    streamingContent.value = ''
  }
}

const clearHistory = () => {
  chatMessages.value = []
  streamingContent.value = ''
  userInput.value = ''
  ElMessage.success('历史已清空')
}
</script>

<style scoped>
.markdown-body {
  line-height: 1.6;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.markdown-body p {
  margin-bottom: 0.5em;
}

.markdown-body ul,
.markdown-body ol {
  margin-left: 1.5em;
  margin-bottom: 0.5em;
}

.markdown-body code {
  background-color: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}
</style>

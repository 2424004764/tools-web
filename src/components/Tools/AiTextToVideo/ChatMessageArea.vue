<template>
  <div class="w-full md:w-2/3 flex flex-col border rounded-lg min-h-[400px] md:min-h-0">
    <div v-if="!currentSession" class="flex-1 flex items-center justify-center text-gray-400">
      <div class="text-center">
        <div class="text-4xl mb-4">💬</div>
        <div>选择或新建一个对话开始聊天</div>
      </div>
    </div>

    <template v-else>
      <!-- 对话区域 -->
      <div ref="chatContainerRef" class="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div v-if="currentSession.messages.length === 0" class="text-center text-gray-400 py-8">
          开始您的对话...
        </div>

        <div v-for="(msg, index) in currentSession.messages" :key="index" class="mb-4">
          <!-- 用户消息 -->
          <div v-if="msg.role === 'user'" class="flex justify-end">
            <div class="max-w-[80%] bg-blue-500 text-white rounded-lg px-4 py-2">
              <div class="text-sm whitespace-pre-wrap">{{ msg.content }}</div>
            </div>
          </div>

          <!-- AI回复 -->
          <div v-else class="flex justify-start">
            <div class="max-w-[80%] bg-white rounded-lg px-4 py-2 shadow">
              <div class="text-sm text-gray-800 markdown-body" v-html="renderMarkdown(msg.content)"></div>
              <button
                @click="$emit('copy-message', msg.content)"
                class="mt-2 text-xs text-gray-500 hover:text-blue-500"
              >
                📋 复制
              </button>
            </div>
          </div>
        </div>

        <!-- 发送中提示 -->
        <div v-if="isChatting" class="flex justify-start">
          <div class="bg-white rounded-lg px-4 py-2 shadow">
            <div class="text-sm text-gray-500">正在思考...</div>
          </div>
        </div>
      </div>

      <!-- 底部输入框 -->
      <div class="p-3 border-t bg-white flex gap-2">
        <textarea
          :value="inputValue"
          @input="$emit('update:inputValue', ($event.target as HTMLTextAreaElement).value)"
          placeholder="输入您的问题... (Enter 发送, Ctrl+Enter 换行)"
          rows="3"
          class="flex-1 px-3 py-2 border rounded-lg text-sm resize-none"
          @keydown.enter.exact.prevent="$emit('send')"
          @keydown.ctrl.enter="$emit('update:inputValue', inputValue + '\n')"
          @keydown.meta.enter="$emit('update:inputValue', inputValue + '\n')"
        />
        <button
          @click="$emit('send')"
          :disabled="isChatting || !inputValue.trim()"
          class="px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
        >
          {{ isChatting ? '发送中' : '发送' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
})

interface ChatSession {
  id: string
  title: string
  messages: Array<{role: 'user' | 'assistant', content: string}>
}

interface Props {
  currentSession: ChatSession | undefined
  inputValue: string
  isChatting: boolean
}

defineProps<Props>()

const chatContainerRef = ref<HTMLDivElement | null>(null)

defineEmits<{
  'update:inputValue': [value: string]
  'send': []
  'copy-message': [content: string]
}>()

const renderMarkdown = (content: string) => {
  return md.render(content)
}

defineExpose({
  chatContainerRef
})
</script>

<style scoped>
.markdown-body {
  line-height: 1.6;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.markdown-body h1 {
  font-size: 1.5em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.3em;
}

.markdown-body h2 {
  font-size: 1.3em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.3em;
}

.markdown-body h3 {
  font-size: 1.1em;
}

.markdown-body p {
  margin-bottom: 0.5em;
}

.markdown-body ul,
.markdown-body ol {
  margin-left: 1.5em;
  margin-bottom: 0.5em;
}

.markdown-body li {
  margin-bottom: 0.25em;
}

.markdown-body code {
  background-color: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.markdown-body pre {
  background-color: #1f2937;
  color: #f3f4f6;
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 0.5em;
}

.markdown-body pre code {
  background-color: transparent;
  padding: 0;
  color: inherit;
}

.markdown-body blockquote {
  border-left: 4px solid #e5e7eb;
  padding-left: 1em;
  margin-left: 0;
  color: #6b7280;
  margin-bottom: 0.5em;
}

.markdown-body table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 0.5em;
}

.markdown-body table th,
.markdown-body table td {
  border: 1px solid #e5e7eb;
  padding: 0.5em;
}

.markdown-body table th {
  background-color: #f3f4f6;
  font-weight: 600;
}

.markdown-body a {
  color: #3b82f6;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1em 0;
}
</style>

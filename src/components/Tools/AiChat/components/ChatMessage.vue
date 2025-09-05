<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { copy } from '@/utils/string'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
  failed?: boolean
}

const props = defineProps<{
  message: Message
}>()

const emit = defineEmits<{
  retry: [messageId: string]
}>()

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleRetry = () => {
  emit('retry', props.message.id)
}

// 复制消息内容
const handleCopy = () => {
  copy(props.message.content)
}

// 创建Markdown渲染器
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
})

// 渲染Markdown内容
const renderedContent = computed(() => {
  if (props.message.type === 'assistant') {
    // 确保content是字符串类型
    const content = typeof props.message.content === 'string' 
      ? props.message.content 
      : String(props.message.content || '');
    return md.render(content);
  }
  return props.message.content;
});
</script>

<template>
  <div class="flex group" :class="message.type === 'user' ? 'justify-end' : 'justify-start'">
    <div 
      class="max-w-[80%] rounded-lg px-4 py-2 relative"
      :class="message.type === 'user' 
        ? 'bg-blue-500 text-white' 
        : 'bg-white text-gray-800 border shadow-sm'"
    >
      <!-- 用户消息：纯文本显示 -->
      <div v-if="message.type === 'user'" class="text-sm">{{ message.content }}</div>
      
      <!-- AI消息：Markdown渲染 -->
      <div 
        v-else 
        class="text-sm markdown-content"
        v-html="renderedContent"
      ></div>
      
      <!-- 操作按钮组 -->
      <div class="flex items-center justify-between mt-2">
        <!-- 时间戳 -->
        <div 
          class="text-xs opacity-70"
          :class="message.type === 'user' ? 'text-blue-100' : 'text-gray-500'"
        >
          {{ formatTime(message.timestamp) }}
        </div>
        
        <!-- 操作按钮 -->
        <div class="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <!-- 复制按钮 -->
          <button
            @click="handleCopy"
            class="p-1 rounded hover:bg-gray-100 transition-colors"
            :class="message.type === 'user' ? 'hover:bg-blue-400' : ''"
            title="复制消息"
          >
            <svg class="w-4 h-4" :class="message.type === 'user' ? 'text-blue-100' : 'text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </button>
          
          <!-- 重试按钮 - 只在AI消息时显示 -->
          <button
            v-if="message.type === 'assistant'"
            @click="handleRetry"
            class="p-1 rounded hover:bg-gray-100 transition-colors"
            title="重新生成"
          >
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- 失败状态的重试按钮（保留原有的显眼重试按钮） -->
      <div v-if="message.type === 'assistant' && message.failed" class="mt-2">
        <button
          @click="handleRetry"
          class="px-3 py-1 text-xs bg-red-100 text-red-600 hover:bg-red-200 rounded border border-red-200 transition-colors"
        >
          🔄 重试
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Markdown内容样式 */
.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin: 0.5em 0 0.3em 0;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-content :deep(h1) { font-size: 1.4em; }
.markdown-content :deep(h2) { font-size: 1.3em; }
.markdown-content :deep(h3) { font-size: 1.2em; }
.markdown-content :deep(h4) { font-size: 1.1em; }
.markdown-content :deep(h5) { font-size: 1em; }
.markdown-content :deep(h6) { font-size: 0.9em; }

.markdown-content :deep(p) {
  margin: 0.5em 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-content :deep(li) {
  margin: 0.2em 0;
}

.markdown-content :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.5em 1em;
  border-left: 4px solid #e5e7eb;
  background-color: #f9fafb;
  color: #6b7280;
}

.markdown-content :deep(code) {
  background-color: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 0.25em;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  margin: 0.5em 0;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: inherit;
}

.markdown-content :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}

.markdown-content :deep(a:hover) {
  color: #2563eb;
}

.markdown-content :deep(strong) {
  font-weight: 600;
}

.markdown-content :deep(em) {
  font-style: italic;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.5em;
  text-align: left;
}

.markdown-content :deep(th) {
  background-color: #f9fafb;
  font-weight: 600;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1em 0;
}
</style>
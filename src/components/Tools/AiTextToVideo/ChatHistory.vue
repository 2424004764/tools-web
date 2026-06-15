<template>
  <div class="space-y-4">
    <!-- 对话历史 -->
    <div v-for="(message, index) in messages" :key="index" class="bg-white rounded-lg p-4">
      <!-- 用户消息 -->
      <div v-if="message.role === 'user'" class="mb-3">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
            我
          </div>
          <div class="flex-1">
            <div class="text-sm text-gray-800 whitespace-pre-wrap">{{ message.content }}</div>
            <!-- 用户上传的图片 -->
            <img v-if="message.image" :src="message.image" class="mt-2 max-w-xs rounded-lg border" />
          </div>
        </div>
      </div>

      <!-- AI消息 -->
      <div v-if="message.role === 'assistant'" class="mt-3 pt-3 border-t border-gray-100">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">
            AI
          </div>
          <div class="flex-1 prose prose-sm max-w-none text-gray-700">
            <div v-html="renderMarkdown(message.content)" class="inline"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 当前流式输出 -->
    <div v-if="streamingContent" class="bg-white rounded-lg p-4">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">
          AI
        </div>
        <div class="flex-1 prose prose-sm max-w-none text-gray-700">
          <div v-html="renderMarkdown(streamingContent)" class="inline"></div>
          <!-- 打字机光标 -->
          <span
            class="inline-block w-0.5 h-4 bg-purple-500 ml-0.5 align-middle"
            style="animation: blink 1s step-end infinite;"
          ></span>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div v-if="messages.length > 0" class="flex gap-2 justify-end">
      <button
        @click="$emit('clear-history')"
        class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        🗑️ 清空对话
      </button>
      <button
        @click="$emit('new-topic')"
        class="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
      >
        ✨ 新话题
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true
})

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  image?: string
}

interface Props {
  messages: ChatMessage[]
  streamingContent?: string
}

defineProps<Props>()

defineEmits<{
  'clear-history': []
  'new-topic': []
}>()

const renderMarkdown = (content: string) => {
  return md.render(content)
}
</script>

<style scoped>
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>

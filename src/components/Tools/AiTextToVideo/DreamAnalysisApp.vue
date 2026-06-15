<template>
  <div class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">🌙</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">AI解梦</h2>
        <p class="text-sm text-gray-600">弗洛伊德精神分析 + 周公解梦双重解析</p>
      </div>
    </div>

    <!-- 对话历史 -->
    <ChatHistory
      v-if="chatMessages.length > 0"
      :messages="chatMessages"
      :streamingContent="streamingContent"
      @clear-history="$emit('clear-history')"
      @new-topic="$emit('new-topic')"
      class="mb-4"
    />

    <!-- 输入区 -->
    <div class="bg-white rounded-lg p-4 mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ chatMessages.length > 0 ? '💬 继续追问' : '描述你的梦境' }}
      </label>
      <textarea
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown.ctrl.enter="handleAnalyze"
        @keydown.meta.enter="handleAnalyze"
        :disabled="isAnalyzing"
        :placeholder="chatMessages.length > 0 ? '继续提问，例如：这个梦和我最近的压力有关吗？' : '请详细描述你的梦境内容，包括场景、人物、情绪等细节...'"
        class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
      />

      <button
        @click="handleAnalyze"
        :disabled="!modelValue.trim() || isAnalyzing"
        class="mt-3 w-full md:w-auto px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {{ isAnalyzing ? '解析中...' : (chatMessages.length > 0 ? '💬 追问' : '🔮 开始解梦') }}
      </button>
    </div>

    <!-- 示例（仅在首次显示） -->
    <div v-if="chatMessages.length === 0 && !isAnalyzing" class="bg-white rounded-lg p-4 mb-4">
      <p class="text-sm font-medium text-gray-700 mb-2">💡 示例梦境：</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="example in examples"
          :key="example"
          @click="$emit('update:modelValue', example)"
          class="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
        >
          {{ example }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatHistory, { type ChatMessage } from './ChatHistory.vue'

interface Props {
  modelValue: string
  isAnalyzing: boolean
  chatMessages: ChatMessage[]
  streamingContent: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'analyze': []
  'clear-history': []
  'new-topic': []
}>()

const examples = [
  '梦见自己在飞翔',
  '梦见掉牙齿',
  '梦见被追赶',
  '梦见考试迟到',
  '梦见从高处坠落'
]

const handleAnalyze = () => {
  if (!props.modelValue.trim() || props.isAnalyzing) {
    return
  }
  emit('analyze')
}
</script>

<style scoped>
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>

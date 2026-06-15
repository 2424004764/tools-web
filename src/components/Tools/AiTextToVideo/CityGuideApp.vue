<template>
  <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">🏛️</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">城市指南</h2>
        <p class="text-sm text-gray-600">探索城市历史文化，发现必去景点</p>
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
        {{ chatMessages.length > 0 ? '💬 继续追问' : '输入城市名称' }}
      </label>
      <div class="flex gap-2">
        <input
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keyup.enter="handleGenerate"
          :disabled="isGenerating"
          :placeholder="chatMessages.length > 0 ? '继续提问，例如：有哪些美食？最佳旅游季节？' : '例如：北京、上海、巴黎、东京...'"
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <button
          @click="handleGenerate"
          :disabled="!modelValue.trim() || isGenerating"
          class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {{ isGenerating ? '生成中...' : (chatMessages.length > 0 ? '💬 追问' : '🔍 探索') }}
        </button>
      </div>
    </div>

    <!-- 热门城市（仅在首次显示） -->
    <div v-if="chatMessages.length === 0 && !isGenerating" class="bg-white rounded-lg p-4 mb-4">
      <p class="text-sm font-medium text-gray-700 mb-2">🔥 热门城市：</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="city in popularCities"
          :key="city"
          @click="$emit('update:modelValue', city)"
          class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
        >
          {{ city }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatHistory, { type ChatMessage } from './ChatHistory.vue'

interface Props {
  modelValue: string
  isGenerating: boolean
  chatMessages: ChatMessage[]
  streamingContent: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'generate': []
  'clear-history': []
  'new-topic': []
}>()

const popularCities = [
  '北京', '上海', '西安', '成都', '杭州',
  '巴黎', '伦敦', '东京', '纽约', '罗马'
]

const handleGenerate = () => {
  if (!props.modelValue.trim() || props.isGenerating) {
    return
  }
  emit('generate')
}
</script>

<style scoped>
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>

<template>
  <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">⚠️</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">添加剂危害查询</h2>
        <p class="text-sm text-gray-600">查询食品添加剂的危害、成分和使用信息</p>
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
        {{ chatMessages.length > 0 ? '💬 继续追问' : '输入添加剂名称' }}
      </label>
      <div class="flex gap-2">
        <input
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keyup.enter="handleQuery"
          :disabled="isQuerying"
          :placeholder="chatMessages.length > 0 ? '继续提问，例如：每天摄入多少安全？有替代品吗？' : '例如：苯甲酸钠、山梨酸钾、亚硝酸钠...'"
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
        <button
          @click="handleQuery"
          :disabled="!modelValue.trim() || isQuerying"
          class="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {{ isQuerying ? '查询中...' : (chatMessages.length > 0 ? '💬 追问' : '🔍 查询') }}
        </button>
      </div>
    </div>

    <!-- 常见添加剂快捷查询（仅在首次显示） -->
    <div v-if="chatMessages.length === 0 && !isQuerying" class="bg-white rounded-lg p-4 mb-4">
      <p class="text-sm font-medium text-gray-700 mb-2">🔥 常见添加剂：</p>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
        <button
          v-for="additive in commonAdditives"
          :key="additive"
          @click="$emit('update:modelValue', additive)"
          class="px-3 py-2 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-left"
        >
          {{ additive }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatHistory, { type ChatMessage } from './ChatHistory.vue'

interface Props {
  modelValue: string
  isQuerying: boolean
  chatMessages: ChatMessage[]
  streamingContent: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'query': []
  'clear-history': []
  'new-topic': []
}>()

const commonAdditives = [
  '苯甲酸钠',
  '山梨酸钾',
  '亚硝酸钠',
  '柠檬酸',
  '谷氨酸钠(味精)',
  '阿斯巴甜'
]

const handleQuery = () => {
  if (!props.modelValue.trim() || props.isQuerying) {
    return
  }
  emit('query')
}
</script>

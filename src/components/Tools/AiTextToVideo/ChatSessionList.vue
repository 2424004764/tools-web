<template>
  <div class="w-full md:w-1/3 flex flex-col border rounded-lg bg-gray-50 h-[300px] md:h-auto">
    <!-- 顶部工具栏 -->
    <div class="p-3 border-b bg-white">
      <button
        @click="$emit('create-session')"
        :disabled="isCurrentSessionEmpty"
        class="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
      >
        ➕ 新建对话
      </button>
    </div>

    <!-- 会话列表 -->
    <div class="flex-1 overflow-y-auto p-2">
      <div
        v-for="session in sessions"
        :key="session.id"
        @click="$emit('select-session', session.id)"
        :class="[
          'p-3 mb-2 rounded-lg cursor-pointer transition-colors group relative',
          currentSessionId === session.id
            ? 'bg-blue-100 border border-blue-300'
            : 'bg-white hover:bg-gray-100'
        ]"
      >
        <div class="text-sm font-medium truncate pr-6">{{ session.title }}</div>
        <div class="text-xs text-gray-500 mt-1">{{ session.messages.length }} 条消息</div>
        <button
          @click.stop="$emit('delete-session', session.id)"
          class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
        >
          🗑️
        </button>
      </div>

      <div v-if="sessions.length === 0" class="text-center text-gray-400 py-8 text-sm">
        暂无对话<br>点击上方新建
      </div>
    </div>

    <!-- 底部模型选择 -->
    <div class="p-3 border-t bg-white">
      <label class="text-xs text-gray-600 mb-1 block">模型</label>
      <select
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
        class="w-full px-2 py-1.5 border rounded text-sm"
        :disabled="isChatting"
      >
        <option value="agnes-2.0-flash">Flash (快)</option>
        <option value="agnes-2.0">Standard</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ChatSession {
  id: string
  title: string
  messages: Array<{role: 'user' | 'assistant', content: string}>
}

interface Props {
  sessions: ChatSession[]
  currentSessionId: string | null
  modelValue: string
  isChatting: boolean
}

const props = defineProps<Props>()

// 判断当前会话是否为空（没有消息）
const isCurrentSessionEmpty = computed(() => {
  if (!props.currentSessionId) return false // 没有选中会话，允许新建
  const currentSession = props.sessions.find(s => s.id === props.currentSessionId)
  return currentSession ? currentSession.messages.length === 0 : false
})

defineEmits<{
  'create-session': []
  'select-session': [sessionId: string]
  'delete-session': [sessionId: string]
  'update:modelValue': [value: string]
}>()
</script>

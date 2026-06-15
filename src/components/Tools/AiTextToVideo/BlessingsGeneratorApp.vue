<template>
  <div class="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">💝</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">祝福语生成器</h2>
        <p class="text-sm text-gray-600">为不同场合和对象，生成温馨真挚的祝福</p>
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

    <!-- 配置区 -->
    <div class="bg-white rounded-lg p-4 mb-4 space-y-4">
      <!-- 场合选择（仅首次显示） -->
      <div v-if="chatMessages.length === 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">选择场合</label>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            v-for="occasion in occasions"
            :key="occasion.value"
            @click="$emit('update:selectedOccasion', occasion.value)"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-all',
              selectedOccasion === occasion.value
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            {{ occasion.emoji }} {{ occasion.label }}
          </button>
        </div>
      </div>

      <!-- 对象选择（仅首次显示） -->
      <div v-if="chatMessages.length === 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">祝福对象</label>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
          <button
            v-for="target in targets"
            :key="target.value"
            @click="$emit('update:selectedTarget', target.value)"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-all',
              selectedTarget === target.value
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            {{ target.label }}
          </button>
        </div>
      </div>

      <!-- 风格选择（仅首次显示） -->
      <div v-if="chatMessages.length === 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">祝福风格</label>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            v-for="style in styles"
            :key="style.value"
            @click="$emit('update:selectedStyle', style.value)"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-all',
              selectedStyle === style.value
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            {{ style.label }}
          </button>
        </div>
      </div>

      <!-- 追问输入（仅在有对话历史时显示） -->
      <div v-if="chatMessages.length > 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">💬 继续追问</label>
        <input
          :value="followUpQuestion"
          @input="$emit('update:followUpQuestion', ($event.target as HTMLInputElement).value)"
          @keyup.enter="handleGenerate"
          :disabled="isGenerating"
          placeholder="继续提问，例如：能换个更活泼的风格吗？加上祝身体健康？"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      <!-- 生成按钮 -->
      <button
        @click="handleGenerate"
        :disabled="isGenerating || (chatMessages.length > 0 && !followUpQuestion.trim())"
        class="w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg hover:from-red-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all font-medium"
      >
        {{ isGenerating ? '生成中...' : (chatMessages.length > 0 ? '💬 追问' : '✨ 生成祝福语') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatHistory, { type ChatMessage } from './ChatHistory.vue'

interface Props {
  selectedOccasion: string
  selectedTarget: string
  selectedStyle: string
  followUpQuestion: string
  isGenerating: boolean
  chatMessages: ChatMessage[]
  streamingContent: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:selectedOccasion': [value: string]
  'update:selectedTarget': [value: string]
  'update:selectedStyle': [value: string]
  'update:followUpQuestion': [value: string]
  'generate': []
  'clear-history': []
  'new-topic': []
}>()

const occasions = [
  { value: 'birthday', label: '生日', emoji: '🎂' },
  { value: 'wedding', label: '婚礼', emoji: '💒' },
  { value: 'newjob', label: '新工作', emoji: '💼' },
  { value: 'newhome', label: '乔迁', emoji: '🏠' },
  { value: 'newyear', label: '新年', emoji: '🎊' },
  { value: 'festival', label: '节日', emoji: '🎉' },
  { value: 'graduation', label: '毕业', emoji: '🎓' },
  { value: 'promotion', label: '升职', emoji: '📈' }
]

const targets = [
  { value: 'elder', label: '长辈' },
  { value: 'friend', label: '朋友' },
  { value: 'lover', label: '恋人' },
  { value: 'colleague', label: '同事' },
  { value: 'leader', label: '领导' }
]

const styles = [
  { value: 'warm', label: '温馨' },
  { value: 'formal', label: '正式' },
  { value: 'humorous', label: '幽默' },
  { value: 'poetic', label: '诗意' }
]

const handleGenerate = () => {
  if (props.isGenerating) {
    return
  }
  // 首次生成或追问都触发generate事件
  if (props.chatMessages.length > 0 && !props.followUpQuestion.trim()) {
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
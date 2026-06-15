<template>
  <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">📧</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">智能文案助手</h2>
        <p class="text-sm text-gray-600">为营销、社交媒体生成吸引人的文案</p>
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
      <!-- 文案类型（仅首次显示） -->
      <div v-if="chatMessages.length === 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">文案类型</label>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            v-for="type in copyTypes"
            :key="type.value"
            @click="$emit('update:selectedType', type.value)"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-all',
              selectedType === type.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            {{ type.emoji }} {{ type.label }}
          </button>
        </div>
      </div>

      <!-- 平台选择（仅首次显示） -->
      <div v-if="chatMessages.length === 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">发布平台</label>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
          <button
            v-for="platform in platforms"
            :key="platform.value"
            @click="$emit('update:selectedPlatform', platform.value)"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-all',
              selectedPlatform === platform.value
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            {{ platform.label }}
          </button>
        </div>
      </div>

      <!-- 主题输入 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {{ chatMessages.length > 0 ? '💬 继续追问' : '文案主题' }}
        </label>
        <input
          :value="topic"
          @input="$emit('update:topic', ($event.target as HTMLInputElement).value)"
          @keyup.enter="handleGenerate"
          :disabled="isGenerating"
          :placeholder="chatMessages.length > 0 ? '继续提问，例如：能加上限时优惠信息吗？换个更年轻化的风格？' : '例如：推广新款手机、咖啡店促销活动...'"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- 生成按钮 -->
      <button
        @click="handleGenerate"
        :disabled="!topic.trim() || isGenerating"
        class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all font-medium"
      >
        {{ isGenerating ? '生成中...' : (chatMessages.length > 0 ? '💬 追问' : '✨ 生成文案') }}
      </button>
    </div>

    <!-- 快速示例（仅在首次显示） -->
    <div v-if="chatMessages.length === 0 && !isGenerating" class="bg-white rounded-lg p-4 mb-4">
      <p class="text-sm font-medium text-gray-700 mb-2">💡 示例主题：</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="example in examples"
          :key="example"
          @click="$emit('update:topic', example)"
          class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
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
  selectedType: string
  selectedPlatform: string
  topic: string
  isGenerating: boolean
  chatMessages: ChatMessage[]
  streamingContent: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:selectedType': [value: string]
  'update:selectedPlatform': [value: string]
  'update:topic': [value: string]
  'generate': []
  'clear-history': []
  'new-topic': []
}>()

const copyTypes = [
  { value: 'product', label: '产品推广', emoji: '📱' },
  { value: 'activity', label: '活动宣传', emoji: '🎉' },
  { value: 'daily', label: '日常分享', emoji: '☀️' },
  { value: 'brand', label: '品牌故事', emoji: '🏆' }
]

const platforms = [
  { value: 'wechat', label: '朋友圈' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'weibo', label: '微博' },
  { value: 'general', label: '通用' }
]

const examples = [
  '新款智能手表上市',
  '咖啡店周年庆促销',
  '健身房开业活动',
  '护肤品好物分享',
  '旅行Vlog推荐'
]

const handleGenerate = () => {
  if (!props.topic.trim() || props.isGenerating) {
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

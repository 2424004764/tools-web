<template>
  <div class="bg-gradient-to-br from-yellow-50 to-lime-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">🍽️</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">食物热量识别</h2>
        <p class="text-sm text-gray-600">查询食物热量、营养成分和健康建议</p>
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
    <div class="bg-white rounded-lg p-4 mb-4 space-y-3">
      <!-- 照片上传（仅首次显示） -->
      <div v-if="chatMessages.length === 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">拍照识别食物（可选）</label>
        <div class="flex gap-2">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            @change="handleImageUpload"
            class="hidden"
            ref="fileInput"
          />
          <button
            @click="fileInput?.click()"
            :disabled="isQuerying"
            class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <span>📷</span>
            <span>{{ uploadedImage ? '重新拍照' : '拍照上传' }}</span>
          </button>
        </div>
        <!-- 预览图片 -->
        <div v-if="uploadedImage" class="mt-2 relative inline-block">
          <img :src="uploadedImage" class="max-w-xs rounded-lg border" />
          <button
            @click="clearImage"
            class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
          >
            ✕
          </button>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {{ chatMessages.length > 0 ? '💬 继续追问' : (uploadedImage ? '食物名称（可选）' : '食物名称') }}
        </label>
        <input
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keyup.enter="handleQuery"
          :disabled="isQuerying"
          :placeholder="chatMessages.length > 0 ? '继续提问，例如：适合减肥吃吗？怎么吃更健康？' : (uploadedImage ? '补充说明食物名称（可选）' : '例如：白米饭、红烧肉、苹果...')"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
        />
      </div>

      <div v-if="chatMessages.length === 0 && !uploadedImage">
        <label class="block text-sm font-medium text-gray-700 mb-2">份量</label>
        <div class="flex gap-2">
          <input
            :value="portion"
            @input="$emit('update:portion', ($event.target as HTMLInputElement).value)"
            :disabled="isQuerying"
            placeholder="例如：100克、1碗、1个..."
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
          <button
            @click="handleQuery"
            :disabled="!modelValue.trim() || !portion.trim() || isQuerying"
            class="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {{ isQuerying ? '查询中...' : '🔍 查询' }}
          </button>
        </div>
      </div>

      <button
        v-else-if="chatMessages.length === 0"
        @click="handleQuery"
        :disabled="!uploadedImage || isQuerying"
        class="w-full px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {{ isQuerying ? '查询中...' : '🔍 查询' }}
      </button>

      <button
        v-else
        @click="handleQuery"
        :disabled="!modelValue.trim() || isQuerying"
        class="w-full px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {{ isQuerying ? '查询中...' : '💬 追问' }}
      </button>
    </div>

    <!-- 常见食物快捷查询（仅在首次显示） -->
    <div v-if="chatMessages.length === 0 && !isQuerying && !uploadedImage" class="bg-white rounded-lg p-4 mb-4">
      <p class="text-sm font-medium text-gray-700 mb-2">🍴 常见食物：</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          v-for="food in commonFoods"
          :key="food"
          @click="$emit('update:modelValue', food); $emit('update:portion', '100克')"
          class="px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-left"
        >
          {{ food }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatHistory, { type ChatMessage } from './ChatHistory.vue'

interface Props {
  modelValue: string
  portion: string
  uploadedImage?: string
  isQuerying: boolean
  chatMessages: ChatMessage[]
  streamingContent: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:portion': [value: string]
  'update:uploadedImage': [value: string]
  'query': []
  'clear-history': []
  'new-topic': []
}>()

const fileInput = ref<HTMLInputElement>()

const commonFoods = [
  '白米饭',
  '红烧肉',
  '苹果',
  '鸡胸肉',
  '西兰花',
  '牛奶',
  '鸡蛋',
  '全麦面包'
]

const handleImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const base64 = e.target?.result as string
    emit('update:uploadedImage', base64)
  }
  reader.readAsDataURL(file)
}

const clearImage = () => {
  emit('update:uploadedImage', '')
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const handleQuery = () => {
  if (!props.modelValue.trim() && !props.uploadedImage) {
    return
  }
  if (props.isQuerying) {
    return
  }
  // 首次查询：有图片时不需要份量，没图片时需要份量
  if (props.chatMessages.length === 0 && !props.uploadedImage && !props.portion.trim()) {
    return
  }
  emit('query')
}
</script>

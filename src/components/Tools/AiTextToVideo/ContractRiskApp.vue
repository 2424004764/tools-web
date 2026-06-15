<template>
  <div class="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">🔍</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">合同风险检测</h2>
        <p class="text-sm text-gray-600">识别合同中的风险条款和不平等内容</p>
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
      <div v-if="chatMessages.length === 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">合同类型</label>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button
            v-for="type in contractTypes"
            :key="type.value"
            @click="$emit('update:selectedType', type.value)"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              selectedType === type.value
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
          >
            {{ type.label }}
          </button>
        </div>
      </div>

      <!-- 照片上传 -->
      <div v-if="chatMessages.length === 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">上传合同照片（可选）</label>
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
            :disabled="isAnalyzing"
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
          {{ chatMessages.length > 0 ? '💬 继续追问' : (uploadedImage ? '补充说明（可选）' : '粘贴合同内容') }}
        </label>
        <textarea
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          :disabled="isAnalyzing"
          :placeholder="chatMessages.length > 0 ? '继续提问，例如：这条款能修改吗？有什么替代方案？' : (uploadedImage ? '补充说明合同的特殊情况...' : '请粘贴合同的主要条款内容...')"
          class="w-full h-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
        />
      </div>

      <button
        @click="handleAnalyze"
        :disabled="(!modelValue.trim() && !uploadedImage) || isAnalyzing"
        class="w-full px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {{ isAnalyzing ? '分析中...' : (chatMessages.length > 0 ? '💬 追问' : '🔍 开始分析') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatHistory, { type ChatMessage } from './ChatHistory.vue'

interface Props {
  modelValue: string
  selectedType: string
  uploadedImage?: string
  isAnalyzing: boolean
  chatMessages: ChatMessage[]
  streamingContent: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:selectedType': [value: string]
  'update:uploadedImage': [value: string]
  'analyze': []
  'clear-history': []
  'new-topic': []
}>()

const fileInput = ref<HTMLInputElement>()

const contractTypes = [
  { value: 'rental', label: '租房合同' },
  { value: 'labor', label: '劳动合同' },
  { value: 'sale', label: '买卖合同' },
  { value: 'service', label: '服务合同' },
  { value: 'loan', label: '借款合同' },
  { value: 'partnership', label: '合作协议' }
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

const handleAnalyze = () => {
  if ((!props.modelValue.trim() && !props.uploadedImage) || props.isAnalyzing) {
    return
  }
  emit('analyze')
}
</script>

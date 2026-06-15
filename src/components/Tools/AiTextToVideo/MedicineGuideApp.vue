<template>
  <div class="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="text-4xl">💊</div>
      <div>
        <h2 class="text-2xl font-bold text-gray-800">药品说明书解读</h2>
        <p class="text-sm text-gray-600">拍照上传或输入药品名称，获取通俗易懂的用药指导</p>
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

    <!-- 上传说明书照片 -->
    <div class="bg-white rounded-lg p-4 mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-3">📸 拍照上传说明书（推荐）</label>

      <div v-if="!uploadedImage" class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors cursor-pointer" @click="triggerUpload">
        <div class="text-4xl mb-2">📷</div>
        <p class="text-sm text-gray-600 mb-2">点击拍照或上传药品说明书</p>
        <p class="text-xs text-gray-400">支持 JPG、PNG 格式，拍摄清晰可见的说明书文字</p>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="handleFileChange"
        />
      </div>

      <div v-else class="relative">
        <img :src="uploadedImage" class="w-full max-h-64 object-contain rounded-lg border" />
        <button
          @click="removePhoto"
          class="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="bg-white rounded-lg p-4 mb-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        {{ chatMessages.length > 0 ? '💬 继续追问' : '📝 或直接输入药品名称' }}
      </label>
      <div class="flex gap-2">
        <input
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keyup.enter="handleSend"
          :disabled="isQuerying"
          :placeholder="chatMessages.length > 0 ? '继续提问，例如：孕妇能吃吗？能和感冒药一起吃吗？' : '例如：阿莫西林、布洛芬、999感冒灵...'"
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <button
          @click="handleSend"
          :disabled="(!modelValue.trim() && !uploadedImage) || isQuerying"
          class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {{ isQuerying ? '解读中...' : (chatMessages.length > 0 ? '💬 追问' : '🔍 解读') }}
        </button>
      </div>
    </div>

    <!-- 常见药品快捷查询（仅在首次显示） -->
    <div v-if="chatMessages.length === 0 && !isQuerying" class="bg-white rounded-lg p-4 mb-4">
      <p class="text-sm font-medium text-gray-700 mb-2">💊 常见药品：</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          v-for="medicine in commonMedicines"
          :key="medicine"
          @click="$emit('update:modelValue', medicine)"
          class="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-left"
        >
          {{ medicine }}
        </button>
      </div>
    </div>

    <!-- 安全提示 -->
    <div v-if="chatMessages.length > 0 && !isQuerying" class="bg-red-50 border border-red-200 rounded-lg p-3">
      <div class="flex items-start gap-2 text-sm text-red-800">
        <span class="text-lg flex-shrink-0">⚠️</span>
        <div>
          <p class="font-medium mb-1">重要提示：</p>
          <p>本信息仅供参考，不能替代医生诊断。用药前请咨询医生或药师，严格按照医嘱和说明书用药。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatHistory, { type ChatMessage } from './ChatHistory.vue'

interface Props {
  modelValue: string
  uploadedImage: string
  isQuerying: boolean
  chatMessages: ChatMessage[]
  streamingContent: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:uploadedImage': [value: string]
  'query': []
  'clear-history': []
  'new-topic': []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const commonMedicines = [
  '阿莫西林',
  '布洛芬',
  '999感冒灵',
  '头孢克肟',
  '蒲地蓝消炎片',
  '连花清瘟',
  '奥美拉唑',
  '氯雷他定'
]

const triggerUpload = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      emit('update:uploadedImage', e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
}

const removePhoto = () => {
  emit('update:uploadedImage', '')
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const handleSend = () => {
  if ((!props.modelValue.trim() && !props.uploadedImage) || props.isQuerying) {
    return
  }
  emit('query')
}
</script>

<style scoped>
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>

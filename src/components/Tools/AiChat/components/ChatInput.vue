<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  send: [content: string]
}>()

const inputContent = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

const handleSend = () => {
  if (!inputContent.value.trim() || props.loading) return
  
  emit('send', inputContent.value.trim())
  inputContent.value = ''
  
  // 重置textarea高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const handleInput = () => {
  // 自动调整高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 120) + 'px'
  }
}
</script>

<template>
  <div class="flex space-x-2">
    <div class="flex-1">
      <textarea
        ref="textareaRef"
        v-model="inputContent"
        @keydown="handleKeydown"
        @input="handleInput"
        placeholder="输入您的问题..."
        class="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        :class="loading ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'"
        :disabled="false"
        rows="1"
        style="height: 40px; line-height: 24px; overflow: hidden;"
      ></textarea>
    </div>
    
    <button
      @click="handleSend"
      :disabled="!inputContent.trim() || loading"
      class="px-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      style="height: 40px;"
    >
      <span v-if="!loading">发送</span>
      <span v-else class="flex items-center">
        <div class="loading-spinner-white"></div>
        发送中
      </span>
    </button>
  </div>
</template>

<style scoped>
/* 白色loading动画 */
.loading-spinner-white {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 输入框加载状态样式 */
textarea:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
}

textarea:not(:disabled):focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style>
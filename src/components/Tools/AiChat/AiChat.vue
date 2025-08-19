<script setup lang="ts">
import { reactive, ref, nextTick, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import ChatMessage from './components/ChatMessage.vue'
import ChatInput from './components/ChatInput.vue'
import { aiManager } from '@/spi'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
}

const info = reactive({
  title: "AI对话",
})

const messages = ref<Message[]>([])
const loading = ref(false)
const chatContainer = ref<HTMLElement>()

// 添加防重复提交的状态
const isSubmitting = ref(false)

// 添加消息
const addMessage = (type: 'user' | 'assistant', content: string) => {
  const message: Message = {
    id: Date.now().toString(),
    type,
    content,
    timestamp: Date.now()
  }
  messages.value.push(message)
  
  // 滚动到底部
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// 处理用户输入
const handleUserInput = async (content: string) => {
  if (!content.trim() || loading.value || isSubmitting.value) return  // 多重防重复提交
  
  // 设置提交状态
  isSubmitting.value = true
  
  try {
    // 添加用户消息
    addMessage('user', content)
    
    // 调用AI接口
    loading.value = true
    await callAIAPI()
  } catch (error) {
    console.error('AI接口调用失败:', error)
    addMessage('assistant', '抱歉，我遇到了一些问题，请稍后再试。')
  } finally {
    loading.value = false
    isSubmitting.value = false  // 重置提交状态
  }
}

// 获取AI提供者
const aiProvider = computed(() => {
  const provider = aiManager.getProvider('pollinations')
  if (!provider) {
    console.error('Pollinations AI提供者未找到')
    console.log('已注册的提供者:', aiManager.getAllProviders().map(p => p.name))
  }
  return provider
})

// 调用AI接口
const callAIAPI = async () => {
  if (!aiProvider.value) {
    throw new Error('Pollinations AI提供者未配置，请检查环境变量配置')
  }

  try {
    // 构建完整的对话历史，明确类型映射
    const conversationHistory = messages.value.map(msg => {
      let role: 'user' | 'assistant' | 'system'
      if (msg.type === 'user') {
        role = 'user'
      } else if (msg.type === 'assistant') {
        role = 'assistant'
      } else {
        role = 'assistant' // 默认值
      }
      
      return {
        role,
        content: msg.content
      }
    })
    
    const response = await aiProvider.value.chat!(conversationHistory, {
      model: 'openai',
      temperature: 0.7
    })
    
    addMessage('assistant', response.content)
  } catch (error) {
    console.error('AI接口调用失败:', error)
    addMessage('assistant', '抱歉，我遇到了一些问题，请稍后再试。')
  }
}

// 清空对话
const clearChat = () => {
  messages.value = []
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <!-- 聊天界面 -->
      <div class="flex flex-col h-[600px]">
        <!-- 聊天记录区域 -->
        <div 
          ref="chatContainer"
          class="flex-1 overflow-y-auto p-4 border rounded-lg bg-gray-50 mb-4"
        >
          <!-- 欢迎消息 -->
          <div v-if="messages.length === 0" class="text-center text-gray-500 py-8">
            <div class="text-2xl mb-2">🤖</div>
            <div class="text-lg font-medium mb-2">欢迎使用AI对话助手</div>
            <div class="text-sm">我可以帮助您解决各种问题，请开始对话吧！</div>
          </div>
          
          <!-- 消息列表 -->
          <div v-else class="space-y-4">
            <ChatMessage 
              v-for="message in messages" 
              :key="message.id"
              :message="message"
            />
          </div>
          
          <!-- 加载状态 -->
          <div v-if="loading" class="flex justify-center py-4">
            <div class="flex items-center space-x-2 text-gray-500">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>AI正在思考中...</span>
            </div>
          </div>
        </div>
        
        <!-- 输入区域 -->
        <ChatInput 
          @send="handleUserInput"
          :loading="loading"
        />
        
        <!-- 操作按钮 -->
        <div class="flex justify-end mt-2">
          <button 
            @click="clearChat"
            class="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            清空对话
          </button>
        </div>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        AI对话助手是一个智能聊天机器人，支持多轮对话，能够回答各种问题，提供专业、准确的建议和帮助。
        无论是学习、工作还是生活中的问题，都可以与AI助手进行交流。
      </el-text> 
    </ToolDetail>

    <ToolDetail title="功能特点">
      <ul class="list-disc list-inside space-y-2 text-gray-700">
        <li>智能对话：支持自然语言交互，理解用户意图</li>
        <li>多轮对话：保持对话上下文，提供连贯的回答</li>
        <li>专业回答：涵盖学习、工作、生活等多个领域</li>
        <li>实时响应：快速响应用户问题，提供即时帮助</li>
        <li>友好界面：简洁美观的聊天界面，操作简单</li>
      </ul>
    </ToolDetail>

    <ToolDetail title="使用说明">
      <ol class="list-decimal list-inside space-y-2 text-gray-700">
        <li>在输入框中输入您的问题或需求</li>
        <li>点击发送按钮或按回车键提交问题</li>
        <li>AI助手会分析您的问题并给出回答</li>
        <li>您可以继续提问，进行多轮对话</li>
        <li>使用"清空对话"按钮可以开始新的对话</li>
      </ol>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 自定义旋转动画 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>

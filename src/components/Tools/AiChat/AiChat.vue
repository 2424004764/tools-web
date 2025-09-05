<script setup lang="ts">
import { reactive, ref, nextTick, computed, onMounted, watch } from "vue";
import { useRoute } from 'vue-router';
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";
import ChatMessage from "./components/ChatMessage.vue";
import ChatInput from "./components/ChatInput.vue";
import AiProviderSelector from "@/components/Common/AiProviderSelector.vue";
import { aiManager } from "@/spi";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: number;
  failed?: boolean
}

interface ProviderSelection {
  provider: string;
  model: string;
}

const route = useRoute();

const info = reactive({
  title: "AI对话",
});

const messages = ref<Message[]>([]);
const loading = ref(false);
const chatContainer = ref<HTMLElement>();
const selectedProvider = ref<ProviderSelection>({ provider: '', model: '' });

// 添加防重复提交的状态
const isSubmitting = ref(false);

// 新增：用于跟踪是否已经处理URL参数
const urlParamsProcessed = ref(false);

// 添加消息
const addMessage = (type: "user" | "assistant", content: string) => {
  const message: Message = {
    id: Date.now().toString(),
    type,
    content,
    timestamp: Date.now(),
  };
  messages.value.push(message);

  // 滚动到底部
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
};

// 处理用户输入
const handleUserInput = async (content: string) => {
  if (!content.trim() || loading.value || isSubmitting.value) return; // 多重防重复提交

  // 设置提交状态
  isSubmitting.value = true;

  try {
    // 添加用户消息
    addMessage("user", content);

    // 调用AI接口
    loading.value = true;
    await callAIAPI();
  } catch (error) {
    console.error("AI接口调用失败:", error);
    addMessage("assistant", "抱歉，我遇到了一些问题，请稍后再试。");
  } finally {
    loading.value = false;
    isSubmitting.value = false; // 重置提交状态
  }
};

// 获取AI提供者
const aiProvider = computed(() => {
  const provider = aiManager.getProvider(selectedProvider.value.provider);
  if (!provider) {
    console.error(`${selectedProvider.value.provider} AI提供者未找到`);
    console.log(
      "已注册的提供者:",
      aiManager.getAllProviders().map((p) => p.name)
    );
  }
  return provider;
});

// 调用AI接口
const callAIAPI = async () => {
  if (!aiProvider.value) {
    throw new Error(
      `${selectedProvider.value.provider} AI提供者未配置，请检查环境变量配置`
    );
  }

  // 检查chat方法是否存在
  if (!aiProvider.value.chat) {
    throw new Error(
      `${selectedProvider.value.provider} AI提供者不支持对话功能`
    );
  }

  try {
    // 构建完整的对话历史，明确类型映射
    const conversationHistory = messages.value.map((msg) => {
      let role: "user" | "assistant" | "system";
      if (msg.type === "user") {
        role = "user";
      } else if (msg.type === "assistant") {
        role = "assistant";
      } else {
        role = "system";
      }

      return {
        role: role,
        content: msg.content,
      };
    });

    const response = await aiProvider.value.chat(
      conversationHistory,
      {
        model: selectedProvider.value.model,
        temperature: 0.7,
        maxTokens: 2000,
        stream: false
      }
    );

    // 修复：确保提取的是字符串内容
    const content = typeof response === 'string' ? response : (response?.content || '抱歉，没有收到有效回复');
    addMessage("assistant", content);
  } catch (error) {
    console.error("AI接口调用出错:", error);
    
    // 标记最后一条assistant消息为失败状态
    const lastMessage = messages.value[messages.value.length - 1];
    if (lastMessage && lastMessage.type === 'assistant') {
      lastMessage.failed = true;
    } else {
      // 如果没有assistant消息，创建一个失败消息
      const failedMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: "抱歉，我遇到了一些问题，请点击重试按钮重新获取回答。",
        timestamp: Date.now(),
        failed: true
      };
      messages.value.push(failedMessage);
    }
    
    throw error;
  }
};

// 清空聊天记录
const clearChat = () => {
  messages.value = [];
};

// 监听selectedProvider的变化，当选择完成后处理URL参数
watch(() => selectedProvider.value, (newProvider) => {
  // 当供应商和模型都选择完成，且URL中有prompt参数时，自动发送
  if (newProvider.provider && newProvider.model && !urlParamsProcessed.value) {
    const prompt = route.query.prompt as string;
    if (prompt) {
      console.log('供应商选择完成，开始处理URL参数自动发送');
      // 使用nextTick确保组件完全渲染
      nextTick(() => {
        processUrlParams();
      });
    }
  }
}, { deep: true });

// 处理供应商变更
const handleProviderChange = (selection: ProviderSelection) => {
  selectedProvider.value = selection;
  console.log('供应商已更新:', selection);
  
  // 这个逻辑移到watch中处理，避免重复
};

// 重试功能
const handleRetry = (messageId: string) => {
  // 找到失败的消息
  const messageIndex = messages.value.findIndex(msg => msg.id === messageId)
  if (messageIndex === -1) return
  
  // 删除失败的消息及其之后的所有消息
  messages.value.splice(messageIndex)
  
  // 找到最后一条用户消息
  const lastUserMessage = [...messages.value].reverse().find(msg => msg.type === 'user')
  if (!lastUserMessage) return
  
  // 重新调用AI接口
  try {
    loading.value = true
    callAIAPI()
  } catch (error) {
    console.error("重试失败:", error)
    addMessage("assistant", "抱歉，重试失败，请稍后再试。")
  } finally {
    loading.value = false
  }
}

// 修改processUrlParams函数，添加更多日志
const processUrlParams = async () => {
  if (urlParamsProcessed.value) {
    console.log('URL参数已处理过，跳过');
    return;
  }
  
  const prompt = route.query.prompt as string;
  const autoSend = route.query.autoSend as string;
  
  console.log('开始处理URL参数:', { prompt, autoSend });
  
  if (prompt) {
    const decodedPrompt = decodeURIComponent(prompt);
    console.log('解码后的提示词:', decodedPrompt);
    
    if (autoSend === 'true' || autoSend === undefined) { // 默认为true
      // 自动发送提示词
      if (selectedProvider.value.provider && selectedProvider.value.model) {
        console.log('开始自动发送提示词');
        await nextTick(); // 确保组件完全渲染
        handleUserInput(decodedPrompt);
      } else {
        console.log('供应商或模型未选择，无法自动发送');
      }
    } else {
      console.log('autoSend为false，仅预填充');
      // 仅预填充输入框（如果有ChatInput组件支持的话）
      // 这里可以添加预填充逻辑
    }
    
    urlParamsProcessed.value = true;
  }
};

// 组件挂载时的逻辑简化
onMounted(() => {
  console.log('AI对话页面已加载，供应商选择器会自动初始化');
  
  // 检查URL参数
  if (route.query.prompt) {
    console.log('检测到提示词参数:', route.query.prompt);
    console.log('等待供应商选择完成...');
    // 具体处理逻辑已移到watch中
  }
});
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- AI供应商选择器 -->
    <div class="mt-4">
      <AiProviderSelector 
        v-model="selectedProvider"
        @change="handleProviderChange"
        storage-key="ai-chat-provider-selection"
      />
    </div>

    <!-- 只有在选择了供应商和模型后才显示聊天界面 -->
    <div v-if="selectedProvider.provider && selectedProvider.model" class="p-4 rounded-2xl bg-white">
      <!-- 聊天界面 -->
      <div class="flex flex-col h-[600px]">
        <!-- 聊天记录区域 -->
        <div
          ref="chatContainer"
          class="flex-1 overflow-y-auto p-4 border rounded-lg bg-gray-50 mb-4"
        >
          <!-- 欢迎消息 -->
          <div
            v-if="messages.length === 0"
            class="text-center text-gray-500 py-8"
          >
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
              @retry="handleRetry"
            />
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="flex justify-center py-4">
            <div class="flex items-center space-x-2 text-gray-500">
              <div
                class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"
              ></div>
              <span>AI正在思考中...</span>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <ChatInput @send="handleUserInput" :loading="loading" />

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

    <!-- 如果没有选择供应商和模型，显示提示 -->
    <div v-else class="mt-4 p-6 text-center bg-gray-50 rounded-lg">
      <div class="text-gray-500">
        <div class="text-lg mb-2">🤖</div>
        <div class="text-base font-medium mb-2">正在初始化AI供应商选择...</div>
        <div class="text-sm">请稍候，系统会自动选择默认配置</div>
      </div>
    </div>

    <!-- 描述 -->
    <ToolDetail title="功能说明" class="mt-4">
      <el-text>
        智能AI对话助手，支持多轮对话，提供专业、准确的回答。
        <br>• <strong>多供应商支持</strong>：支持多个AI服务供应商，可自由选择
        <br>• <strong>模型选择</strong>：每个供应商提供多种模型选择，满足不同需求
        <br>• <strong>对话记忆</strong>：支持上下文对话，AI能记住之前的对话内容
        <br>• <strong>重试机制</strong>：遇到问题时可以重试，确保对话的连续性
        <br>• <strong>提示词支持</strong>：支持从其他页面携带提示词自动发起对话
        <br>• <strong>响应式设计</strong>：完美适配PC和移动设备
        <br><br>
        <strong>使用建议：</strong>
        <br>1. 选择合适的AI供应商和模型
        <br>2. 输入您的问题或需求
        <br>3. AI会根据上下文提供针对性回答
        <br>4. 可以继续追问或深入讨论
        <br>5. 使用清空按钮开始新话题
      </el-text>
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

/* Markdown内容样式 */
.markdown-content {
  line-height: 1.6;
}
</style>

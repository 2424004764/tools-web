<script setup lang="ts">
import { ref, nextTick, computed, watch, onMounted } from "vue";
import { useRoute } from 'vue-router';
import ChatMessage from "@/components/Tools/AiChat/components/ChatMessage.vue";
import ChatInput from "@/components/Tools/AiChat/components/ChatInput.vue";
import AiProviderSelector from "@/components/Common/AiProviderSelector.vue";
import { aiManager } from "@/spi";
import type { Message, ProviderSelection } from "@/utils/chat";
import { generateMessageId } from "@/utils/chat";

// 组件props
interface Props {
  title?: string;
  welcomeMessage?: string;
  welcomeIcon?: string;
  initialMessages?: Message[];
  autoProcessUrlParams?: boolean;
  storageKey?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: "AI对话",
  welcomeMessage: "我可以帮助您解决各种问题，请开始对话吧！",
  welcomeIcon: "🤖",
  initialMessages: () => [],
  autoProcessUrlParams: true,
  storageKey: "ai-chat-provider-selection"
});

// 组件emits
const emit = defineEmits<{
  messageAdded: [message: Message];
  messageUpdated: [message: Message];
  providerChanged: [selection: ProviderSelection];
  chatStarted: [];
  chatCleared: [];
}>();

const route = useRoute();

const messages = ref<Message[]>([...props.initialMessages]);
const loading = ref(false);
const chatContainer = ref<HTMLElement>();
const selectedProvider = ref<ProviderSelection>({ provider: '', model: '' });

// 防重复提交的状态
const isSubmitting = ref(false);

// 用于跟踪是否已经处理URL参数
const urlParamsProcessed = ref(false);

// 流式输出相关状态
const isStreaming = ref(false);
const currentStreamingMessageId = ref<string | null>(null);

// 终止流式请求的控制器
const abortController = ref<AbortController | null>(null);

// 添加消息
const addMessage = (type: "user" | "assistant", content: string, streaming = false) => {
  const messageId = generateMessageId();
  const message: Message = {
    id: messageId,
    type,
    content,
    timestamp: Date.now(),
    streaming
  };
  messages.value.push(message);
  emit('messageAdded', message);

  // 滚动到底部
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
  
  return messageId;
};

// 更新消息内容（用于流式输出）
const updateMessage = (messageId: string, content: string, reasoning?: string) => {
  const messageIndex = messages.value.findIndex(msg => msg.id === messageId);
  
  if (messageIndex !== -1) {
    const oldMessage = messages.value[messageIndex];
    
    messages.value[messageIndex] = {
      ...oldMessage,
      content: content,
      ...(reasoning !== undefined && { reasoning: reasoning })
    };
    
    emit('messageUpdated', messages.value[messageIndex]);
    
    // 滚动到底部
    nextTick(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
    });
  }
};

// 完成流式输出
const finishStreaming = (messageId: string) => {
  const messageIndex = messages.value.findIndex(msg => msg.id === messageId);
  if (messageIndex !== -1) {
    messages.value[messageIndex] = {
      ...messages.value[messageIndex],
      streaming: false
    };
    emit('messageUpdated', messages.value[messageIndex]);
  }
  isStreaming.value = false;
  currentStreamingMessageId.value = null;
  abortController.value = null;
};

// 终止流式请求
const abortStreaming = () => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
  
  if (currentStreamingMessageId.value) {
    const messageIndex = messages.value.findIndex(msg => msg.id === currentStreamingMessageId.value);
    if (messageIndex !== -1) {
      const currentContent = messages.value[messageIndex].content;
      const currentReasoning = messages.value[messageIndex].reasoning;
      messages.value[messageIndex] = {
        ...messages.value[messageIndex],
        streaming: false,
        content: currentContent + '\n\n[已终止生成]',
        reasoning: currentReasoning
      };
      emit('messageUpdated', messages.value[messageIndex]);
    }
    finishStreaming(currentStreamingMessageId.value);
  }
};

// 处理用户输入
const handleUserInput = async (content: string) => {
  if (!content.trim() || loading.value || isSubmitting.value || isStreaming.value) return;

  // 设置提交状态
  isSubmitting.value = true;

  try {
    // 调用AI接口
    await callAIAPI();
  } catch (error) {
    console.error("AI接口调用失败:", error);
    if (typeof error === 'object' && error !== null && 'name' in error && !(error as any).name || (error as any).name !== 'AbortError') {
      addMessage("assistant", "抱歉，我遇到了一些问题，请稍后再试。");
    }
  } finally {
    isSubmitting.value = false;
  }
};

// 获取AI提供者
const aiProvider = computed(() => {
  const provider = aiManager.getProvider(selectedProvider.value.provider);
  if (!provider) {
    console.error(`${selectedProvider.value.provider} AI提供者未找到`);
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

  if (!aiProvider.value.chat) {
    throw new Error(
      `${selectedProvider.value.provider} AI提供者不支持对话功能`
    );
  }

  try {
    // 构建完整的对话历史
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

    // 创建流式输出的助手消息
    const assistantMessageId = addMessage("assistant", "", true);
    currentStreamingMessageId.value = assistantMessageId;
    isStreaming.value = true;

    // 创建终止控制器
    abortController.value = new AbortController();

    let accumulatedContent = '';
    let accumulatedReasoning = '';

    const response = await aiProvider.value.chat(
      conversationHistory,
      {
        model: selectedProvider.value.model,
        temperature: 0.7,
        maxTokens: 2000,
        stream: true,
        signal: abortController.value.signal,
        onChunk: (chunk: string, reasoning?: string) => {
          accumulatedContent += chunk;
          if (reasoning) {
            accumulatedReasoning += reasoning;
          }
          updateMessage(assistantMessageId, accumulatedContent, accumulatedReasoning);
        }
      }
    );

    // 完成流式输出
    finishStreaming(assistantMessageId);

    // 如果流式输出没有内容，使用响应内容
    const currentMessage = messages.value.find(msg => msg.id === assistantMessageId);
    if (currentMessage && !currentMessage.content.trim()) {
      const content = typeof response === 'string' ? response : (response?.content || '抱歉，没有收到有效回复');
      updateMessage(assistantMessageId, content);
    }
  } catch (error) {
    console.error("AI接口调用出错:", error);
    
    // 检查是否是用户主动终止
    if (typeof error === 'object' && error !== null && 'name' in error && (error as any).name === 'AbortError') {
      return;
    }
    
    // 处理错误情况
    if (currentStreamingMessageId.value) {
      const messageIndex = messages.value.findIndex(msg => msg.id === currentStreamingMessageId.value);
      if (messageIndex !== -1) {
        messages.value[messageIndex] = {
          ...messages.value[messageIndex],
          failed: true,
          streaming: false,
          content: "抱歉，我遇到了一些问题，请点击重试按钮重新获取回答。"
        };
        emit('messageUpdated', messages.value[messageIndex]);
      }
      finishStreaming(currentStreamingMessageId.value);
    } else {
      const failedMessage: Message = {
        id: generateMessageId(),
        type: 'assistant',
        content: "抱歉，我遇到了一些问题，请点击重试按钮重新获取回答。",
        timestamp: Date.now(),
        failed: true
      };
      messages.value.push(failedMessage);
      emit('messageAdded', failedMessage);
    }
    
    throw error;
  }
};

// 清空聊天记录
const clearChat = () => {
  if (isStreaming.value) {
    abortStreaming();
  }
  
  messages.value = [];
  isStreaming.value = false;
  currentStreamingMessageId.value = null;
  abortController.value = null;
  emit('chatCleared');
};

// 处理供应商变更
const handleProviderChange = (selection: ProviderSelection) => {
  selectedProvider.value = selection;
  emit('providerChanged', selection);
};

// 重试功能
const handleRetry = (messageId: string) => {
  const messageIndex = messages.value.findIndex(msg => msg.id === messageId)
  if (messageIndex === -1) return
  
  messages.value.splice(messageIndex)
  
  const lastUserMessage = [...messages.value].reverse().find(msg => msg.type === 'user')
  if (!lastUserMessage) return
  
  try {
    callAIAPI()
  } catch (error) {
    console.error("重试失败:", error)
    addMessage("assistant", "抱歉，重试失败，请稍后再试。")
  }
}

// 处理URL参数
const processUrlParams = async () => {
  if (urlParamsProcessed.value || !props.autoProcessUrlParams) {
    return;
  }
  
  const prompt = route.query.prompt as string;
  const autoSend = route.query.autoSend as string;
  
  if (prompt) {
    const decodedPrompt = decodeURIComponent(prompt);
    
    if (autoSend === 'true' || autoSend === undefined) {
      if (selectedProvider.value.provider && selectedProvider.value.model) {
        await nextTick();
        handleUserInput(decodedPrompt);
      }
    }
    
    urlParamsProcessed.value = true;
  }
};

// 监听provider变化
watch(() => selectedProvider.value, (newProvider) => {
  if (newProvider.provider && newProvider.model && !urlParamsProcessed.value && props.autoProcessUrlParams) {
    const prompt = route.query.prompt as string;
    if (prompt) {
      nextTick(() => {
        processUrlParams();
      });
    }
  }
}, { deep: true });

// 暴露方法给父组件
defineExpose({
  addMessage,
  clearChat,
  handleUserInput,
  messages: computed(() => messages.value),
  selectedProvider: computed(() => selectedProvider.value),
  isStreaming: computed(() => isStreaming.value)
});

onMounted(() => {
  if (route.query.prompt && props.autoProcessUrlParams) {
    // 等待provider选择完成后处理
  }
});
</script>

<template>
  <div class="ai-chat-container">
    <!-- AI供应商选择器 -->
    <div class="mb-4">
      <AiProviderSelector 
        v-model="selectedProvider"
        @change="handleProviderChange"
        :storage-key="storageKey"
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
            <div class="text-2xl mb-2">{{ welcomeIcon }}</div>
            <div class="text-lg font-medium mb-2">{{ title }}</div>
            <div class="text-sm">{{ welcomeMessage }}</div>
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
        </div>

        <!-- 输入区域 -->
        <ChatInput 
          @send="handleUserInput" 
          @abort="abortStreaming"
          :loading="loading || isSubmitting" 
          :streaming="isStreaming"
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

    <!-- 如果没有选择供应商和模型，显示提示 -->
    <div v-else class="mt-4 p-6 text-center bg-gray-50 rounded-lg">
      <div class="text-gray-500">
        <div class="text-lg mb-2">{{ welcomeIcon }}</div>
        <div class="text-base font-medium mb-2">正在初始化AI供应商选择...</div>
        <div class="text-sm">请稍候，系统会自动选择默认配置</div>
      </div>
    </div>
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
</style>

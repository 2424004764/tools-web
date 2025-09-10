<script setup lang="ts">
import { reactive, ref, onMounted } from "vue";
import { useRoute } from 'vue-router';
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";
import AiChatCore from "@/components/Common/AiChatCore.vue";

const route = useRoute();

const info = reactive({
  title: "AI对话",
});

const chatCoreRef = ref();
const urlParamsProcessed = ref(false);

// 处理URL参数
const processUrlParams = async () => {
  if (urlParamsProcessed.value) {
    return;
  }
  
  const prompt = route.query.prompt as string;
  const autoSend = route.query.autoSend as string;
  
  if (prompt) {
    const decodedPrompt = decodeURIComponent(prompt);
    
    if (autoSend === 'true' || autoSend === undefined) {
      // 等待聊天组件准备好
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (chatCoreRef.value) {
        chatCoreRef.value.autoSendPrompt(decodedPrompt);
      }
    }
    
    urlParamsProcessed.value = true;
  }
};

// 处理对话开始事件
const handleConversationStarted = () => {
  console.log('AI对话已开始');
};

// 组件挂载时检查URL参数
onMounted(() => {
  if (route.query.prompt) {
    // 延迟处理URL参数，确保组件完全加载
    setTimeout(processUrlParams, 1000);
  }
});
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- 使用公共聊天组件 -->
    <AiChatCore
      ref="chatCoreRef"
      :title="info.title"
      storage-key="ai-chat-provider-selection"
      @conversation-started="handleConversationStarted"
    />

    <!-- 功能说明 -->
    <ToolDetail title="功能说明" class="mt-4">
      <el-text>
        智能AI对话助手，支持多轮对话，提供专业、准确的回答。
        <br>• <strong>多供应商支持</strong>：支持多个AI服务供应商，可自由选择
        <br>• <strong>模型选择</strong>：每个供应商提供多种模型选择，满足不同需求
        <br>• <strong>对话记忆</strong>：支持上下文对话，AI能记住之前的对话内容
        <br>• <strong>流式输出</strong>：支持实时流式输出，可随时停止生成
        <br>• <strong>重试机制</strong>：遇到问题时可以重试，确保对话的连续性
        <br>• <strong>提示词支持</strong>：支持从其他页面携带提示词自动发起对话
        <br>• <strong>响应式设计</strong>：完美适配PC和移动设备
        <br><br>
        <strong>使用建议：</strong>
        <br>1. 选择合适的AI供应商和模型
        <br>2. 输入您的问题或需求
        <br>3. AI会根据上下文提供针对性回答
        <br>4. 流式输出过程中发送按钮会变为停止按钮
        <br>5. 可以继续追问或深入讨论
        <br>6. 使用清空按钮开始新话题
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

/* 流式输出动画 */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.streaming-cursor::after {
  content: '▋';
  animation: pulse 1s infinite;
  color: #3b82f6;
}

/* 思考过程样式 */
.reasoning-content {
  line-height: 1.5;
  font-size: 0.875rem;
}

.reasoning-content :deep(p) {
  margin: 0.3em 0;
}

.reasoning-content :deep(code) {
  background-color: #e0f2fe;
  color: #0277bd;
  padding: 0.1em 0.3em;
  border-radius: 0.2em;
  font-size: 0.8em;
}
</style>

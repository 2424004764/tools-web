<script setup lang="ts">
import { reactive, ref, computed, nextTick } from "vue";
import { useRoute } from 'vue-router';
import axios from 'axios';
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";
import { copy } from '@/utils/string';

const route = useRoute();

const pollinationsApiKey = ref(import.meta.env.VITE_POLLINATIONS_API_KEY || '');
const pollinationsProxyUrl = ref(import.meta.env.VITE_POLLINATIONS_PROXY_URL);
const pollinationsTextUrl = ref(import.meta.env.VITE_POLLINATIONS_TEXT_URL);

const info = reactive({
  title: "AI面试",
  desc: "模拟真实面试场景，帮助您提升面试表现"
});

// 面试提示词配置
const interviewPrompts = [
  {
    id: 'general',
    title: '通用行业面试',
    description: '针对通用行业岗位的技术面试',
    icon: '💼',
    inputs: [
      { key: 'position', label: '目标岗位', placeholder: '如：高级产品经理 / 软件工程师（后端） / 市场营销专员', required: true },
      { key: 'company', label: '公司/行业', placeholder: '如：字节跳动 / 阿里巴巴 / 快速消费品行业 / 金融科技', required: true },
      { key: 'experience', label: '经验水平', placeholder: '如：应届生 / 3年工作经验 / 资深专家', required: true },
      { key: 'resume', label: '我的简历/核心技能（越详细越好）', placeholder: '如：拥有5年后端开发经验，精通Java、Spring Boot、MySQL和Redis', required: true }
    ],
    template: `# 角色：AI面试官 (InterviewerAI)

## 1. 你的身份与任务：
你是一位经验丰富、专业且富有洞察力的AI面试官，名为 InterviewerAI。你的任务是根据我提供的目标岗位和个人简历，为我进行一场高度仿真的求职面试。你的目标是：
- 提出与岗位高度相关的问题。
- 评估我的回答，并提出有深度的追问。
- 在面试结束后，给我提供全面、具体且有建设性的反馈。

## 2. 面试流程：
你将严格遵循以下流程：
1.  **问候与确认**：首先，向我问好，并确认即将开始一场关于我目标岗位的模拟面试。
2.  **正式面试**：
    - 从经典的 "请做个自我介绍" 或 "请讲讲你为什么对这个岗位感兴趣" 开始。
    - 融合不同类型的问题，包括但不限于：
        - **行为问题 (Behavioral Questions)**：深入探究我过往的经历，并引导我使用STAR原则（Situation, Task, Action, Result）来回答。例如："请分享一个你处理过的最困难的项目。"
        - **情景问题 (Situational Questions)**：提出假设性场景，考察我的应变能力和解决问题的思路。例如："如果我们产品的用户量下周突然翻倍，你会优先关注哪些技术问题？"
        - **简历深挖 (Resume Deep Dive)**：针对我简历中的某一段具体经历或技能进行提问。
        - **技术/专业问题 (Technical/Domain-specific Questions)**：根据岗位要求，提出相关的专业知识问题。
        - **动机与文化契合度问题 (Motivation & Culture Fit)**：考察我申请该岗位的动机以及与公司文化的匹配度。
    - **追问**：在我回答后，你必须像一个真正的面试官一样，针对我回答中的细节进行1-2次追问，以考察我思维的深度和逻辑的严谨性。
3.  **向我提问环节**：在面试主要部分结束后，你会问我："你有什么想问我的吗？"并以该公司的面试官身份，尽力回答我的问题。
4.  **面试结束与反馈**：在我表示没有更多问题后，你将宣布面试结束，并立即切换回AI助手角色，从以下几个维度给我提供详细的反馈：
    - **总体评价**：对我整体表现的总结。
    - **亮点分析**：指出我回答得好的地方，具体是哪个问题，好在哪里。
    - **改进建议**：指出我回答中存在的问题，例如：逻辑不清晰、缺乏细节、未使用STAR原则、表达不够自信等，并给出具体的改进方法和回答范例。
    - **STAR原则应用评估**：专门评估我的行为问题回答是否符合STAR原则，并指出缺失或薄弱的部分。

## 3. 规则与约束：
- **一次一问**：严格遵守一次只问一个问题的原则。
- **耐心等待**：在我回答完毕前，请不要打断或提出下一个问题。
- **保持角色**：在反馈环节之前，始终保持你作为面试官的专业、中立、友好的角色。

---
## 我的信息：
- **目标岗位**：{position}
- **公司/行业**：{company}
- **经验水平**：{experience}
- **我的简历/核心技能**：
{resume}
---
好了，InterviewerAI，请你现在开始吧。`
  },
];

// 当前选择的提示词和输入值
const selectedPrompt = ref<typeof interviewPrompts[0] | null>(null);
const promptInputs = ref<Record<string, string>>({});
const showChat = ref(false);

// 对话相关状态
const messages = ref<Array<{ type: 'user' | 'assistant', content: string }>>([]);
const inputMessage = ref('');
const isLoading = ref(false);
const chatContainerRef = ref<HTMLElement>();

// 计算生成的系统提示词
const generatedSystemPrompt = computed(() => {
  if (!selectedPrompt.value) return '';

  let template = selectedPrompt.value.template;

  // 替换模板中的变量
  selectedPrompt.value.inputs.forEach(input => {
    const value = promptInputs.value[input.key] || '';
    const regex = new RegExp(`\\{${input.key}\\}`, 'g');
    template = template.replace(regex, value);
  });

  return template;
});

// 选择提示词
const selectPrompt = (prompt: typeof interviewPrompts[0]) => {
  selectedPrompt.value = prompt;
  promptInputs.value = {};
  showChat.value = false;
  messages.value = [];
};

// 验证必填项
const canStartInterview = computed(() => {
  if (!selectedPrompt.value) return false;

  return selectedPrompt.value.inputs.every(input => {
    if (input.required) {
      return promptInputs.value[input.key]?.trim();
    }
    return true;
  });
});

// 开始面试
const startInterview = () => {
  if (!canStartInterview.value) return;

  showChat.value = true;
  messages.value = [];

  // 自动发送开始消息
  nextTick(() => {
    const startMessage = `您好！我已经准备好了，可以开始面试吗？`;
    sendMessage(startMessage);
  });
};

// 重新选择
const selectAgain = () => {
  selectedPrompt.value = null;
  promptInputs.value = {};
  showChat.value = false;
  messages.value = [];
  inputMessage.value = '';
};

// 发送消息
const sendMessage = async (userInput?: string) => {
  const message = userInput || inputMessage.value.trim();
  if (!message || isLoading.value) return;

  // 添加用户消息
  messages.value.push({ type: 'user', content: message });
  inputMessage.value = '';

  // 滚动到底部
  nextTick(() => scrollToBottom());

  isLoading.value = true;

  try {
    // 构建消息历史
    const apiMessages: Array<{ role: string, content: string }> = [
      { role: 'system', content: generatedSystemPrompt.value },
      ...messages.value.map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.content }))
    ];

    // 构建 OpenAI 格式请求
    const requestBody = {
      model: 'nova-fast',
      messages: apiMessages
    };

    const resp = await axios.post(
      pollinationsProxyUrl.value,
      requestBody,
      {
        params: {
          target: `${pollinationsTextUrl.value}/v1/chat/completions`
        },
        headers: {
          'Authorization': `Bearer ${pollinationsApiKey.value}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 解析 OpenAI 格式响应
    const assistantMessage = resp.data?.choices?.[0]?.message?.content || '抱歉，我暂时无法回复。';
    messages.value.push({ type: 'assistant', content: assistantMessage });

  } catch (e) {
    console.error('请求失败:', e);
    messages.value.push({ type: 'assistant', content: '抱歉，请求出现错误，请稍后重试。' });
  } finally {
    isLoading.value = false;
    nextTick(() => scrollToBottom());
  }
};

// 滚动到底部
const scrollToBottom = () => {
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
  }
};

// 复制消息
const copyMessage = (text: string) => copy(text);

// 添加按下效果的方法
const handleButtonPress = (event: Event) => {
  const button = event.target as HTMLElement;
  button.classList.add('button-pressed');
  setTimeout(() => {
    button.classList.remove('button-pressed');
  }, 150);
};

// 组件挂载时检查URL参数
const checkUrlParams = () => {
  const promptId = route.query.prompt as string;
  if (promptId) {
    const prompt = interviewPrompts.find(p => p.id === promptId);
    if (prompt) {
      selectPrompt(prompt);
    }
  }
};

checkUrlParams();
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- 面试配置阶段 -->
    <div v-if="!showChat" class="space-y-6">
      <!-- 选择面试类型 -->
      <div v-if="!selectedPrompt" class="p-4 rounded-2xl bg-white">
        <h3 class="text-lg font-medium mb-4 text-gray-800">选择面试类型</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="prompt in interviewPrompts"
            :key="prompt.id"
            @click="selectPrompt(prompt)"
            class="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 cursor-pointer transition-all duration-200 hover:shadow-md"
          >
            <div class="text-center">
              <div class="text-3xl mb-2">{{ prompt.icon }}</div>
              <h4 class="font-medium text-gray-800 mb-2">{{ prompt.title }}</h4>
              <p class="text-sm text-gray-600">{{ prompt.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 配置面试参数 -->
      <div v-else class="p-4 rounded-2xl bg-white">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center">
            <span class="text-2xl mr-3">{{ selectedPrompt.icon }}</span>
            <h3 class="text-lg font-medium text-gray-800">{{ selectedPrompt.title }}</h3>
          </div>
          <button
            @click="selectAgain"
            class="text-gray-500 hover:text-gray-700 text-sm"
          >
            重新选择
          </button>
        </div>

        <div class="space-y-4">
          <div
            v-for="input in selectedPrompt.inputs"
            :key="input.key"
            class="flex flex-col"
          >
            <label class="text-sm font-medium text-gray-700 mb-2">
              {{ input.label }}
              <span v-if="input.required" class="text-red-500">*</span>
            </label>
            <textarea
              v-if="input.key === 'resume'"
              v-model="promptInputs[input.key]"
              :placeholder="input.placeholder"
              :required="input.required"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px]"
            />
            <input
              v-else
              v-model="promptInputs[input.key]"
              :placeholder="input.placeholder"
              :required="input.required"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div class="pt-4">
            <button
              @click="startInterview"
              :disabled="!canStartInterview"
              class="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              开始面试
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 面试对话阶段 -->
    <div v-else class="p-4 rounded-2xl bg-white">
      <!-- 面试状态栏 -->
      <div class="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <span class="text-lg mr-2">{{ selectedPrompt?.icon }}</span>
            <span class="font-medium text-blue-800">{{ selectedPrompt?.title }}进行中</span>
          </div>
          <button
            @click="selectAgain"
            class="text-blue-600 hover:text-blue-800 text-sm"
          >
            结束面试
          </button>
        </div>
      </div>

      <!-- 聊天消息区域 -->
      <div
        ref="chatContainerRef"
        class="h-[500px] overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50"
      >
        <div class="space-y-4">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="[
              'flex',
              msg.type === 'user' ? 'justify-end' : 'justify-start'
            ]"
          >
            <div
              :class="[
                'max-w-[80%] rounded-lg p-3 relative group',
                msg.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border text-gray-800'
              ]"
            >
              <div class="whitespace-pre-wrap">{{ msg.content }}</div>
              <button
                v-if="msg.type === 'assistant'"
                @click="copyMessage(msg.content)"
                @mousedown="handleButtonPress"
                @touchstart="handleButtonPress"
                class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded"
              >
                复制
              </button>
            </div>
          </div>

          <!-- 加载中提示 -->
          <div v-if="isLoading" class="flex justify-start">
            <div class="bg-white border rounded-lg p-3 text-gray-500">
              <span class="inline-flex items-center">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                面试官正在思考...
              </span>
            </div>
          </div>

          <!-- 欢迎提示 -->
          <div v-if="messages.length === 0 && !isLoading" class="text-center text-gray-400 py-8">
            <p>面试即将开始，请做好准备...</p>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="flex gap-2">
        <textarea
          v-model="inputMessage"
          @keydown.enter.prevent="sendMessage()"
          placeholder="输入你的回答..."
          class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows="2"
          :disabled="isLoading"
        />
        <button
          @click="sendMessage()"
          :disabled="isLoading || !inputMessage.trim()"
          class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
        >
          {{ isLoading ? '发送中...' : '发送' }}
        </button>
      </div>
    </div>

    <!-- 功能说明 -->
    <ToolDetail title="功能说明" class="mt-4">
      <el-text>
        AI智能面试助手，模拟真实面试场景，帮助您提升面试表现。
        <br>• <strong>多种面试类型</strong>：涵盖通用行业岗位
        <br>• <strong>个性化配置</strong>：根据目标岗位、经验年限等定制面试内容
        <br>• <strong>智能对话</strong>：AI面试官根据回答动态调整问题难度和方向
        <br>• <strong>专业指导</strong>：模拟真实面试流程，提供针对性的技术和能力考察
        <br>• <strong>即时反馈</strong>：在对话中获得建议和指导，提升面试技巧
        <br><br>
        <strong>使用建议：</strong>
        <br>1. 选择与目标岗位匹配的面试类型
        <br>2. 如实填写个人信息，获得更精准的面试体验
        <br>3. 认真对待每个问题，模拟真实面试状态
        <br>4. 主动询问面试技巧和改进建议
        <br>5. 可以多次练习，熟悉不同类型的面试风格
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.button-pressed {
  transform: scale(0.95) !important;
  filter: brightness(0.9) !important;
}

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

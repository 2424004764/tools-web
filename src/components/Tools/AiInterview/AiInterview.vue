<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import { useRoute } from 'vue-router';
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";
import AiChatCore from "@/components/Common/AiChatCore.vue";

const route = useRoute();

const info = reactive({
  title: "AI面试",
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
        - **行为问题 (Behavioral Questions)**：深入探究我过往的经历，并引导我使用STAR原则（Situation, Task, Action, Result）来回答。例如：“请分享一个你处理过的最困难的项目。”
        - **情景问题 (Situational Questions)**：提出假设性场景，考察我的应变能力和解决问题的思路。例如：“如果我们产品的用户量下周突然翻倍，你会优先关注哪些技术问题？”
        - **简历深挖 (Resume Deep Dive)**：针对我简历中的某一段具体经历或技能进行提问。
        - **技术/专业问题 (Technical/Domain-specific Questions)**：根据岗位要求，提出相关的专业知识问题。
        - **动机与文化契合度问题 (Motivation & Culture Fit)**：考察我申请该岗位的动机以及与公司文化的匹配度。
    - **追问**：在我回答后，你必须像一个真正的面试官一样，针对我回答中的细节进行1-2次追问，以考察我思维的深度和逻辑的严谨性。
3.  **向我提问环节**：在面试主要部分结束后，你会问我：“你有什么想问我的吗？”并以该公司的面试官身份，尽力回答我的问题。
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
  {
    id: 'it',
    title: 'Goland开发工程师',
    description: '针对Goland开发工程师岗位的技术面试',
    icon: '💻',
    inputs: [
      { key: 'resume', label: '我的简历/核心技能（越详细越好）', placeholder: '如：拥有5年后端开发经验，精通Go语言、MySQL和Redis', required: true }
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
        - **行为问题 (Behavioral Questions)**：深入探究我过往的经历，并引导我使用STAR原则（Situation, Task, Action, Result）来回答。例如：“请分享一个你处理过的最困难的项目。”
        - **情景问题 (Situational Questions)**：提出假设性场景，考察我的应变能力和解决问题的思路。例如：“如果我们产品的用户量下周突然翻倍，你会优先关注哪些技术问题？”
        - **简历深挖 (Resume Deep Dive)**：针对我简历中的某一段具体经历或技能进行提问。
        - **技术/专业问题 (Technical/Domain-specific Questions)**：根据岗位要求，提出相关的专业知识问题。
        - **动机与文化契合度问题 (Motivation & Culture Fit)**：考察我申请该岗位的动机以及与公司文化的匹配度。
    - **追问**：在我回答后，你必须像一个真正的面试官一样，针对我回答中的细节进行1-2次追问，以考察我思维的深度和逻辑的严谨性。
3.  **向我提问环节**：在面试主要部分结束后，你会问我：“你有什么想问我的吗？”并以该公司的面试官身份，尽力回答我的问题。
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
const chatCoreRef = ref();

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
  // 重置输入
  promptInputs.value = {};
  showChat.value = false;
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
const startInterview = async () => {
  console.log('=== 开始面试流程 ===');
  
  if (!canStartInterview.value) {
    console.log('❌ 无法开始面试，必填项未完成');
    return;
  }
  
  console.log('1. 显示聊天界面');
  showChat.value = true;
  
  // 等待聊天组件渲染完成
  console.log('2. 等待聊天组件渲染...');
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (chatCoreRef.value) {
    console.log('3. 设置系统提示词');
    chatCoreRef.value.setSystemPrompt(generatedSystemPrompt.value);
    console.log('4. 系统提示词设置完成，等待供应商自动选择...');
    // 剩下的工作由 handleProviderChanged 自动处理
  }
  
  console.log('=== 面试流程设置完成 ===');
};

// 重新选择
const selectAgain = () => {
  selectedPrompt.value = null;
  promptInputs.value = {};
  showChat.value = false;
  if (chatCoreRef.value) {
    chatCoreRef.value.clearChat();
  }
};

// 处理对话开始事件
const handleConversationStarted = () => {
  console.log('AI面试对话已开始');
};

// 根据面试类型生成用户开始消息
const generateUserStartMessage = (): string => {
  if (!selectedPrompt.value) return "我准备好了，可以开始面试吗？";
  
  const messages = [
    "您好！我已经准备好了，可以开始面试吗？",
    "我准备好了，请开始面试吧！", 
    "面试官您好，我已经做好准备，可以开始了。",
    "您好！我对这次面试很期待，现在可以开始吗？"
  ];
  
  // 根据面试类型添加特定的消息
  switch (selectedPrompt.value.id) {
    case 'general':
      const position = promptInputs.value.position || '这个岗位';
      const company = promptInputs.value.company || '贵公司';
      messages.push(
        `您好！我很期待这次${company}的${position}面试，我已经准备好了。`,
        `面试官您好！我对${position}这个岗位很感兴趣，现在可以开始面试吗？`
      );
      break;
    
    case 'it':
      messages.push(
        "您好！我已经准备好进行Golang开发工程师的技术面试了。",
        "面试官您好！作为一名Go开发者，我很期待这次技术面试，可以开始吗？"
      );
      break;
      
    default:
      messages.push(`您好！我已经准备好进行${selectedPrompt.value.title}了。`);
  }
  
  // 随机选择一个消息
  return messages[Math.floor(Math.random() * messages.length)];
};

// 监听供应商变更事件，用于自动开始对话
const handleProviderChanged = (selection: any) => {
  console.log('=== handleProviderChanged 触发 ===');
  console.log('面试页面收到供应商变更:', selection);
  console.log('当前showChat状态:', showChat.value);
  console.log('chatCoreRef存在:', !!chatCoreRef.value);
  
  // 如果供应商和模型都已选择，且处于面试状态，且当前没有消息，则自动发送开始消息
  if (selection.provider && selection.model && showChat.value && chatCoreRef.value) {
    console.log('✅ 所有条件满足，准备自动发送开始面试消息');
    
    // 延迟确保所有状态都更新完成
    setTimeout(async () => {
      try {
        console.log('开始检查消息数量...');
        // 检查是否已经有消息了，避免重复发送
        const currentMessages = chatCoreRef.value.messages || [];
        console.log('当前消息数量:', currentMessages.length);
        console.log('消息内容:', currentMessages);
        
        if (currentMessages.length === 0) {
          console.log('✅ 没有消息，开始自动发送用户开始消息');
          
          // 生成个性化的开始消息
          const startMessage = generateUserStartMessage();
          console.log('生成的开始消息:', startMessage);
          
          console.log('调用 handleUserInput...');
          await chatCoreRef.value.handleUserInput(startMessage);
          console.log('✅ 自动开始消息发送成功');
        } else {
          console.log('⚠️ 已有消息记录，跳过自动发送');
          console.log('现有消息:', currentMessages.map(m => ({ type: m.type, content: m.content.substring(0, 50) })));
        }
      } catch (error) {
        console.error('❌ 自动发送开始消息失败:', error);
        
        // 如果自动发送失败，尝试发送一个简单的备用消息
        try {
          console.log('尝试发送备用消息...');
          await chatCoreRef.value.handleUserInput("我准备好了，可以开始面试吗？");
          console.log('✅ 备用开始消息发送成功');
        } catch (backupError) {
          console.error('❌ 备用消息也发送失败:', backupError);
        }
      }
    }, 1000); // 增加延迟确保组件完全加载
  } else {
    console.log('❌ 条件不满足，不发送消息');
    console.log('selection.provider:', selection.provider);
    console.log('selection.model:', selection.model);
    console.log('showChat.value:', showChat.value);
    console.log('chatCoreRef.value:', !!chatCoreRef.value);
  }
  
  console.log('=== handleProviderChanged 结束 ===');
};

// 组件挂载时检查URL参数
onMounted(() => {
  // 可以通过URL参数直接选择特定的面试类型
  const promptId = route.query.prompt as string;
  if (promptId) {
    const prompt = interviewPrompts.find(p => p.id === promptId);
    if (prompt) {
      selectPrompt(prompt);
    }
  }
});
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
            <input
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
    <div v-else>
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

      <AiChatCore
        ref="chatCoreRef"
        :title="selectedPrompt?.title || 'AI面试助手'"
        :system-prompt="generatedSystemPrompt"
        storage-key="ai-interview-provider-selection"
        @conversation-started="handleConversationStarted"
        @provider-changed="handleProviderChanged"
      />
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
        <br>• <strong>多供应商支持</strong>：支持多个AI服务供应商，确保稳定的面试体验
        <br><br>
        <strong>使用建议：</strong>
        <br>1. 选择与目标岗位匹配的面试类型
        <br>2. 如实填写个人信息，获得更精准的面试体验
        <br>3. 认真对待每个问题，模拟真实面试状态
        <br>4. 主动询问面试技巧和改进建议
        <br>5. 可以多次练习，熟悉不同类型的面试风格
        <br>6. 利用AI的专业建议改进简历和回答思路
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 添加一些自定义样式 */
.grid-item-hover {
  transform: translateY(-2px);
}
</style>

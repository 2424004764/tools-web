<template>
  <div class="ai-provider-selector">
    <div class="selector-row">
      <!-- 供应商选择 -->
      <div class="selector-item">
        <label class="selector-label">AI供应商</label>
        <select 
          v-model="selectedProvider" 
          @change="handleProviderChange"
          class="selector-select"
        >
          <option value="">请选择供应商</option>
          <option 
            v-for="provider in availableProviders" 
            :key="provider.name" 
            :value="provider.name"
          >
            {{ provider.displayName }}
          </option>
        </select>
        <div class="selector-desc">{{ getSelectedProviderDesc() }}</div>
      </div>

      <!-- 模型选择 -->
      <div class="selector-item">
        <label class="selector-label">AI模型</label>
        <select 
          v-model="selectedModel" 
          @change="handleModelChange"
          class="selector-select"
          :disabled="!selectedProvider"
        >
          <option value="">请选择模型</option>
          <option 
            v-for="model in availableModels" 
            :key="model.name" 
            :value="model.name"
          >
            {{ model.name }}
          </option>
        </select>
        <div class="selector-desc">{{ getSelectedModelDesc() }}</div>
      </div>
    </div>

    <!-- 当前选择显示 -->
    <div v-if="selectedProvider && selectedModel" class="current-selection">
      <div class="selection-info">
        <span class="selection-label">当前选择:</span>
        <span class="selection-value">{{ getProviderDisplayName(selectedProvider) }} - {{ selectedModel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

// 定义组件的props和emits
interface Props {
  modelValue?: {
    provider: string
    model: string
  }
  placeholder?: string
  storageKey?: string // 新增：存储键名，用于区分不同页面的选择
}

interface Emits {
  (e: 'update:modelValue', value: { provider: string; model: string }): void
  (e: 'change', value: { provider: string; model: string }): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ provider: '', model: '' }),
  placeholder: '请选择',
  storageKey: 'ai-provider-selection' // 默认存储键名
})

const emit = defineEmits<Emits>()

// 供应商数据
const availableProviders = ref([
  {
    name: 'pollinations',
    displayName: 'Pollinations',
    description: '强大的AI图像生成和文本处理服务，支持多种模型'
  },
  {
    name: 'aitools',
    displayName: 'AI Tools',
    description: '多种AI模型集合，支持文本、图像、音频处理'
  }
])

// Pollinations模型数据
const pollinationsModels = ref([
  {
    name: "claude",
    original_name: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    description: "Claude 3.5 Haiku (Bedrock) - 快速响应的对话模型，支持工具调用",
    provider: "bedrock",
    tier: "seed",
    community: false,
    aliases: "claude-3-5-haiku",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "deepseek-reasoning",
    original_name: "us.deepseek.r1-v1:0",
    description: "DeepSeek R1 0528 (Bedrock) - 专为推理任务优化的模型",
    maxInputChars: 10000,
    reasoning: true,
    provider: "bedrock",
    tier: "seed",
    community: false,
    aliases: "deepseek-r1-0528",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: false,
    vision: false,
    audio: false
  },
  {
    name: "gemini",
    original_name: "google/gemini-2.5-flash-lite",
    description: "Gemini 2.5 Flash Lite (api.navy) - Google的多模态AI模型",
    provider: "api.navy",
    tier: "anonymous",
    community: false,
    aliases: "gemini-2.5-flash-lite",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "gpt-5-nano",
    description: "OpenAI GPT-5 Nano - OpenAI最新一代模型，支持图像和文本",
    original_name: "gpt-5-nano-2025-08-07",
    provider: "azure",
    tier: "anonymous",
    community: false,
    aliases: "gpt-5-nano",
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "llama-fast-roblox",
    original_name: "@cf/meta/llama-3.2-11b-vision-instruct",
    description: "Llama 3.2 1B - Meta开源模型，支持视觉和工具",
    provider: "cloudflare",
    tier: "anonymous",
    community: false,
    aliases: "llama-3.2-1b-instruct",
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "llama-roblox",
    original_name: "meta-llama/Meta-Llama-3.1-8B-Instruct-fast",
    description: "Llama 3.1 8B Instruct - Meta高性能对话模型",
    provider: "nebius",
    tier: "anonymous",
    community: false,
    aliases: "llama-3.1-8b-instruct",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "llamascout",
    original_name: "@cf/meta/llama-4-scout-17b-16e-instruct",
    description: "Llama 4 Scout 17B - Meta大型推理模型",
    provider: "cloudflare",
    tier: "anonymous",
    community: false,
    aliases: "llama-4-scout-17b-16e-instruct",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: false,
    vision: false,
    audio: false
  },
  {
    name: "mistral",
    original_name: "mistral-small-3.1-24b-instruct-2503",
    description: "Mistral Small 3.1 24B - 高性能推理模型，支持工具调用",
    provider: "scaleway",
    tier: "anonymous",
    community: false,
    aliases: "mistral-small-3.1-24b-instruct",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "mistral-nemo-roblox",
    original_name: "mistralai/Mistral-Nemo-Instruct-2407",
    description: "Mistral Nemo Instruct 2407 - 专业指令模型",
    provider: "nebius",
    tier: "anonymous",
    community: false,
    aliases: "mistral-nemo-instruct-2407",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "mistral-roblox",
    original_name: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    description: "Mistral Small 3.1 24B - Cloudflare版本，支持视觉",
    provider: "cloudflare",
    tier: "anonymous",
    community: false,
    aliases: "mistral-small-cloudflare",
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "nova-fast",
    description: "Amazon Nova Micro (Bedrock) - 亚马逊轻量级模型",
    original_name: "amazon.nova-micro-v1:0",
    provider: "bedrock",
    community: false,
    tier: "anonymous",
    aliases: "nova-micro-v1",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "openai",
    description: "OpenAI GPT-4.1 Nano - OpenAI高性能对话模型，支持多模态",
    provider: "azure",
    tier: "anonymous",
    community: false,
    aliases: "gpt-4.1-nano",
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false,
    original_name: "gpt-4.1-nano-2025-04-14"
  },
  {
    name: "openai-audio",
    original_name: "gpt-4o-mini-audio-preview-2024-12-17",
    description: "OpenAI GPT-4o Mini Audio Preview - 支持音频输入输出的多模态模型",
    maxInputChars: 2000,
    voices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral", "verse", "ballad", "ash", "sage", "amuch", "dan"],
    provider: "azure",
    tier: "seed",
    community: false,
    aliases: "gpt-4o-mini-audio-preview",
    input_modalities: ["text", "image", "audio"],
    output_modalities: ["audio", "text"],
    tools: true,
    vision: true,
    audio: true
  },
  {
    name: "openai-fast",
    description: "OpenAI GPT-4.1 Nano - 快速响应版本",
    provider: "azure",
    tier: "anonymous",
    community: false,
    aliases: "gpt-4.1-nano",
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "openai-large",
    original_name: "gpt-4.1-2025-04-14",
    description: "OpenAI GPT-4.1 - 大型高性能模型，支持长文本",
    maxInputChars: 5000,
    provider: "azure",
    tier: "flower",
    community: false,
    aliases: "gpt-4.1",
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "openai-reasoning",
    original_name: "openai/o3",
    description: "OpenAI o3 (api.navy) - 专为推理优化的模型",
    provider: "api.navy",
    tier: "seed",
    community: false,
    aliases: "o3",
    reasoning: true,
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "openai-roblox",
    description: "OpenAI GPT-4.1 Nano - Roblox专用版本",
    provider: "azure",
    tier: "anonymous",
    community: false,
    aliases: "gpt-4.1-nano",
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "qwen-coder",
    original_name: "qwen2.5-coder-32b-instruct",
    description: "Qwen 2.5 Coder 32B - 阿里云代码生成专用模型",
    provider: "scaleway",
    tier: "anonymous",
    community: false,
    aliases: "qwen2.5-coder-32b-instruct",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "roblox-rp",
    description: "Roblox RP Multi-Model - 多模型随机选择",
    original_name: "mistral.mistral-small-2402-v1:0",
    provider: "bedrock",
    tier: "anonymous",
    community: false,
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "bidara",
    description: "BIDARA - NASA生物仿生设计助手，支持图像和文本",
    provider: "azure",
    tier: "anonymous",
    community: true,
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "elixposearch",
    description: "Elixpo Search - 专业搜索助手",
    provider: "azure",
    tier: "anonymous",
    community: true,
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: false,
    vision: false,
    audio: false
  },
  {
    name: "evil",
    description: "Evil - 无审查AI助手，支持图像和文本",
    provider: "scaleway",
    uncensored: true,
    tier: "seed",
    community: true,
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "midijourney",
    description: "MIDIjourney - 音乐创作AI助手",
    provider: "azure",
    tier: "anonymous",
    community: true,
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "mirexa",
    description: "Mirexa AI Companion - AI伴侣助手，支持图像和文本",
    provider: "azure",
    tier: "seed",
    community: true,
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "rtist",
    description: "Rtist - 艺术家AI助手",
    provider: "azure",
    tier: "seed",
    community: true,
    input_modalities: ["text"],
    output_modalities: ["text"],
    tools: true,
    vision: false,
    audio: false
  },
  {
    name: "sur",
    description: "Sur AI Assistant - Sur AI助手，支持图像和文本",
    provider: "scaleway",
    tier: "seed",
    community: true,
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  },
  {
    name: "unity",
    description: "Unity Unrestricted Agent - Unity无限制AI代理，支持图像和文本",
    provider: "scaleway",
    uncensored: true,
    tier: "seed",
    community: true,
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    tools: true,
    vision: true,
    audio: false
  }
])

// AI Tools模型数据
const aitoolsModels = ref([
  // { 
  //   name: "moonshotai/kimi-k2", 
  //   description: "Moonshot AI Kimi K2 - 强大的对话和推理模型，支持复杂任务处理" 
  // },
  // { 
  //   name: "deepseek/deepseek-r1-0528", 
  //   description: "DeepSeek R1 0528 - 高性能推理模型，专为逻辑推理优化" 
  // },
  { 
    name: "deepseek/deepseek-v3-0324", 
    description: "DeepSeek V3 0324 - 最新版本的多模态模型，支持文本和图像" 
  },
  { 
    name: "deepseek/deepseek-r1-32b", 
    description: "DeepSeek R1 32B - 32B参数大型模型，强大的理解和生成能力" 
  },
  { 
    name: "deepseek/deepseek-r1-70b", 
    description: "DeepSeek R1 70B - 70B参数超大型模型，顶级AI性能" 
  },
  // { 
  //   name: "google/gemini-2.0-flash-exp", 
  //   description: "Google Gemini 2.0 Flash - 实验版多模态模型，快速响应" 
  // },
  // { 
  //   name: "google/gemma-3-27b", 
  //   description: "Google Gemma 3 27B - 开源大语言模型，平衡性能和效率" 
  // },
  // { 
  //   name: "qwen/qwq-32b", 
  //   description: "Qwen QWQ 32B - 阿里云高性能对话模型，32B参数" 
  // },
  { 
    name: "qwen/qwen2.5-7b", 
    description: "Qwen 2.5 7B - 轻量级但功能强大的模型，适合快速部署" 
  },
  // { 
  //   name: "qwen/qwen2.5-72b", 
  //   description: "Qwen 2.5 72B - 大型高性能模型，72B参数，顶级理解能力" 
  // },
  // { 
  //   name: "qwen/qwen2.5-vl-32b", 
  //   description: "Qwen 2.5 VL 32B - 多模态模型，支持文本和视觉理解" 
  // },
  // { 
  //   name: "qwen/qwen2.5-vl-72b", 
  //   description: "Qwen 2.5 VL 72B - 大型多模态模型，72B参数，顶级视觉理解" 
  // },
  { 
    name: "zhipu/glm-4-9b", 
    description: "智谱 GLM-4 9B - 清华智谱AI的对话模型，9B参数" 
  },
  { 
    name: "zhipu/glm-4-flash", 
    description: "智谱 GLM-4 Flash - 快速响应的对话模型，优化推理速度" 
  },
  // { 
  //   name: "zhipu/glm-4v-flash", 
  //   description: "智谱 GLM-4V Flash - 多模态模型，支持文本和视觉，快速响应" 
  // },
  { 
    name: "zhipu/glm-4.1v-thinking-flash", 
    description: "智谱 GLM-4.1V Thinking Flash - 思维链推理模型，支持复杂逻辑" 
  },
  // { 
  //   name: "qwen/qwen3-30b-a3b", 
  //   description: "Qwen 3 30B A3B - 阿里云第三代模型，30B参数，A3B架构" 
  // },
  // { 
  //   name: "qwen/qwen3-14b", 
  //   description: "Qwen 3 14B - 阿里云第三代模型，14B参数，平衡性能和效率" 
  // },
  // { 
  //   name: "qwen/qwen3-coder", 
  //   description: "Qwen 3 Coder - 阿里云代码生成专用模型，专为编程优化" 
  // },
  { 
    name: "zhipu/glm-4.5-flash", 
    description: "智谱 GLM-4.5 Flash - 最新版本快速模型，4.5代架构" 
  },
  // { 
  //   name: "openai/gpt-oss-20b", 
  //   description: "OpenAI GPT OSS 20B - OpenAI开源模型，20B参数" 
  // },
  // { 
  //   name: "tencent/hunyuan-a13b", 
  //   description: "腾讯混元 A13B - 腾讯AI实验室大模型，13B参数" 
  // }
])

// 响应式数据
const selectedProvider = ref('')
const selectedModel = ref('')

// 计算属性
const availableModels = computed(() => {
  if (!selectedProvider.value) return []
  return selectedProvider.value === 'pollinations' ? pollinationsModels.value : aitoolsModels.value
})

// 扩展本地存储，为每个供应商保存选择的模型
const saveToLocalStorage = (selection: { provider: string; model: string }) => {
  try {
    // 保存当前选择
    localStorage.setItem(props.storageKey, JSON.stringify(selection))
    
    // 保存每个供应商的模型选择历史
    const providerHistoryKey = `${props.storageKey}-provider-history`
    const existingHistory = localStorage.getItem(providerHistoryKey)
    let providerHistory = existingHistory ? JSON.parse(existingHistory) : {}
    
    // 更新当前供应商的模型选择
    providerHistory[selection.provider] = selection.model
    
    // 保存更新后的历史记录
    localStorage.setItem(providerHistoryKey, JSON.stringify(providerHistory))
  } catch (error) {
    console.warn('无法保存到本地存储:', error)
  }
}

const loadFromLocalStorage = (): { provider: string; model: string } => {
  try {
    const stored = localStorage.getItem(props.storageKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      // 验证存储的数据是否有效
      if (parsed.provider && parsed.model) {
        // 检查供应商是否仍然可用
        const providerExists = availableProviders.value.some(p => p.name === parsed.provider)
        if (providerExists) {
          // 检查模型是否仍然可用
          const models = parsed.provider === 'pollinations' ? pollinationsModels.value : aitoolsModels.value
          const modelExists = models.some(m => m.name === parsed.model)
          if (modelExists) {
            return parsed
          }
        }
      }
    }
  } catch (error) {
    console.warn('无法从本地存储加载数据:', error)
  }
  return { provider: '', model: '' }
}

// 获取指定供应商的模型选择历史
const getProviderModelHistory = (providerName: string): string => {
  try {
    const providerHistoryKey = `${props.storageKey}-provider-history`
    const existingHistory = localStorage.getItem(providerHistoryKey)
    if (existingHistory) {
      const providerHistory = JSON.parse(existingHistory)
      return providerHistory[providerName] || ''
    }
  } catch (error) {
    console.warn('无法从本地存储加载供应商历史:', error)
  }
  return ''
}

// 方法
const handleProviderChange = () => {
  const newProvider = selectedProvider.value
  
  // 获取该供应商的模型选择历史
  const previousModel = getProviderModelHistory(newProvider)
  
  if (previousModel) {
    // 如果之前选择过该供应商的模型，验证模型是否仍然可用
    const models = newProvider === 'pollinations' ? pollinationsModels.value : aitoolsModels.value
    const modelExists = models.some(m => m.name === previousModel)
    
    if (modelExists) {
      // 使用之前选择的模型
      selectedModel.value = previousModel
      console.log(`使用之前选择的模型: ${previousModel}`)
    } else {
      // 模型不可用，选择第一个可用模型
      const firstModel = models[0]
      if (firstModel) {
        selectedModel.value = firstModel.name
        console.log(`模型不可用，选择第一个: ${firstModel.name}`)
      }
    }
  } else {
    // 如果之前没有选择过该供应商的模型，选择第一个
    const models = newProvider === 'pollinations' ? pollinationsModels.value : aitoolsModels.value
    const firstModel = models[0]
    if (firstModel) {
      selectedModel.value = firstModel.name
      console.log(`首次选择该供应商，使用第一个模型: ${firstModel.name}`)
    }
  }
  
  emitSelection()
}

const handleModelChange = () => {
  emitSelection()
}

const emitSelection = () => {
  const selection = {
    provider: selectedProvider.value,
    model: selectedModel.value
  }
  emit('update:modelValue', selection)
  emit('change', selection)
  
  // 保存到本地存储
  if (selection.provider && selection.model) {
    saveToLocalStorage(selection)
  }
}

const getProviderDisplayName = (providerName: string) => {
  const provider = availableProviders.value.find(p => p.name === providerName)
  return provider ? provider.displayName : providerName
}

const getSelectedProviderDesc = () => {
  if (!selectedProvider.value) return '请先选择AI供应商'
  const provider = availableProviders.value.find(p => p.name === selectedProvider.value)
  return provider ? provider.description : ''
}

const getSelectedModelDesc = () => {
  if (!selectedProvider.value) return '请先选择AI供应商'
  if (!selectedModel.value) return '请选择具体的AI模型'
  
  const models = selectedProvider.value === 'pollinations' ? pollinationsModels.value : aitoolsModels.value
  const model = models.find(m => m.name === selectedModel.value)
  return model ? model.description : ''
}

// 初始化：优先使用props，如果没有则从本地存储加载，最后使用默认值
const initializeSelection = () => {
  if (props.modelValue.provider && props.modelValue.model) {
    // 如果有props值，使用props
    selectedProvider.value = props.modelValue.provider
    selectedModel.value = props.modelValue.model
  } else {
    // 如果没有props值，从本地存储加载
    const stored = loadFromLocalStorage()
    if (stored.provider && stored.model) {
      selectedProvider.value = stored.provider
      selectedModel.value = stored.model
      // 触发一次emit，让父组件知道初始值
      emit('update:modelValue', stored)
    } else {
      // 如果本地存储也没有数据，使用默认值（第一个供应商和第一个模型）
      const defaultProvider = availableProviders.value[0]
      const defaultModel = pollinationsModels.value[0] // 默认使用pollinations的第一个模型
      
      if (defaultProvider && defaultModel) {
        selectedProvider.value = defaultProvider.name
        selectedModel.value = defaultModel.name
        
        const defaultSelection = {
          provider: defaultProvider.name,
          model: defaultModel.name
        }
        
        // 触发emit，让父组件知道默认值
        emit('update:modelValue', defaultSelection)
        emit('change', defaultSelection)
        
        // 保存默认选择到本地存储
        saveToLocalStorage(defaultSelection)
        
        console.log('使用默认选择:', defaultSelection)
      }
    }
  }
}

// 监听props变化
watch(() => props.modelValue, (newValue) => {
  if (newValue.provider && newValue.model) {
    selectedProvider.value = newValue.provider
    selectedModel.value = newValue.model
  }
}, { deep: true })

// 组件挂载时初始化
onMounted(() => {
  initializeSelection()
})
</script>

<style scoped>
.ai-provider-selector {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e5e7eb;
}

.selector-row {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.selector-item {
  flex: 1;
  min-width: 0;
}

.selector-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.selector-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #1f2937;
  transition: border-color 0.2s ease;
}

.selector-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.selector-select:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.selector-desc {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
  min-height: 16px;
}

.current-selection {
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selection-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.selection-value {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .selector-row {
    flex-direction: column;
    gap: 16px;
  }
  
  .ai-provider-selector {
    padding: 12px;
  }
}
</style>

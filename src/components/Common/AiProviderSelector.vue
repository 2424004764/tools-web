<template>
  <div class="ai-provider-selector">
    <!-- 添加加载提示 -->
    <div v-if="isLoadingModels" class="loading-indicator">
      <span>正在加载模型列表...</span>
    </div>
    
    <!-- 添加错误提示 -->
    <div v-if="modelsLoadError" class="error-indicator">
      <span>⚠️ {{ modelsLoadError }}</span>
      <button @click="fetchPollinationsModels" class="retry-button">重试</button>
    </div>

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
          :disabled="!selectedProvider || isLoadingModels"
        >
          <option value="">
            {{ isLoadingModels ? '正在加载模型...' : '请选择模型' }}
          </option>
          <option 
            v-for="model in availableModels" 
            :key="model.name" 
            :value="model.name"
          >
            {{ model.name }}
          </option>
        </select>
        <div class="selector-desc">
          {{ isLoadingModels && selectedProvider === 'pollinations' ? '正在获取最新模型列表...' : getSelectedModelDesc() }}
        </div>
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
import axios from 'axios'
const pollinationsTextUrl = ref(import.meta.env.VITE_POLLINATIONS_TEXT_URL);

// 定义模型接口类型
interface ModelData {
  name: string
  description?: string
  provider?: string
  reasoning?: boolean
  vision?: boolean
  audio?: boolean
  tools?: boolean
  community?: boolean
  [key: string]: any
}

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

// 添加加载状态
const isLoadingModels = ref(false)
const modelsLoadError = ref('')

// Pollinations模型数据（改为响应式数据，支持动态更新）
const pollinationsModels = ref<ModelData[]>([])

// 获取Pollinations模型列表
const fetchPollinationsModels = async () => {
  try {
    isLoadingModels.value = true
    modelsLoadError.value = ''
    
    // 获取代理URL和目标URL
    const proxyUrl = import.meta.env.VITE_POLLINATIONS_PROXY_URL || ''
    const targetUrl = `${pollinationsTextUrl.value}/models`
    
    if (!proxyUrl) {
      throw new Error('代理URL未配置，请检查环境变量 VITE_POLLINATIONS_PROXY_URL')
    }
    
    // 使用代理请求模型列表
    const response = await axios.get(
      `${proxyUrl}?path=models&target=${targetUrl}&params=_t=${Date.now()}`,
      { 
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    
    // 处理响应数据
    let models: any[] = []
    if (Array.isArray(response.data)) {
      models = response.data
    } else if (response.data && Array.isArray(response.data.models)) {
      models = response.data.models
    } else {
      throw new Error('接口返回数据格式不正确')
    }
    
    // 转换数据格式，添加中文描述
    pollinationsModels.value = models.map((model: any) => ({
      ...model,
      // 如果没有 description，根据模型名称生成描述
      description: model.description || generateModelDescription(model)
    }))
    
    console.log('成功获取Pollinations模型列表:', pollinationsModels.value.length, '个模型')
    
  } catch (error) {
    console.error('获取Pollinations模型列表失败:', error)
    modelsLoadError.value = (error as Error).message || '获取模型列表失败'
  } finally {
    isLoadingModels.value = false
  }
}

// 生成模型描述（根据模型信息）
const generateModelDescription = (model: any): string => {
  let description = model.name || '未知模型'
  
  if (model.provider) {
    description += ` (${model.provider})`
  }
  
  if (model.reasoning) {
    description += ' - 专为推理任务优化'
  }
  
  if (model.vision) {
    description += ' - 支持图像理解'
  }
  
  if (model.audio) {
    description += ' - 支持音频处理'
  }
  
  if (model.tools) {
    description += ' - 支持工具调用'
  }
  
  if (model.community) {
    description += ' - 社区模型'
  }
  
  return description
}

// AI Tools模型数据
const aitoolsModels = ref<ModelData[]>([
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
  { 
    name: "qwen/qwen2.5-7b", 
    description: "Qwen 2.5 7B - 轻量级但功能强大的模型，适合快速部署" 
  },
  { 
    name: "zhipu/glm-4-9b", 
    description: "智谱 GLM-4 9B - 清华智谱AI的对话模型，9B参数" 
  },
  { 
    name: "zhipu/glm-4-flash", 
    description: "智谱 GLM-4 Flash - 快速响应的对话模型，优化推理速度" 
  },
  { 
    name: "zhipu/glm-4.1v-thinking-flash", 
    description: "智谱 GLM-4.1V Thinking Flash - 思维链推理模型，支持复杂逻辑" 
  },
  { 
    name: "zhipu/glm-4.5-flash", 
    description: "智谱 GLM-4.5 Flash - 最新版本快速模型，4.5代架构" 
  }
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
  console.log('=== initializeSelection 开始 ===');
  console.log('props.modelValue:', props.modelValue);
  
  if (props.modelValue.provider && props.modelValue.model) {
    console.log('使用 props 值');
    // 如果有props值，使用props
    selectedProvider.value = props.modelValue.provider;
    selectedModel.value = props.modelValue.model;
  } else {
    console.log('尝试从本地存储加载');
    // 如果没有props值，从本地存储加载
    const stored = loadFromLocalStorage();
    console.log('本地存储的值:', stored);
    
    if (stored.provider && stored.model) {
      console.log('使用本地存储的值');
      selectedProvider.value = stored.provider;
      selectedModel.value = stored.model;
      // 触发一次emit，让父组件知道初始值
      emit('update:modelValue', stored);
      emit('change', stored);
    } else {
      console.log('使用默认值');
      // 如果本地存储也没有数据，使用默认值（第一个供应商和第一个模型）
      const defaultProvider = availableProviders.value[0];
      console.log('默认供应商:', defaultProvider);
      console.log('pollinations模型数量:', pollinationsModels.value.length);
      
      const defaultModel = pollinationsModels.value[0]; // 默认使用pollinations的第一个模型
      console.log('默认模型:', defaultModel);

      if (defaultProvider && defaultModel) {
        console.log('设置默认选择');
        selectedProvider.value = defaultProvider.name;
        selectedModel.value = defaultModel.name;
        
        const defaultSelection = {
          provider: defaultProvider.name,
          model: defaultModel.name
        };
        
        console.log('默认选择:', defaultSelection);
        
        // 触发emit，让父组件知道默认值
        emit('update:modelValue', defaultSelection);
        emit('change', defaultSelection);
        
        // 保存默认选择到本地存储
        saveToLocalStorage(defaultSelection);
        
        console.log('✅ 默认选择设置完成');
      } else {
        console.log('❌ 无法设置默认选择');
        console.log('defaultProvider存在:', !!defaultProvider);
        console.log('defaultModel存在:', !!defaultModel);
        
        if (defaultProvider) {
          // 如果没有模型数据，至少设置供应商
          selectedProvider.value = defaultProvider.name;
          console.log('只设置了默认供应商');
        }
      }
    }
  }
  
  console.log('=== initializeSelection 结束 ===');
  console.log('最终选择:', { provider: selectedProvider.value, model: selectedModel.value });
};

// 监听props变化
watch(() => props.modelValue, (newValue) => {
  if (newValue.provider && newValue.model) {
    selectedProvider.value = newValue.provider
    selectedModel.value = newValue.model
  }
}, { deep: true })

// 组件挂载时初始化
onMounted(async () => {
  console.log('AiProviderSelector onMounted 开始');
  
  // 先获取模型列表，再初始化选择
  await fetchPollinationsModels();
  
  console.log('模型获取完成，pollinationsModels数量:', pollinationsModels.value.length);
  console.log('开始初始化选择...');
  
  initializeSelection();
  
  console.log('AiProviderSelector onMounted 完成');
});
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
  position: relative;
}

/* 添加loading时的样式 */
.selector-select[disabled] {
  background: linear-gradient(90deg, #f9fafb 25%, #f1f5f9 50%, #f9fafb 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 加载指示器添加动画 */
.loading-indicator::before {
  content: '';
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #0ea5e9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

/* 新增加载和错误提示样式 */
.loading-indicator {
  padding: 8px 12px;
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 6px;
  color: #0c4a6e;
  font-size: 14px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-indicator {
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid #f87171;
  border-radius: 6px;
  color: #dc2626;
  font-size: 14px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.retry-button {
  padding: 4px 8px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background: #b91c1c;
}
</style>

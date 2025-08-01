<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';

import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
const info = reactive({
  title: "在线文生图",
  desc: "免费无限次数生成图片，无需登录注册、直接使用",
  maxSeed: 100000000
})

  const prompt = ref('汽车');
  const imageUrl = ref('');
  const isLoading = ref(false);
  
  // 模型列表
  const models = ref<{value: string, label: string}[]>([]);
  const selectedModel = ref('');
  
  // 参数
  const width = ref(1024);
  const height = ref(1024);
  const noLogo = ref(false);
  const seed = ref(-1);

  // 获取可用模型
  const fetchModels = async () => {
    try {
      const response = await axios.get('https://image.pollinations.ai/models');
      const modelNames = response.data;
      
      models.value = modelNames.map(name => ({
        value: name,
        label: name.charAt(0).toUpperCase() + name.slice(1)
      }));
      
      if (models.value.length > 0) {
        selectedModel.value = models.value[0].value;
      }
    } catch (error) {
      console.error('获取模型失败:', error);
      models.value = [
        { value: 'flux', label: 'Flux' },
        { value: 'kontext', label: 'Kontext' },
        { value: 'turbo', label: 'Turbo' }
      ];
      selectedModel.value = models.value[0].value;
    }
  };

  onMounted(() => {
    fetchModels();
  });

  // 生成随机种子
  
  const generateRandomSeed = () => {
    seed.value = Math.floor(Math.random() * info.maxSeed);
  };

  const generateImage = async () => {
    if (!prompt.value.trim() || !selectedModel.value) return;
    
    isLoading.value = true;
    imageUrl.value = '';
    
    try {
      // 如果 seed 为 -1，生成一个随机种子
      const actualSeed = seed.value === -1 
        ? Math.floor(Math.random() * info.maxSeed) 
        : seed.value;
      
      // 构造查询参数
      const params = {
        model: selectedModel.value,
        width: width.value,
        height: height.value,
        nologo: noLogo.value ? 'true' : undefined,
        seed: actualSeed.toString() // 总是传递种子参数
      };
      
      // 移除未定义的参数
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined)
      );
      
      // 添加时间戳避免缓存
      filteredParams._t = Date.now();
      
      const response = await axios.get(
        `/api/pollinations/prompt/${encodeURIComponent(prompt.value)}`,
        {
          params: filteredParams,
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data], { type: 'image/png' });
      imageUrl.value = URL.createObjectURL(blob);
    } catch (error) {
      console.error('生成失败:', error);
      alert('图像生成失败，请重试');
    } finally {
      isLoading.value = false;
    }
  };

  // 在新标签页打开图像
  const openImageInNewTab = () => {
    window.open(imageUrl.value, '_blank');
  };
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div class="ai-text-to-image">
        <!-- 使用响应式网格布局 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- 左侧：选项和输入 -->
          <div class="space-y-6">
            <div class="input-section">
              <label class="block text-sm font-medium text-gray-700 mb-2">提示词</label>
              <textarea 
                v-model="prompt" 
                placeholder="输入描述文字..."
                class="w-full p-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 min-h-[150px]"
              ></textarea>
            </div>

            <!-- 模型选择器 -->
            <div class="model-selector">
              <label class="block text-sm font-medium text-gray-700 mb-2">选择模型</label>
              <select 
                v-model="selectedModel" 
                class="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="model in models" :key="model.value" :value="model.value">
                  {{ model.label }}
                </option>
              </select>
            </div>

            <!-- 参数区域 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">宽度 (px)</label>
                <input 
                  v-model.number="width" 
                  type="number" 
                  min="64" 
                  max="4096" 
                  class="w-full p-2 border rounded-lg"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">高度 (px)</label>
                <input 
                  v-model.number="height" 
                  type="number" 
                  min="64" 
                  max="4096" 
                  class="w-full p-2 border rounded-lg"
                >
              </div>
              
              <!-- 随机种子区域 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">随机种子</label>
                <div class="flex">
                  <input 
                    v-model.number="seed" 
                    type="number" 
                    min="-1" 
                    class="flex-1 p-2 border rounded-l-lg"
                    placeholder="-1 表示随机"
                  >
                  <button 
                    @click="generateRandomSeed"
                    class="bg-gray-200 hover:bg-gray-300 px-3 rounded-r-lg border-t border-r border-b"
                    title="生成随机种子"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div class="flex justify-between mt-1">
                  <p class="text-xs text-gray-500">-1 = 随机</p>
                  <button 
                    @click="seed = -1"
                    class="text-xs text-blue-600 hover:text-blue-800"
                  >
                    设为随机
                  </button>
                </div>
              </div>
              
              <div class="flex items-center justify-start md:justify-end">
                <div class="flex items-center">
                  <input 
                    v-model="noLogo" 
                    type="checkbox" 
                    id="noLogo" 
                    class="mr-2"
                  >
                  <label for="noLogo" class="text-sm font-medium text-gray-700">不显示水印</label>
                </div>
              </div>
            </div>

            <button 
              @click="generateImage" 
              class="generate-btn bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg shadow-md transition w-full"
            >
              生成图像
            </button>
          </div>

          <!-- 右侧：生成结果 -->
          <div class="result-section">
            <div v-if="isLoading" class="loading flex flex-col items-center justify-center h-full">
              <div class="spinner"></div>
              <p class="mt-4 text-lg">生成中...</p>
            </div>

            <div v-else-if="imageUrl" class="result h-full flex flex-col">
              <div class="mb-4">
                <h3 class="text-lg font-medium text-gray-700">生成结果</h3>
                <p class="text-sm text-gray-500">点击图像可查看大图</p>
              </div>
              <div class="flex-1 flex items-center justify-center">
                <img 
                  :src="imageUrl" 
                  alt="生成的图像" 
                  class="rounded-lg shadow-lg max-w-full max-h-[70vh] object-contain cursor-pointer"
                  @click="openImageInNewTab"
                >
              </div>
            </div>

            <div v-else class="placeholder flex flex-col items-center justify-center h-full text-center p-8">
              <div class="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 mb-4"></div>
              <h3 class="text-lg font-medium text-gray-700 mb-2">等待生成图像</h3>
              <p class="text-gray-500">输入提示词并点击"生成图像"按钮</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- desc -->
    <ToolDetail title="描述">
      <el-text>
        {{ info.desc }}
      </el-text> 
    </ToolDetail>
  </div>
</template>

<style scoped>
.ai-text-to-image {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem;
}

/* 结果区域样式 */
.result-section {
  background-color: #f9fafb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.placeholder {
  color: #6b7280;
  border-radius: 0.5rem;
}

/* 响应式调整 */
@media (max-width: 1024px) {
  .result-section {
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  .result-section {
    min-height: 300px;
  }
}

/* 加载动画 */
.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #4299e1;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 输入框样式 */
input[type="number"], input[type="text"], textarea, select {
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem;
  transition: all 0.2s;
}

input[type="number"]:focus, 
input[type="text"]:focus, 
textarea:focus, 
select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
}

/* 按钮样式 */
.generate-btn {
  font-weight: 600;
  transition: all 0.2s;
}

.generate-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.generate-btn:active {
  transform: translateY(0);
}

/* 随机种子输入框样式 */
.flex > input[type="number"] {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}

.flex > button {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  transition: background-color 0.2s;
}

.flex > button:hover {
  background-color: #d1d5db;
}
</style>
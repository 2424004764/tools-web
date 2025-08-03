<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import axios from "axios";

import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";

const pollinationsApiKey = ref(import.meta.env.VITE_POLLINATIONS_API_KEY || "");
const pollinationsProxyUrl = ref(import.meta.env.VITE_POLLINATIONS_PROXY_URL);
const pollinationsUrl = ref(import.meta.env.VITE_POLLINATIONS_TEXT_URL);

const info = reactive({
  title: "在线文本转语音",
  desc: "免费无限次数文本转语音，无需登录注册、直接使用，支持多种语音和语言，如果生成出错请重试，或者重新进一下页面",
  // 预设文本列表
  presetTexts: [
    "欢迎使用文本转语音工具，这是一个强大的AI语音合成服务。",
    "人工智能正在改变我们的生活方式，让科技更加人性化。",
    "今天天气真不错，阳光明媚，适合出去走走。",
    "感谢您使用我们的服务，希望这个工具能够帮助到您。",
    "这是一个示例文本，用于演示文本转语音功能的效果。",
    "语音合成技术让计算机能够像人类一样说话。",
    "科技的发展让我们的生活变得更加便利和高效。",
    "自然语言处理是人工智能的重要分支之一。",
    "机器学习算法能够从数据中学习并做出预测。",
    "深度学习在图像识别和语音识别方面取得了巨大进展。",
  ],
});

const text = ref(info.presetTexts[0]); // 使用第一个预设文本作为默认值
const audioUrl = ref("");
const isLoading = ref(false);

// 语音模型列表
const voices = ref<{ value: string; label: string }[]>([]);
const selectedVoice = ref("");

// 参数
const speed = ref(1.0);
const pitch = ref(1.0);
const volume = ref(1.0);

// 历史记录
const historyList = ref<{ text: string; audio: string; timestamp: number }[]>([]);
const maxHistoryCount = ref(Number(import.meta.env.VITE_AI_SPEECH_HISTORY_MAX) || 10);

// 添加新的响应式变量
const showGeneratedAudioModal = ref(false);
const voicesLoading = ref(false);
const voicesLoadError = ref(false);

// 获取可用语音
const fetchVoices = async () => {
  voicesLoading.value = true;
  voicesLoadError.value = false;
  
  try {
    const response = await axios.get(
      `${pollinationsProxyUrl.value}?path=models&target=${pollinationsUrl.value}`
    );
    const models = response.data;

    // 过滤出有voices字段且不为空的模型
    const audioModel = models.find((model: any) => 
      model.voices && Array.isArray(model.voices) && model.voices.length > 0
    );

    if (audioModel && audioModel.voices) {
      voices.value = audioModel.voices.map((voice: string) => ({
        value: voice,
        label: voice.charAt(0).toUpperCase() + voice.slice(1),
      }));

      if (voices.value.length > 0) {
        selectedVoice.value = voices.value[0].value;
      }
    } else {
      voices.value = [];
      selectedVoice.value = "";
    }
  } catch (error) {
    console.error("获取语音列表失败:", error);
    voicesLoadError.value = true;
    voices.value = [];
    selectedVoice.value = "";
  } finally {
    voicesLoading.value = false;
  }
};

onMounted(() => {
  fetchVoices();
});

// 随机选择预设文本
const randomPresetText = () => {
  const randomIndex = Math.floor(Math.random() * info.presetTexts.length);
  text.value = info.presetTexts[randomIndex];
};

const generateSpeech = async () => {
  if (!text.value.trim() || !selectedVoice.value) return;

  isLoading.value = true;
  audioUrl.value = "";

  try {
    // 构造查询参数
    const params: Record<string, string> = {
      voice: selectedVoice.value,
      speed: speed.value.toString(),
      pitch: pitch.value.toString(),
      volume: volume.value.toString(),
    };

    // 添加时间戳避免缓存
    params._t = String(Date.now());

    // 将 params 转成 GET 参数拼接
    const response = await axios.get(
      `${pollinationsProxyUrl.value}?path=${encodeURIComponent(text.value)}&target=${pollinationsUrl.value}`,
      {
        headers: {
          Authorization: "Bearer " + pollinationsApiKey.value,
        },
        responseType: "blob",
      }
    );

    const blob = new Blob([response.data], { type: "audio/mpeg" });
    audioUrl.value = URL.createObjectURL(blob);

    // 保存到历史记录
    saveToHistory(text.value, audioUrl.value);
  } catch (error) {
    console.error("语音生成失败:", error);
    alert("语音生成失败，请稍后重试");
  } finally {
    isLoading.value = false;
  }
};

// 修改打开音频的方法
const openAudioInNewTab = () => {
  showGeneratedAudioModal.value = true;
};

// 添加关闭生成音频模态框的方法
const closeGeneratedAudioModal = () => {
  showGeneratedAudioModal.value = false;
};

const saveToHistory = (text: string, audio: string) => {
  const newItem = {
    text,
    audio,
    timestamp: Date.now(),
  };

  // 添加到历史记录开头（最新在最前）
  historyList.value.unshift(newItem);

  // 限制历史记录数量
  if (historyList.value.length > maxHistoryCount.value) {
    historyList.value.pop();
  }
};

const viewAudio = (audio: string) => {
  // 在新窗口中播放音频
  const audioWindow = window.open();
  if (audioWindow) {
    audioWindow.document.write(`
      <html>
        <head><title>音频播放</title></head>
        <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
          <audio controls autoplay style="max-width:100%;">
            <source src="${audio}" type="audio/mpeg">
            您的浏览器不支持音频播放。
          </audio>
        </body>
      </html>
    `);
  }
};

// 查看文本功能
const viewText = (text: string) => {
  alert("文本内容：\n\n" + text);
};

// 删除历史记录
const removeHistory = (index: number) => {
  historyList.value.splice(index, 1);
};

// 清空所有历史记录
const clearAllHistory = () => {
  historyList.value = [];
};

// 修改生成语音按钮的禁用条件
const canGenerateSpeech = computed(() => {
  return !isLoading.value && 
         !voicesLoading.value && 
         !voicesLoadError.value && 
         selectedVoice.value && 
         text.value.trim();
});

// 添加复制文本的方法
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    alert("文本已复制到剪贴板");
  } catch (err) {
    console.error('复制失败:', err);
    // 降级方案：使用传统的复制方法
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert("文本已复制到剪贴板");
  }
};
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div class="ai-text-to-speech">
        <!-- 使用响应式网格布局 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- 左侧：选项和输入 -->
          <div class="space-y-6">
            <div class="input-section">
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >文本内容</label
              >
              <textarea
                v-model="text"
                placeholder="输入要转换的文本..."
                class="w-full p-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 min-h-[150px]"
              ></textarea>

              <!-- 添加"换一个"按钮 -->
              <div class="mt-2 flex justify-end">
                <button
                  @click="randomPresetText"
                  class="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  换一个示例文本
                </button>
              </div>
            </div>

            <!-- 语音选择器 -->
            <div class="voice-selector">
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >选择语音</label
              >
              
              <!-- 语音加载中状态 -->
              <div v-if="voicesLoading" class="voice-loading">
                <div class="flex items-center justify-center p-4 border rounded-lg bg-gray-50">
                  <svg class="animate-spin h-5 w-5 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-sm text-gray-600">正在加载语音列表...</span>
                </div>
              </div>

              <!-- 语音加载失败状态 -->
              <div v-else-if="voicesLoadError" class="voice-error">
                <div class="border border-red-200 rounded-lg bg-red-50 p-4">
                  <div class="flex items-center mb-3">
                    <svg class="h-5 w-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-sm font-medium text-red-800">语音列表加载失败</span>
                  </div>
                  <p class="text-sm text-red-700 mb-3">无法获取可用的语音列表，请检查网络连接后重试。</p>
                  <button 
                    @click="fetchVoices"
                    class="flex items-center px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                  >
                    <svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                    重新加载语音列表
                  </button>
                </div>
              </div>

              <!-- 正常语音选择器 -->
              <select
                v-else
                v-model="selectedVoice"
                class="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>请选择语音</option>
                <option
                  v-for="voice in voices"
                  :key="voice.value"
                  :value="voice.value"
                >
                  {{ voice.label }}
                </option>
              </select>
            </div>

            <!-- 参数区域 -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >语速</label
                >
                <input
                  v-model.number="speed"
                  type="number"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  class="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >音调</label
                >
                <input
                  v-model.number="pitch"
                  type="number"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  class="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >音量</label
                >
                <input
                  v-model.number="volume"
                  type="number"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  class="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            <button
              @click="generateSpeech"
              :disabled="!canGenerateSpeech"
              :class="[
                'generate-btn py-3 px-6 rounded-lg shadow-md transition w-full flex items-center justify-center',
                !canGenerateSpeech
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white',
              ]"
            >
              <svg
                v-if="isLoading"
                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ isLoading ? "生成中..." : "生成语音" }}
            </button>
          </div>

          <!-- 右侧：生成结果 -->
          <div class="result-section">
            <div
              v-if="isLoading"
              class="loading flex flex-col items-center justify-center h-full"
            >
              <div class="spinner"></div>
              <p class="mt-4 text-lg">生成中...</p>
            </div>

            <div v-else-if="audioUrl" class="result h-full flex flex-col">
              <div class="mb-4">
                <h3 class="text-lg font-medium text-gray-700">生成结果</h3>
                <p class="text-sm text-gray-500">点击播放按钮试听音频</p>
              </div>
              <div class="flex-1 flex items-center justify-center">
                <div class="audio-player">
                  <audio
                    :src="audioUrl"
                    controls
                    class="w-full max-w-md"
                    @click="openAudioInNewTab"
                  ></audio>
                  <button
                    @click="openAudioInNewTab"
                    class="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    在新窗口播放
                  </button>
                </div>
              </div>
            </div>

            <div
              v-else
              class="placeholder flex flex-col items-center justify-center h-full text-center p-8"
            >
              <div
                class="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 mb-4 flex items-center justify-center"
              >
                <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-700 mb-2">
                等待生成语音
              </h3>
              <p class="text-gray-500">输入文本并点击"生成语音"按钮</p>
            </div>
          </div>
        </div>
      </div>
    </div>

   

   <!-- 新增：历史记录区域 -->
    <div class="history-section" v-if="historyList.length">
      <div class="history-header">
        <h3>历史记录</h3>
        <button @click="clearAllHistory" class="clear-btn">清空全部</button>
      </div>
      <div class="history-list">
        <div
          v-for="(item, index) in historyList"
          :key="index"
          class="history-item"
        >
          <audio
            :src="item.audio"
            controls
            class="w-full"
          ></audio>
          <div class="history-actions">
            <button @click="viewAudio(item.audio)">新窗口播放</button>
            <button @click="viewText(item.text)">查看文本</button>
            <button @click="copyText(item.text)">复制文本</button>
            <button @click="removeHistory(index)" class="delete-btn">
              删除
            </button>
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

    <!-- 生成音频大图查看模态框 -->
    <div
      v-if="showGeneratedAudioModal && audioUrl"
      class="generated-audio-modal"
      @click.self="closeGeneratedAudioModal"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="text-lg font-semibold text-gray-800">生成结果</h3>
          <button
            @click="closeGeneratedAudioModal"
            class="close-btn"
            title="关闭"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <audio
            :src="audioUrl"
            controls
            autoplay
            class="w-full"
          ></audio>
        </div>
        <div class="modal-footer">
          <button
            @click="closeGeneratedAudioModal"
            class="btn-secondary"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 可参考AiTextToImage的样式，或根据需要自定义 */
.ai-text-to-speech {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem;
}
.result-section {
  background-color: #f9fafb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}
.placeholder {
  color: #6b7280;
  border-radius: 0.5rem;
}
.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #4299e1;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.generate-btn {
  font-weight: 600;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.generate-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
.generate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.history-section {
  margin-top: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 15px;
}
.history-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: white;
  padding: 12px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}
.history-actions {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.history-actions button {
  padding: 6px 10px;
  font-size: 11px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  color: #495057;
}
.history-actions button:hover {
  background: #e9ecef;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.delete-btn {
  background: #fff5f5 !important;
  color: #dc2626 !important;
  border-color: #fecaca !important;
}
.delete-btn:hover {
  background: #fef2f2 !important;
  color: #b91c1c !important;
  border-color: #fca5a5 !important;
}
/* 生成音频模态框样式 */
.generated-audio-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: modalFadeIn 0.3s ease;
}
@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.modal-content {
  background: white;
  padding: 20px;
  border-radius: 12px;
  max-width: 90%;
  max-height: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: contentSlideIn 0.3s ease;
}
@keyframes contentSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e5e7eb;
}
.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  transition: all 0.2s ease;
}
.close-btn:hover {
  background: #f3f4f6;
  border-radius: 6px;
}
.modal-body {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.btn-secondary {
  padding: 10px 30px;
  background: #e5e7eb;
  color: #374151;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  text-align: center;
}
.btn-secondary:hover {
  background: #d1d5db;
  transform: translateY(-1px);
}
</style> 
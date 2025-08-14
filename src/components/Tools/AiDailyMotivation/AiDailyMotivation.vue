<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from "vue";
import axios from "axios";
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";

const info = reactive({
  title: "AI每日励志鸡汤文",
  desc: "AI智能生成每日励志鸡汤文，支持多种风格选择，定时刷新，为你的每一天注入正能量。",
});

const pollinationsApiKey = ref(import.meta.env.VITE_POLLINATIONS_API_KEY || "");
const pollinationsProxyUrl = ref(import.meta.env.VITE_POLLINATIONS_PROXY_URL);
const pollinationsTextUrl = ref(import.meta.env.VITE_POLLINATIONS_TEXT_URL);

// 状态管理
const loading = ref(false);
const refreshing = ref(false);
const autoRefresh = ref(true);
const refreshInterval = ref(1); // 默认1分钟
const selectedStyle = ref("励志");
const lastRefreshTime = ref<Date | null>(null);
const refreshTimer = ref<NodeJS.Timeout | null>(null);
const retryCount = ref(0); // 新增：重试次数

// 鸡汤文数据
const motivationList = ref<
  Array<{
    id: number;
    content: string;
    style: string;
    timestamp: Date;
  }>
>([]);

// 风格选项
const styleOptions = [
  { value: "励志", label: "励志", emoji: "⚡" },
  { value: "情感", label: "情感", emoji: "❤️" },
  { value: "成长", label: "成长", emoji: "⭐" },
  { value: "职场", label: "职场", emoji: "💼" },
  { value: "学习", label: "学习", emoji: "🎓" },
  { value: "生活", label: "生活", emoji: "🏠" },
  { value: "友情", label: "友情", emoji: "👫" },
  { value: "爱情", label: "爱情", emoji: "💝" },
];

// 刷新间隔选项
const intervalOptions = [
  { value: 1, label: "1分钟" },
  { value: 5, label: "5分钟" },
  { value: 10, label: "10分钟" },
];

// 生成鸡汤文
// 生成鸡汤文
// 生成鸡汤文
const generateMotivations = async () => {
  if (loading.value) return;

  loading.value = true;
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const prompt = `请生成5条${selectedStyle.value}风格的励志鸡汤文，要求：
1. 每条鸡汤文要简洁有力，字数控制在30-50字之间
2. 内容要积极向上，富有哲理和启发性
3. 风格要符合"${selectedStyle.value}"主题
4. 每条鸡汤文单独一行，不要编号，不要标点符号结尾
5. 只输出鸡汤文内容，不要其他解释文字`;

      const resp = await axios.get(
        `${pollinationsProxyUrl.value}?path=${encodeURIComponent(
          prompt
        )}&target=${pollinationsTextUrl.value}&params=_t=${Date.now()}`,
        { headers: { Authorization: "Bearer " + pollinationsApiKey.value } }
      );

      let text = typeof resp.data === "string" ? resp.data : String(resp.data);

      // 处理返回的文本，分割成多条鸡汤文
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.length <= 100)
        .slice(0, 5);

      // 验证生成的内容是否有效
      if (lines.length === 0 || lines.some((line) => line.length < 10)) {
        throw new Error("生成的内容无效或过短");
      }

      // 生成新的鸡汤文列表
      const newMotivations = lines.map((content, index) => ({
        id: Date.now() + index,
        content,
        style: selectedStyle.value,
        timestamp: new Date(),
      }));

      motivationList.value = newMotivations;
      lastRefreshTime.value = new Date();

      // 如果开启了自动刷新，设置定时器
      if (autoRefresh.value) {
        setupAutoRefresh();
      }

      // 成功生成，跳出重试循环
      break;
    } catch (error) {
      retryCount++;
      console.error(`第${retryCount}次生成鸡汤文失败:`, error);

      // 如果还有重试机会，等待2秒后重试
      if (retryCount < maxRetries) {
        // 显示重试状态
        console.log(`生成失败，2秒后进行第${retryCount + 1}次重试...`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待2秒
        continue;
      }

      // 所有重试都失败了，清空列表并显示错误状态
      console.log("所有重试都失败");
      motivationList.value = [];

      // 显示重试失败提示
      alert(`AI生成失败，已重试${maxRetries}次。请检查网络连接或稍后重试。`);
    }
  }

  loading.value = false;
};

// 手动刷新
const refreshMotivations = async () => {
  if (refreshing.value) return;
  refreshing.value = true;
  await generateMotivations();
  refreshing.value = false;
};

// 设置自动刷新
const setupAutoRefresh = () => {
  // 先清除之前的定时器
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
  
  // 只有在开启自动刷新时才设置新的定时器
  if (autoRefresh.value) {
    refreshTimer.value = setInterval(() => {
      generateMotivations();
    }, refreshInterval.value * 60 * 1000);
  }
};

// 切换自动刷新
const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value;
  if (autoRefresh.value) {
    setupAutoRefresh();
  } else {
    // 关闭自动刷新时，清除定时器
    if (refreshTimer.value) {
      clearInterval(refreshTimer.value);
      refreshTimer.value = null;
    }
  }
};

// 复制鸡汤文
const copyMotivation = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    // 可以添加一个临时的成功提示
    const element = document.createElement("div");
    element.textContent = "已复制";
    element.className =
      "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50";
    document.body.appendChild(element);
    setTimeout(() => {
      document.body.removeChild(element);
    }, 2000);
  } catch (error) {
    console.error("复制失败:", error);
  }
};

// 格式化时间
const formatTime = (date: Date) => {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// 格式化日期
const formatDate = (date: Date) => {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};


// 组件挂载时自动生成一次
onMounted(() => {
  generateMotivations();
});

// 组件卸载时清理定时器
onUnmounted(() => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
});

// 监听设置变化
const handleIntervalChange = () => {
  if (autoRefresh.value) {
    setupAutoRefresh();
  }
};

const handleStyleChange = () => {
  generateMotivations();
};
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <div class="p-6 rounded-2xl bg-white">
      <!-- 控制面板 -->
      <div
        class="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- 风格选择 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">鸡汤文风格</label>
            <select
              v-model="selectedStyle"
              @change="handleStyleChange"
              class="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option
                v-for="style in styleOptions"
                :key="style.value"
                :value="style.value"
              >
                {{ style.emoji }} {{ style.label }}
              </option>
            </select>
          </div>

          <!-- 刷新间隔 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700"
              >自动刷新间隔</label
            >
            <select
              v-model="refreshInterval"
              @change="handleIntervalChange"
              :disabled="!autoRefresh"
              class="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option
                v-for="interval in intervalOptions"
                :key="interval.value"
                :value="interval.value"
              >
                {{ interval.label }}
              </option>
            </select>
          </div>

          <!-- 自动刷新开关 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">自动刷新</label>
            <div class="flex items-center">
              <button
                @click="toggleAutoRefresh"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  autoRefresh ? 'bg-blue-600' : 'bg-gray-200',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    autoRefresh ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
              <span class="ml-2 text-sm text-gray-600">
                {{ autoRefresh ? "开启" : "关闭" }}
              </span>
            </div>
          </div>

          <!-- 手动刷新按钮 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">操作</label>
            <button
              @click="refreshMotivations"
              :disabled="refreshing || loading"
              class="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="refreshing" class="flex items-center justify-center">
                <div
                  class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                ></div>
                刷新中...
              </span>
              <span v-else>立即刷新</span>
            </button>
          </div>
        </div>

        <!-- 状态信息 -->
        <div
          class="mt-4 flex items-center justify-between text-sm text-gray-600"
        >
          <div class="flex items-center space-x-4">
            <span
              >状态:
              {{
                loading ? "生成中..." : refreshing ? "刷新中..." : "就绪"
              }}</span
            >
            <span v-if="lastRefreshTime">
              上次刷新: {{ formatDate(lastRefreshTime) }}
              {{ formatTime(lastRefreshTime) }}
            </span>
          </div>
          <div class="flex items-center space-x-2">
            <span>当前风格: {{ selectedStyle }}</span>
            <span>刷新间隔: {{ refreshInterval }}分钟</span>
          </div>
        </div>
      </div>

      <!-- 鸡汤文展示区域 -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-800">
            {{ selectedStyle }}鸡汤文 ({{ motivationList.length }}条)
          </h3>
          <div class="text-sm text-gray-500">
            {{
              autoRefresh ? `每${refreshInterval}分钟自动刷新` : "手动刷新模式"
            }}
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="text-center py-12">
          <div class="inline-flex items-center space-x-2">
            <div class="loading-spinner-large"></div>
            <span class="text-lg text-gray-600">
              {{
                retryCount > 0
                  ? `AI生成失败，正在进行第${retryCount + 1}次重试...`
                  : "AI正在生成鸡汤文中..."
              }}
            </span>
          </div>
          <div v-if="retryCount > 0" class="mt-2 text-sm text-orange-600">
            重试次数: {{ retryCount }}/3
          </div>
        </div>

        <!-- 鸡汤文列表 -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="motivation in motivationList"
            :key="motivation.id"
            class="group relative p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <!-- 风格标签 -->
            <div class="absolute top-3 right-3">
              <span
                class="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full"
              >
                {{ motivation.style }}
              </span>
            </div>

            <!-- 鸡汤文内容 -->
            <div class="mb-4 pr-16">
              <p class="text-lg text-gray-800 leading-relaxed font-medium">
                "{{ motivation.content }}"
              </p>
            </div>

            <!-- 底部信息 -->
            <div class="flex items-center justify-end text-sm text-gray-500">
              <button
                @click="copyMotivation(motivation.content)"
                class="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-md"
              >
                复制
              </button>
            </div>

            <!-- 装饰元素 -->
            <div
              class="absolute -top-2 -left-2 w-4 h-4 bg-yellow-400 rounded-full opacity-20"
            ></div>
            <div
              class="absolute -bottom-2 -right-2 w-6 h-6 bg-orange-300 rounded-full opacity-20"
            ></div>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="!loading && motivationList.length === 0"
          class="text-center py-12"
        >
          <div class="text-gray-400">
            <div class="text-6xl mb-4">☕</div>
            <div class="text-lg">暂无鸡汤文</div>
            <div class="text-sm">点击刷新按钮生成新的鸡汤文</div>
          </div>
        </div>
      </div>

      <!-- 使用说明 -->
      <div class="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 class="font-medium text-gray-800 mb-2">💡 使用说明</h4>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>• 选择你喜欢的鸡汤文风格，AI会自动生成5条相关内容</li>
          <li>• 开启自动刷新后，系统会定时生成新的鸡汤文</li>
          <li>• 每条鸡汤文都可以单独复制，方便分享给朋友</li>
          <li>
            • 支持多种风格：励志、情感、成长、职场、学习、生活、友情、爱情
          </li>
        </ul>
      </div>
    </div>

    <ToolDetail title="描述">
      <el-text>{{ info.desc }}</el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 自定义loading动画 */
.loading-spinner-large {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-pulse {
  position: absolute;
  inset: 0;
  width: 24px;
  height: 24px;
  border: 4px solid transparent;
  border-top: 4px solid #60a5fa;
  border-radius: 50%;
  animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.progress-bar {
  height: 8px;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
  border-radius: 9999px;
  animation: progress 2s ease-in-out infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes ping {
  75%,
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

@keyframes progress {
  0%,
  100% {
    width: 0%;
  }
  50% {
    width: 100%;
  }
}

/* 确保动画在Safari等浏览器中正常工作 */
.loading-spinner-large,
.loading-spinner-small {
  -webkit-animation: spin 1s linear infinite;
  -moz-animation: spin 1s linear infinite;
  -o-animation: spin 1s linear infinite;
  animation: spin 1s linear infinite;
}

/* 添加一些额外的loading效果 */
.loading-spinner-large::after {
  content: "";
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border: 3px solid transparent;
  border-top: 3px solid #dbeafe;
  border-radius: 50%;
  animation: spin 1.5s linear infinite reverse;
}
</style>

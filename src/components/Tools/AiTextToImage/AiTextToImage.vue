<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import axios from "axios";

import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import ToolDetail from "@/components/Layout/ToolDetail/ToolDetail.vue";
const pollinationsApiKey = ref(import.meta.env.VITE_POLLINATIONS_API_KEY || "");
const maxHistoryCount = ref(Number(import.meta.env.VITE_AI_IMAGE_HISTORY_MAX) || 20);

const info = reactive({
  title: "在线文生图",
  desc: "免费无限次数生成图片，无需登录注册、直接使用，如果生成出错或者生成的内容和提示词不一致，请重试，或者重新进一下页面",
  maxSeed: 100000000,
  // apiUrl: "https://proxy-pollinations.2424004764.workers.dev",
  apiUrl: "https://tool.fologde.com/proxy",
  pollinationsApi: "https://image.pollinations.ai",
  // 预设提示词列表
  presetPrompts: [
    "一个神秘瑰丽的微观世界：花粉颗粒的精细结构、覆盖露珠的微小植物、发光孢子、漂浮的细菌和微粒，呈现出超现实的生物荧光效果。采用微距摄影风格，焦点清晰，背景虚化，整体色彩鲜艳，画面极具科幻与自然美感。",
    "未来城市夜景：高耸入云的摩天大楼，霓虹灯光闪烁，飞行汽车穿梭其中，雨水反射着五彩斑斓的光线，赛博朋克风格，细节丰富，4K高清",
    "宁静的森林湖泊：清晨薄雾笼罩，湖面如镜，倒映着周围的红叶树木，远处山脉隐约可见，阳光穿透云层形成光束，超写实风格",
    "奇幻海底世界：发光的珊瑚礁，色彩斑斓的热带鱼群，巨大的鲸鱼缓缓游过，阳光从水面折射下来，形成神秘的光影效果，梦幻风格",
    "中世纪城堡：矗立在悬崖之上，周围是茂密的森林和蜿蜒的河流，天空中有飞龙盘旋，夕阳西下，金色光芒洒满大地，史诗级场景",
    "机械武士：未来科技感十足的机械武士，金属质感强烈，细节丰富，站在废墟城市中，手持发光能量剑，赛博朋克风格",
    "星空下的沙漠：银河清晰可见，沙丘起伏，一棵孤独的仙人掌在月光下投下长长的影子，极简主义风格，深邃而宁静",
    "蒸汽朋克飞艇：维多利亚时代风格的巨大飞艇，复杂的齿轮和管道结构，在云层中航行，下方是工业革命时期的城市景观",
    "未来农场：垂直农场中生长的发光植物，机器人正在收获作物，玻璃穹顶外是荒芜的沙漠景观，科幻与自然结合",
    "魔法森林：发光的蘑菇，会说话的树木，漂浮的精灵，月光下的小径通向神秘的树屋，童话风格",
    "数字宇宙：由代码和数字组成的宇宙景观，行星是巨大的电路板，星云是流动的数据流，科技艺术风格",
    "火山爆发：炽热的熔岩从火山口喷涌而出，照亮夜空，火山灰形成的云层中闪电交织，自然力量的壮观展现",
    "未来医疗舱：透明医疗舱中悬浮的病人，全息界面显示生命体征，纳米机器人在体内工作，高科技医疗场景",
    "古埃及神庙：巨大的石柱上刻满象形文字，阳光从顶部开口射入，照亮中央的黄金神像，神秘而庄严",
    "机器人画家：在画布前工作的机器人艺术家，机械臂精准地涂抹颜料，创作出令人惊叹的抽象艺术作品",
    "雨林瀑布：热带雨林中的巨大瀑布，水流从百米高处倾泻而下，彩虹横跨水面，周围是茂密的植被和奇花异草",
    "未来竞技场：全息投影覆盖的圆形竞技场，机甲战士正在进行激烈战斗，观众席上坐满各种外星种族",
    "水晶洞穴：地下深处的水晶洞穴，巨大的水晶柱发出柔和的光芒，地下湖倒映着奇幻景象，神秘而美丽",
    "太空站：环绕地球的巨型空间站，透过舷窗可以看到蓝色的地球和漆黑的宇宙，内部是高科技生活区",
    "沙漠绿洲：炎热沙漠中的一片绿洲，棕榈树环绕着清澈的池塘，骆驼在树荫下休息，远处沙丘连绵",
    "未来图书馆：悬浮的书本，全息投影的信息流，机器人图书管理员，玻璃穹顶外是星空，知识圣殿",
    "极光冰原：北极冰原上空的绿色极光舞动，冰面上倒映着光芒，远处有北极熊的身影，寒冷而美丽",
    "蒸汽朋克城市：齿轮驱动的建筑，蒸汽管道纵横交错，穿着维多利亚服饰的人们行走在石板街上",
    "未来厨房：全自动烹饪设备，3D食物打印机，悬浮的食材和厨具，机器人厨师准备美食",
    "恐龙世界：白垩纪的丛林，巨大的腕龙在吃树叶，天空中有翼龙飞翔，远处火山冒烟",
    "未来交通枢纽：多层立体交通网络，悬浮列车、飞行汽车和磁悬浮管道交织，全息指示牌闪烁",
    "水下实验室：深海中的透明穹顶实验室，科学家研究发光海洋生物，窗外是黑暗的深海景象",
    "未来战争：城市废墟中的机甲战斗，激光武器交火，爆炸产生的火光和烟雾，紧张激烈的战场",
    "禅意花园：日式枯山水庭院，精心修剪的松树，石灯笼，小桥流水，宁静而和谐",
    "外星丛林：紫色植被覆盖的异星世界，发光的植物，奇特的生物，双月当空的夜空",
    "未来时尚秀：全息投影的T台，模特穿着发光服装，材料随音乐变化颜色，前卫时尚",
    "古罗马斗兽场：满座的观众席，角斗士与猛兽搏斗，沙地上血迹斑斑，历史场景重现",
    "机器人动物园：机械动物在自然环境中活动，电子狮子、机械大象，未来与自然融合",
    "云中城市：建在巨大浮云上的城市，空中桥梁连接建筑，下方是遥远的地面",
    "未来农场：自动化温室中生长的发光植物，无人机照料作物，高效农业生产",
    "魔法图书馆：漂浮的书本，自动书写的羽毛笔，会说话的画像，古老魔法的氛围",
    "未来音乐厅：全息投影的乐器自动演奏，声波可视化效果，观众沉浸在多维音乐体验中",
    "沙漠古城：风沙侵蚀的古代遗迹，残破的石柱和雕像，讲述失落的文明",
    "深海热泉：海底火山口附近的生态系统，奇特的管状蠕虫和盲虾，热液喷口冒着黑烟",
    "未来健身房：全息教练指导训练，智能器材根据体能调整，虚拟现实运动场景",
    "空中花园：悬浮在空中的花园岛屿，瀑布从边缘流下，奇花异草争奇斗艳",
    "未来教室：全息投影教学，学生通过VR眼镜学习，机器人助教辅导，互动式教育",
    "火山行星：熔岩流淌的异星地表，巨大的火山不断喷发，天空是暗红色，外星探险",
    "蒸汽朋克潜水艇：黄铜和齿轮构成的潜水艇，在深海探索沉船和神秘生物",
    "未来医院：纳米机器人治疗，全息诊断界面，基因编辑技术，高科技医疗环境",
    "森林精灵：半透明翅膀的精灵在月光下的森林中飞舞，发光的小生物环绕四周",
    "未来农场：垂直农场中机器人照料作物，LED灯光模拟日照，高效无土栽培",
    "古中国宫殿：红墙金瓦的宫殿建筑群，龙纹雕刻，庭院中的荷花池，传统中国风",
    "外星沙漠：紫色沙丘，水晶结构，三颗太阳的天空，奇特的外星生物",
    "未来城市公园：高楼大厦间的绿洲，悬浮花园，全息蝴蝶飞舞，自然与科技融合",
    "海底城市：透明穹顶保护的水下城市，街道上有潜水艇穿梭，窗外是珊瑚礁和鱼群",
  ],
});

const prompt = ref(info.presetPrompts[0]); // 使用第一个预设提示词作为默认值
const imageUrl = ref("");
const isLoading = ref(false);

// 模型列表
const models = ref<{ value: string; label: string }[]>([]);
const selectedModel = ref("");

// 参数
const width = ref(1024);
const height = ref(1024);
const noLogo = ref(true);
const seed = ref(-1);

// 历史记录
const historyList = ref<{ prompt: string; image: string; timestamp: number }[]>(
  []
);
const viewingImage = ref(""); // 当前查看的大图
const viewingPrompt = ref(""); // 当前查看的提示词

// 添加新的响应式变量
const showGeneratedImageModal = ref(false);
const modelsLoading = ref(false); // 新增：模型加载状态
const modelsLoadError = ref(false); // 新增：模型加载错误状态

// 获取可用模型
const fetchModels = async () => {
  modelsLoading.value = true;
  modelsLoadError.value = false;
  
  try {
    const response = await axios.get(
      `${info.apiUrl}?path=models&target=${info.pollinationsApi}`
    );
    const modelNames = response.data;

    models.value = modelNames.map((name) => ({
      value: name,
      label: name.charAt(0).toUpperCase() + name.slice(1),
    }));

    if (models.value.length > 0) {
      selectedModel.value = models.value[0].value;
    }
  } catch (error) {
    console.error("获取模型失败:", error);
    modelsLoadError.value = true;
    models.value = []; // 失败时不设置默认模型
    selectedModel.value = ""; // 清空选中的模型
  } finally {
    modelsLoading.value = false;
  }
};

onMounted(() => {
  fetchModels();
});

// 生成随机种子
const generateRandomSeed = () => {
  seed.value = Math.floor(Math.random() * info.maxSeed);
};

// 随机选择预设提示词
const randomPresetPrompt = () => {
  const randomIndex = Math.floor(Math.random() * info.presetPrompts.length);
  prompt.value = info.presetPrompts[randomIndex];
};

const generateImage = async () => {
  if (!prompt.value.trim() || !selectedModel.value) return;

  isLoading.value = true;
  imageUrl.value = "";

  try {
    // 如果 seed 为 -1，生成一个随机种子
    const actualSeed =
      seed.value === -1 ? Math.floor(Math.random() * info.maxSeed) : seed.value;

    // 构造查询参数
    const params = {
      model: selectedModel.value,
      width: width.value,
      height: height.value,
      nologo: noLogo.value ? "true" : undefined,
      seed: actualSeed.toString(),
    };

    // 移除未定义的参数并确保所有值都是字符串
    const filteredParams = Object.fromEntries(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]) // 确保所有值都是字符串
    );

    // 添加时间戳避免缓存
    filteredParams._t = String(Date.now());

    // 将 filteredParams 转成 GET 参数拼接
    const queryString = new URLSearchParams(filteredParams).toString();
    const response = await axios.get(
      `${info.apiUrl}?path=prompt/${encodeURIComponent(prompt.value)}&target=${info.pollinationsApi}&params=${queryString}`,
      {
        headers: {
          Authorization: "Bearer " + pollinationsApiKey.value,
        },
        responseType: "blob",
      }
    );

    const blob = new Blob([response.data], { type: "image/png" });
    imageUrl.value = URL.createObjectURL(blob);

    // 保存到历史记录
    saveToHistory(prompt.value, imageUrl.value);
  } catch (error) {
    console.error("生成失败:", error);
    alert("图像生成失败，请稍后重试");
  } finally {
    isLoading.value = false;
  }
};

// 修改打开图像的方法
const openImageInNewTab = () => {
  showGeneratedImageModal.value = true;
};

// 添加关闭生成图片模态框的方法
const closeGeneratedImageModal = () => {
  showGeneratedImageModal.value = false;
};

const saveToHistory = (prompt: string, image: string) => {
  const newItem = {
    prompt,
    image,
    timestamp: Date.now(),
  };

  // 添加到历史记录开头（最新在最前）
  historyList.value.unshift(newItem);

  // 限制历史记录数量
  if (historyList.value.length > maxHistoryCount.value) {
    historyList.value.pop();
  }
};

const viewImage = (image: string) => {
  viewingImage.value = image;
};

// 查看提示词功能
const viewPrompt = (prompt: string) => {
  viewingPrompt.value = prompt;
};

// 删除历史记录
const removeHistory = (index: number) => {
  historyList.value.splice(index, 1);
};

// 清空所有历史记录
const clearAllHistory = () => {
  historyList.value = [];
};

// 修改生成图像按钮的禁用条件
const canGenerateImage = computed(() => {
  return !isLoading.value && 
         !modelsLoading.value && 
         !modelsLoadError.value && 
         selectedModel.value && 
         prompt.value.trim();
});

// 添加复制提示词的方法
const copyPrompt = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    // 可以添加一个简单的提示，比如临时改变按钮文字
    const copyBtn = document.querySelector('.copy-prompt-btn') as HTMLButtonElement;
    if (copyBtn) {
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '已复制!';
      copyBtn.style.background = '#10b981';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.background = '#3b82f6';
      }, 2000);
    }
  } catch (err) {
    console.error('复制失败:', err);
    // 降级方案：使用传统的复制方法
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
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
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >提示词</label
              >
              <textarea
                v-model="prompt"
                placeholder="输入描述文字..."
                class="w-full p-4 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 min-h-[150px]"
              ></textarea>

              <!-- 添加"换一个"按钮 -->
              <div class="mt-2 flex justify-end">
                <button
                  @click="randomPresetPrompt"
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
                  换一个提示词
                </button>
              </div>

              <!-- 提示词网站链接 -->
              <div class="mt-3 flex flex-wrap gap-2">
                <span class="text-xs text-gray-500 mr-2">提示词灵感：</span>
                <a
                  href="https://prompthero.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                >
                  <svg
                    class="w-3 h-3 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
                    />
                    <path
                      d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
                    />
                  </svg>
                  PromptHero
                </a>
                <a
                  href="https://lexica.art"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 transition-colors"
                >
                  <svg
                    class="w-3 h-3 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
                    />
                    <path
                      d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
                    />
                  </svg>
                  Lexica
                </a>
              </div>
            </div>

            <!-- 模型选择器 -->
            <div class="model-selector">
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >选择模型</label
              >
              
              <!-- 模型加载中状态 -->
              <div v-if="modelsLoading" class="model-loading">
                <div class="flex items-center justify-center p-4 border rounded-lg bg-gray-50">
                  <svg class="animate-spin h-5 w-5 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-sm text-gray-600">正在加载模型列表...</span>
                </div>
              </div>

              <!-- 模型加载失败状态 -->
              <div v-else-if="modelsLoadError" class="model-error">
                <div class="border border-red-200 rounded-lg bg-red-50 p-4">
                  <div class="flex items-center mb-3">
                    <svg class="h-5 w-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-sm font-medium text-red-800">模型列表加载失败</span>
                  </div>
                  <p class="text-sm text-red-700 mb-3">无法获取可用的模型列表，请检查网络连接后重试。</p>
                  <button 
                    @click="fetchModels"
                    class="flex items-center px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                  >
                    <svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                    重新加载模型列表
                  </button>
                </div>
              </div>

              <!-- 正常模型选择器 -->
              <select
                v-else
                v-model="selectedModel"
                class="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>请选择模型</option>
                <option
                  v-for="model in models"
                  :key="model.value"
                  :value="model.value"
                >
                  {{ model.label }}
                </option>
              </select>
            </div>

            <!-- 参数区域 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >宽度 (px)</label
                >
                <input
                  v-model.number="width"
                  type="number"
                  min="64"
                  max="4096"
                  class="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >高度 (px)</label
                >
                <input
                  v-model.number="height"
                  type="number"
                  min="64"
                  max="4096"
                  class="w-full p-2 border rounded-lg"
                />
              </div>

              <!-- 随机种子区域 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >随机种子</label
                >
                <div class="flex">
                  <input
                    v-model.number="seed"
                    type="number"
                    min="-1"
                    class="flex-1 p-2 border rounded-l-lg"
                    placeholder="-1 表示随机"
                  />
                  <button
                    @click="generateRandomSeed"
                    class="bg-gray-200 hover:bg-gray-300 px-3 rounded-r-lg border-t border-r border-b"
                    title="生成随机种子"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                        clip-rule="evenodd"
                      />
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
                  />
                  <label for="noLogo" class="text-sm font-medium text-gray-700"
                    >不显示水印</label
                  >
                </div>
              </div>
            </div>

            <button
              @click="generateImage"
              :disabled="!canGenerateImage"
              :class="[
                'generate-btn py-3 px-6 rounded-lg shadow-md transition w-full flex items-center justify-center',
                !canGenerateImage
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
              {{ isLoading ? "生成中..." : "生成图像" }}
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

            <div v-else-if="imageUrl" class="result h-full flex flex-col">
              <div class="mb-4">
                <h3 class="text-lg font-medium text-gray-700">生成结果</h3>
                <p class="text-sm text-gray-500">点击图像可查看大图</p>
              </div>
              <div class="flex-1 flex items-center justify-center">
                <img
                  :src="imageUrl"
                  alt="生成的图像"
                  class="rounded-lg shadow-lg max-w-full max-h-[70vh] object-contain cursor-pointer hover:scale-105 transition-transform"
                  @click="openImageInNewTab"
                />
              </div>
            </div>

            <div
              v-else
              class="placeholder flex flex-col items-center justify-center h-full text-center p-8"
            >
              <div
                class="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 mb-4"
              ></div>
              <h3 class="text-lg font-medium text-gray-700 mb-2">
                等待生成图像
              </h3>
              <p class="text-gray-500">输入提示词并点击"生成图像"按钮</p>
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
          <img
            :src="item.image"
            alt="历史图片"
            class="thumbnail"
            @click="viewImage(item.image)"
          />
          <div class="history-actions">
            <button @click="viewImage(item.image)">查看大图</button>
            <button @click="viewPrompt(item.prompt)">查看提示词</button>
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

    <!-- 大图查看模态框 -->
    <div
      v-if="viewingImage"
      class="image-modal"
      @click.self="viewingImage = ''"
    >
      <div class="modal-content">
        <img :src="viewingImage" alt="大图预览" />
        <button @click="viewingImage = ''">关闭</button>
      </div>
    </div>

    <!-- 提示词查看模态框 -->
    <div
      v-if="viewingPrompt"
      class="prompt-modal"
      @click.self="viewingPrompt = ''"
    >
      <div class="modal-content">
        <div class="prompt-header">
          <h3>提示词内容</h3>
        </div>
        <div class="prompt-content">{{ viewingPrompt }}</div>
        <div class="prompt-footer">
          <button @click="viewingPrompt = ''" class="btn-secondary">关闭</button>
          <button 
            @click="copyPrompt(viewingPrompt)"
            class="copy-prompt-btn"
            title="复制提示词"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            复制
          </button>
        </div>
      </div>
    </div>

    <!-- 生成图片大图查看模态框 -->
    <div
      v-if="showGeneratedImageModal && imageUrl"
      class="generated-image-modal"
      @click.self="closeGeneratedImageModal"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="text-lg font-semibold text-gray-800">生成结果</h3>
          <button
            @click="closeGeneratedImageModal"
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
          <img
            :src="imageUrl"
            alt="生成的图像"
            class="generated-image"
          />
        </div>
        <div class="modal-footer">
          <button
            @click="closeGeneratedImageModal"
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
  to {
    transform: rotate(360deg);
  }
}

/* 输入框样式 */
input[type="number"],
input[type="text"],
textarea,
select {
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
  position: relative;
  overflow: hidden;
}

.generate-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.generate-btn:not(:disabled):active {
  transform: translateY(0);
}

.generate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.generate-btn:disabled:hover {
  transform: none !important;
  box-shadow: none !important;
}

/* 加载动画 */
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

/* 新增历史记录样式 */
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

.history-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.clear-btn {
  padding: 6px 12px;
  background: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-btn:hover {
  background: #ff7875;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.3);
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.history-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.1),
    rgba(147, 51, 234, 0.1)
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.history-item:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.history-item:hover::before {
  opacity: 1;
}

.thumbnail {
  width: 90px;
  height: 90px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.thumbnail:hover {
  transform: scale(1.05);
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 调整历史记录操作按钮的样式 */
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

.history-actions button:active {
  transform: translateY(0);
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

/* 大图模态框样式 */
.image-modal {
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

.modal-content img {
  max-width: 100%;
  max-height: 80vh;
  display: block;
  margin-bottom: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.modal-content button {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-content button:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

/* 提示词模态框样式 */
.prompt-modal {
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

/* 提示词模态框样式更新 */
.prompt-modal .modal-content {
  background: white;
  padding: 24px;
  border-radius: 12px;
  max-width: 80%;
  max-height: 80%;
  width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: contentSlideIn 0.3s ease;
  display: flex;
  flex-direction: column;
}

.prompt-header {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.prompt-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 18px;
  font-weight: 600;
}

.prompt-content {
  flex-grow: 1;
  margin-bottom: 16px;
  padding: 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  line-height: 1.6;
  color: #374151;
  font-size: 14px;
}

.prompt-content::-webkit-scrollbar {
  width: 6px;
}

.prompt-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.prompt-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.prompt-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.prompt-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.copy-prompt-btn {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.copy-prompt-btn:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.copy-prompt-btn:active {
  transform: translateY(0);
}

.btn-secondary {
  padding: 10px 20px;
  background: #e5e7eb;
  color: #374151;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #d1d5db;
  transform: translateY(-1px);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .history-list {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }

  .thumbnail {
    width: 70px;
    height: 70px;
  }

  .history-actions button {
    font-size: 10px;
    padding: 4px 8px;
  }
}

@media (max-width: 480px) {
  .history-list {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
  }

  .thumbnail {
    width: 60px;
    height: 60px;
  }

  .history-item {
    padding: 8px;
  }
}

/* 新增生成图片模态框样式 */
.generated-image-modal {
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

.generated-image-modal .modal-content {
  background: white;
  padding: 24px;
  border-radius: 12px;
  max-width: 90%;
  max-height: 90%;
  width: 600px; /* Adjust as needed */
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: contentSlideIn 0.3s ease;
  display: flex;
  flex-direction: column;
}

.generated-image-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e5e7eb;
}

.generated-image-modal .modal-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 20px;
  font-weight: 700;
}

.generated-image-modal .close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  transition: all 0.2s ease;
}

.generated-image-modal .close-btn:hover {
  background: #f3f4f6;
  border-radius: 6px;
}

.generated-image-modal .modal-body {
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

.generated-image-modal .generated-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.generated-image-modal .modal-footer {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding-top: 15px;
  border-top: 1px solid #e5e7eb;
}

.generated-image-modal .btn-secondary {
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

.generated-image-modal .btn-secondary:hover {
  background: #d1d5db;
  transform: translateY(-1px);
}

.generated-image-modal .btn-primary {
  flex: 1;
  padding: 10px 15px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  text-align: center;
}

.generated-image-modal .btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
}
</style>
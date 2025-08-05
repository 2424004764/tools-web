<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import QRCodeVue3 from "qrcode-vue3";
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage, type UploadFile } from "element-plus";
import { v4 as uuidv4 } from "uuid";
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const info = reactive({
  title: "二维码生成",
  content: "hello world",
  width: 200,
  height: 200,
  size: "200",
  fileList: <string[]>[],
  fileUrl: "",
  preColor: "#6A1A4C",
  bgColor: "#ffffff",
  qrKey: 1,
  errorCorrectionLevel: "H",
  dotType: "dots", // 默认使用圆角样式
  cornerSquareType: "square",
  cornerDotType: "square",
  // 颜色模式：'single' 或 'gradient'
  colorMode: "gradient",
  // 渐变色设置
  gradientType: "radial",
  gradientRotation: 0,
  gradientColor1: "#FF8C00",
  gradientColor2: "#1E90FF",
  // 角落方块设置
  cornerSquareColorMode: "single",
  cornerSquareColor: "#000000",
  cornerSquareGradientType: "linear",
  cornerSquareGradientRotation: 0,
  cornerSquareGradientColor1: "#FF0000",
  cornerSquareGradientColor2: "#00FF00",
  // 角落点设置
  cornerDotColorMode: "single",
  cornerDotColor: "#000000",
  cornerDotGradientType: "linear",
  cornerDotGradientRotation: 0,
  cornerDotGradientColor1: "#FF0000",
  cornerDotGradientColor2: "#00FF00",
  // 新增：配置模式
  configMode: "preset", // "preset" 或 "custom"
  // 新增：预设配置，默认选择 "default"
  presetConfig: "default",
});

// 预设配置定义
const presetConfigs = {
  default: {
    name: "默认配置",
    description: "当前默认的渐变配置",
    dotType: "dots", // 当前实际使用的点样式
    cornerSquareType: "square",
    cornerDotType: "square",
    colorMode: "gradient",
    gradientType: "radial",
    gradientRotation: 0,
    gradientColor1: "#FF8C00", // 确保和当前实际颜色一致
    gradientColor2: "#1E90FF",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#000000",
    cornerDotColorMode: "single",
    cornerDotColor: "#000000",
  },
  classic: {
    name: "经典黑",
    description: "经典黑白配色，简约大方",
    dotType: "square",
    cornerSquareType: "square",
    cornerDotType: "square",
    colorMode: "single",
    preColor: "#000000",
    bgColor: "#ffffff",
    cornerSquareColor: "#000000",
    cornerDotColor: "#000000",
  },
  modern: {
    name: "现代蓝",
    description: "现代蓝色渐变，科技感十足",
    dotType: "rounded",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 45,
    gradientColor1: "#667eea",
    gradientColor2: "#764ba2",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#667eea",
    cornerDotColorMode: "single",
    cornerDotColor: "#667eea",
  },
  warm: {
    name: "温暖橙",
    description: "温暖橙色系，活力满满",
    dotType: "dots",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "radial",
    gradientRotation: 0,
    gradientColor1: "#ff9a9e",
    gradientColor2: "#fecfef",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#ff9a9e",
    cornerDotColorMode: "single",
    cornerDotColor: "#ff9a9e",
  },
  elegant: {
    name: "优雅紫",
    description: "优雅紫色渐变，高贵典雅",
    dotType: "classy",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 135,
    gradientColor1: "#a8edea",
    gradientColor2: "#fed6e3",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#a8edea",
    cornerDotColorMode: "single",
    cornerDotColor: "#a8edea",
  },
  tech: {
    name: "科技绿",
    description: "科技绿色系，未来感十足",
    dotType: "rounded",
    cornerSquareType: "square",
    cornerDotType: "square",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 90,
    gradientColor1: "#00d4aa",
    gradientColor2: "#0099cc",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#00d4aa",
    cornerDotColorMode: "single",
    cornerDotColor: "#00d4aa",
  },
  sunset: {
    name: "日落红",
    description: "温暖日落色调，浪漫温馨",
    dotType: "dots",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 45,
    gradientColor1: "#ff6b6b",
    gradientColor2: "#ffa726",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#ff6b6b",
    cornerDotColorMode: "single",
    cornerDotColor: "#ff6b6b",
  },
  ocean: {
    name: "海洋蓝",
    description: "深邃海洋蓝，宁静致远",
    dotType: "rounded",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 180,
    gradientColor1: "#4facfe",
    gradientColor2: "#00f2fe",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#4facfe",
    cornerDotColorMode: "single",
    cornerDotColor: "#4facfe",
  },
  forest: {
    name: "森林绿",
    description: "自然森林绿，生机勃勃",
    dotType: "classy",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "radial",
    gradientRotation: 0,
    gradientColor1: "#56ab2f",
    gradientColor2: "#a8e6cf",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#56ab2f",
    cornerDotColorMode: "single",
    cornerDotColor: "#56ab2f",
  },
  gold: {
    name: "金色奢华",
    description: "金色渐变，奢华高贵",
    dotType: "classy",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 45,
    gradientColor1: "#ffd700",
    gradientColor2: "#ffb347",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#ffd700",
    cornerDotColorMode: "single",
    cornerDotColor: "#ffd700",
  },
  neon: {
    name: "霓虹紫",
    description: "霓虹紫色，炫酷时尚",
    dotType: "dots",
    cornerSquareType: "square",
    cornerDotType: "square",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 90,
    gradientColor1: "#ff00ff",
    gradientColor2: "#00ffff",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#ff00ff",
    cornerDotColorMode: "single",
    cornerDotColor: "#ff00ff",
  },
  vintage: {
    name: "复古棕",
    description: "复古棕色系，怀旧经典",
    dotType: "classy",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "single",
    preColor: "#8b4513",
    bgColor: "#f5f5dc",
    cornerSquareColor: "#8b4513",
    cornerDotColor: "#8b4513",
  },
  pastel: {
    name: "粉彩梦",
    description: "柔和粉彩色，温柔甜美",
    dotType: "rounded",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 135,
    gradientColor1: "#ffb3ba",
    gradientColor2: "#baffc9",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#ffb3ba",
    cornerDotColorMode: "single",
    cornerDotColor: "#ffb3ba",
  },
  cyber: {
    name: "赛博朋克",
    description: "赛博朋克风格，未来科技",
    dotType: "square",
    cornerSquareType: "square",
    cornerDotType: "square",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 45,
    gradientColor1: "#00ff00",
    gradientColor2: "#ff00ff",
    bgColor: "#000000",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#00ff00",
    cornerDotColorMode: "single",
    cornerDotColor: "#00ff00",
  },
  minimal: {
    name: "极简白",
    description: "极简白色系，干净清爽",
    dotType: "rounded",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "single",
    preColor: "#666666",
    bgColor: "#ffffff",
    cornerSquareColor: "#666666",
    cornerDotColor: "#666666",
  },
  fire: {
    name: "火焰红",
    description: "炽热火焰红，激情四射",
    dotType: "dots",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 45,
    gradientColor1: "#ff4500",
    gradientColor2: "#ff6347",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#ff4500",
    cornerDotColorMode: "single",
    cornerDotColor: "#ff4500",
  },
  ice: {
    name: "冰雪蓝",
    description: "清凉冰雪蓝，纯净透明",
    dotType: "rounded",
    cornerSquareType: "extra-rounded",
    cornerDotType: "dot",
    colorMode: "gradient",
    gradientType: "linear",
    gradientRotation: 180,
    gradientColor1: "#87ceeb",
    gradientColor2: "#b0e0e6",
    bgColor: "#ffffff",
    cornerSquareColorMode: "single",
    cornerSquareColor: "#87ceeb",
    cornerDotColorMode: "single",
    cornerDotColor: "#87ceeb",
  }
};

// 应用预设配置
const applyPreset = (presetKey: string) => {
  const preset = presetConfigs[presetKey as keyof typeof presetConfigs];
  if (preset) {
    Object.assign(info, preset);
    info.presetConfig = presetKey;
    info.qrKey += 1;
  }
};

// 监听预设配置变化
const handlePresetChange = () => {
  applyPreset(info.presetConfig);
};

const uploadLogo = ref();
const showQRDialog = ref(false);
const windowWidth = ref(800); // 默认宽度

// 计算属性：动态设置二维码尺寸
const qrSize = computed(() => parseInt(info.size));

// 生成唯一的下载文件名
const downloadFileName = computed(() => {
  return `qrcode-${uuidv4()}`;
});

// 计算大图尺寸
const largeQRSize = computed(() => {
  return Math.min(400, windowWidth.value * 0.6);
});

// 获取窗口宽度
onMounted(() => {
  windowWidth.value = window.innerWidth;
  window.addEventListener("resize", () => {
    windowWidth.value = window.innerWidth;
  });

  // 在组件初始化时，将当前配置设置为默认预设
  presetConfigs.default = {
    name: "默认配置",
    description: "当前默认的渐变配置",
    dotType: info.dotType,
    cornerSquareType: info.cornerSquareType,
    cornerDotType: info.cornerDotType,
    colorMode: info.colorMode,
    gradientType: info.gradientType,
    gradientRotation: info.gradientRotation,
    gradientColor1: info.gradientColor1,
    gradientColor2: info.gradientColor2,
    bgColor: info.bgColor,
    cornerSquareColorMode: info.cornerSquareColorMode,
    cornerSquareColor: info.cornerSquareColor,
    cornerDotColorMode: info.cornerDotColorMode,
    cornerDotColor: info.cornerDotColor,
  };
});

// 上传达到上限触发
const handleExceed = () => {
  ElMessage({
    message: "上传数量已达上限，请清除后重新上传",
    type: "warning",
  });
};

// 设置尺寸
const setQRSize = () => {
  info.width = qrSize.value;
  info.height = qrSize.value;
};

const handleChange = (file: UploadFile) => {
  // 清空之前的文件列表，只保留当前文件
  info.fileList = [file.url as string];
  info.fileUrl = file.url as string;
  // 上传logo后重新生成二维码
  info.qrKey += 1;
};

const handleRemove = () => {
  // 清空文件列表
  info.fileList = [];
  info.fileUrl = "";
  // 移除logo后重新生成二维码
  info.qrKey += 1;
};

// 监听尺寸变化，自动生成二维码
const handleSizeChange = () => {
  setQRSize();
  info.qrKey += 1;
};

// 监听内容变化，自动生成二维码
const handleContentChange = () => {
  info.qrKey += 1;
};

// 监听纠错级别变化，自动生成二维码
const handleErrorCorrectionChange = () => {
  info.qrKey += 1;
};

// 监听点样式变化，自动生成二维码
const handleDotTypeChange = () => {
  info.qrKey += 1;
};

// 监听颜色变化，自动生成二维码
const handleColorChange = () => {
  info.qrKey += 1;
};

// 监听颜色模式变化，自动生成二维码
const handleColorModeChange = () => {
  info.qrKey += 1;
};

// 监听渐变色变化，自动生成二维码
const handleGradientChange = () => {
  info.qrKey += 1;
};

// 监听角落方块颜色模式变化
const handleCornerSquareColorModeChange = () => {
  info.qrKey += 1;
};

// 监听角落方块渐变色变化
const handleCornerSquareGradientChange = () => {
  info.qrKey += 1;
};

// 监听角落点颜色模式变化
const handleCornerDotColorModeChange = () => {
  info.qrKey += 1;
};

// 监听角落点渐变色变化
const handleCornerDotGradientChange = () => {
  info.qrKey += 1;
};

// 清除内容
const clearContent = () => {
  info.content = "";
  info.fileList = [];
  info.fileUrl = "";
};

// 查看大图
const viewLargeQR = () => {
  if (!info.content) {
    ElMessage.warning("请先生成二维码");
    return;
  }
  showQRDialog.value = true;
};

// 计算dotsOptions
const dotsOptions = computed(() => {
  if (info.colorMode === "single") {
    return {
      type: info.dotType,
      color: info.preColor,
    };
  } else {
    return {
      type: info.dotType,
      gradient: {
        type: info.gradientType,
        rotation: (info.gradientRotation * Math.PI) / 180, // 转换为弧度
        colorStops: [
          { offset: 0, color: info.gradientColor1 },
          { offset: 1, color: info.gradientColor2 },
        ],
      },
    };
  }
});

// 计算cornersSquareOptions
const cornersSquareOptions = computed(() => {
  if (info.cornerSquareColorMode === "single") {
    return {
      type: info.cornerSquareType,
      color: info.cornerSquareColor,
    };
  } else {
    return {
      type: info.cornerSquareType,
      gradient: {
        type: info.cornerSquareGradientType,
        rotation: (info.cornerSquareGradientRotation * Math.PI) / 180,
        colorStops: [
          { offset: 0, color: info.cornerSquareGradientColor1 },
          { offset: 1, color: info.cornerSquareGradientColor2 },
        ],
      },
    };
  }
});

// 计算cornersDotOptions
const cornersDotOptions = computed(() => {
  if (info.cornerDotColorMode === "single") {
    return {
      type: info.cornerDotType,
      color: info.cornerDotColor,
    };
  } else {
    return {
      type: info.cornerDotType,
      gradient: {
        type: info.cornerDotGradientType,
        rotation: (info.cornerDotGradientRotation * Math.PI) / 180,
        colorStops: [
          { offset: 0, color: info.cornerDotGradientColor1 },
          { offset: 1, color: info.cornerDotGradientColor2 },
        ],
      },
    };
  }
});
</script>

<template>
  <div class="flex flex-col mt-3 ml-4 flex-1 mr-3">
    <DetailHeader :title="info.title"></DetailHeader>

    <div
      class="flex flex-col lg:flex-row gap-6 w-full p-6 rounded-2xl bg-white shadow-sm"
    >
      <!-- 左侧控制面板 -->
      <div class="flex-1 space-y-4">
        <div class="space-y-4">
          <!-- 内容输入 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700"
              >内容（网站链接，扫码会直接打开，暂不支持中文）</label
            >
            <el-input
              v-model="info.content"
              type="textarea"
              :rows="4"
              placeholder="输入文字或网址生成二维码，支持中文内容"
              class="w-full"
              @input="handleContentChange"
            />
          </div>

          <!-- 清除内容按钮 -->
          <div class="flex gap-3">
            <el-button @click="clearContent" class="flex-1">
              清除内容
            </el-button>
          </div>

          <!-- 尺寸设置 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">尺寸</label>
            <el-select
              v-model="info.size"
              class="w-full"
              @change="handleSizeChange"
            >
              <el-option label="小尺寸 128px" value="128" />
              <el-option label="常规 200px" value="200" />
              <el-option label="适中 300px" value="300" />
              <el-option label="较大 400px" value="400" />
              <el-option label="大尺寸 500px" value="500" />
            </el-select>
          </div>

          <!-- 纠错级别 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">纠错级别</label>
            <el-select
              v-model="info.errorCorrectionLevel"
              class="w-full"
              @change="handleErrorCorrectionChange"
            >
              <el-option label="L - 可遮挡 7%" value="L" />
              <el-option label="M - 可遮挡 15%" value="M" />
              <el-option label="Q - 可遮挡 25%" value="Q" />
              <el-option label="H - 可遮挡 30%" value="H" />
            </el-select>
          </div>

          <!-- Logo上传 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">Logo</label>
            <el-upload
              ref="uploadLogo"
              action="#"
              :auto-upload="false"
              :limit="1"
              list-type="picture-card"
              accept=".png,.ico,.jpg,.jpeg"
              :on-change="handleChange"
              :on-exceed="handleExceed"
              :on-remove="handleRemove"
              :file-list="
                info.fileList.length > 0
                  ? info.fileList.map((url) => ({ url, name: 'logo' }))
                  : []
              "
              :show-file-list="false"
              class="w-full"
            >
              <template v-if="info.fileList.length === 0">
                <el-icon><Plus /></el-icon>
              </template>
              <template v-else>
                <div class="relative w-full h-full">
                  <img
                    class="w-full h-full object-cover"
                    :src="info.fileList[0]"
                    alt=""
                  />
                  <span class="absolute top-1 right-1">
                    <el-button
                      type="danger"
                      size="small"
                      circle
                      @click="handleRemove({ url: info.fileList[0] })"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </span>
                </div>
              </template>
            </el-upload>
          </div>

          <!-- 配置模式选择 -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-700">样式配置</label>
            <el-tabs v-model="info.configMode" class="w-full">
              <el-tab-pane label="预设" name="preset">
                <div class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      v-for="(preset, key) in presetConfigs"
                      :key="key"
                      class="preset-card"
                      :class="{ 'preset-card-active': info.presetConfig === key }"
                      @click="applyPreset(key)"
                    >
                      <div class="preset-preview">
                        <QRCodeVue3
                          :value="'预览'"
                          :width="60"
                          :height="60"
                          :qrOptions="{
                            typeNumber: 0,
                            mode: 'Byte',
                            errorCorrectionLevel: 'H',
                          }"
                          :dotsOptions="{
                            type: preset.dotType,
                            color: preset.colorMode === 'single' ? preset.preColor : preset.gradientColor1,
                          }"
                          :background-options="{ color: preset.bgColor }"
                          :cornersSquareOptions="{
                            type: preset.cornerSquareType,
                            color: preset.cornerSquareColor,
                          }"
                          :cornersDotOptions="{
                            type: preset.cornerDotType,
                            color: preset.cornerDotColor,
                          }"
                        />
                      </div>
                      <div class="preset-info">
                        <h4 class="preset-name">{{ preset.name }}</h4>
                        <p class="preset-desc">{{ preset.description }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </el-tab-pane>
              
              <el-tab-pane label="自定义配置" name="custom">
                <div class="space-y-4">
                  <!-- 点样式设置 -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-gray-700">点样式</label>
                    <el-select
                      v-model="info.dotType"
                      class="w-full"
                      @change="handleDotTypeChange"
                    >
                      <el-option label="方形" value="square" />
                      <el-option label="圆角" value="rounded" />
                      <el-option label="圆点" value="dots" />
                      <el-option label="经典" value="classy" />
                      <el-option label="经典圆角" value="classy-rounded" />
                      <el-option label="超圆角" value="extra-rounded" />
                    </el-select>
                  </div>

                  <!-- 颜色设置 -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-gray-700">颜色设置</label>
                    
                    <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <!-- 颜色模式选择 -->
                      <el-tabs v-model="info.colorMode" @tab-change="handleColorModeChange">
                        <el-tab-pane label="单色" name="single">
                          <div class="space-y-2">
                            <div class="flex gap-4">
                              <div class="flex-1">
                                <label class="text-xs text-gray-500 mb-1 block">前景色</label>
                                <el-color-picker
                                  v-model="info.preColor"
                                  @change="handleColorChange"
                                />
                              </div>
                              <div class="flex-1">
                                <label class="text-xs text-gray-500 mb-1 block">背景色</label>
                                <el-color-picker
                                  v-model="info.bgColor"
                                  @change="handleColorChange"
                                />
                              </div>
                            </div>
                          </div>
                        </el-tab-pane>
                        
                        <el-tab-pane label="渐变色" name="gradient">
                          <div class="space-y-3">
                            <!-- 渐变类型 -->
                            <div>
                              <label class="text-xs text-gray-500 mb-1 block">渐变类型</label>
                              <el-select
                                v-model="info.gradientType"
                                class="w-full"
                                @change="handleGradientChange"
                              >
                                <el-option label="线性渐变" value="linear" />
                                <el-option label="径向渐变" value="radial" />
                              </el-select>
                            </div>
                            
                            <!-- 渐变角度（线性渐变时显示） -->
                            <div v-if="info.gradientType === 'linear'">
                              <label class="text-xs text-gray-500 mb-1 block">渐变角度</label>
                              <el-slider
                                v-model="info.gradientRotation"
                                :min="0"
                                :max="360"
                                :step="1"
                                @input="handleGradientChange"
                                show-input
                              />
                            </div>
                            
                            <!-- 渐变色选择 -->
                            <div class="flex gap-4">
                              <div class="flex-1">
                                <label class="text-xs text-gray-500 mb-1 block">起始色</label>
                                <el-color-picker
                                  v-model="info.gradientColor1"
                                  @change="handleGradientChange"
                                />
                              </div>
                              <div class="flex-1">
                                <label class="text-xs text-gray-500 mb-1 block">结束色</label>
                                <el-color-picker
                                  v-model="info.gradientColor2"
                                  @change="handleGradientChange"
                                />
                              </div>
                            </div>
                            
                            <!-- 背景色 -->
                            <div>
                              <label class="text-xs text-gray-500 mb-1 block">背景色</label>
                              <el-color-picker
                                v-model="info.bgColor"
                                @change="handleColorChange"
                              />
                            </div>
                          </div>
                        </el-tab-pane>
                      </el-tabs>
                    </div>
                  </div>

                  <!-- 角落方块设置 -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-gray-700">角落方块</label>
                    
                    <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <!-- 角落方块样式 -->
                      <div class="mb-3">
                        <label class="text-xs text-gray-500 mb-1 block">样式</label>
                        <el-select
                          v-model="info.cornerSquareType"
                          class="w-full"
                          @change="handleDotTypeChange"
                        >
                          <el-option label="方形" value="square" />
                          <el-option label="圆点" value="dot" />
                          <el-option label="超圆角" value="extra-rounded" />
                        </el-select>
                      </div>
                      
                      <!-- 角落方块颜色设置 -->
                      <el-tabs v-model="info.cornerSquareColorMode" @tab-change="handleCornerSquareColorModeChange">
                        <el-tab-pane label="单色" name="single">
                          <div class="space-y-2">
                            <label class="text-xs text-gray-500 mb-1 block">颜色</label>
                            <el-color-picker
                              v-model="info.cornerSquareColor"
                              @change="handleCornerSquareGradientChange"
                            />
                          </div>
                        </el-tab-pane>
                        
                        <el-tab-pane label="渐变色" name="gradient">
                          <div class="space-y-3">
                            <!-- 渐变类型 -->
                            <div>
                              <label class="text-xs text-gray-500 mb-1 block">渐变类型</label>
                              <el-select
                                v-model="info.cornerSquareGradientType"
                                class="w-full"
                                @change="handleCornerSquareGradientChange"
                              >
                                <el-option label="线性渐变" value="linear" />
                                <el-option label="径向渐变" value="radial" />
                              </el-select>
                            </div>
                            
                            <!-- 渐变角度（线性渐变时显示） -->
                            <div v-if="info.cornerSquareGradientType === 'linear'">
                              <label class="text-xs text-gray-500 mb-1 block">渐变角度</label>
                              <el-slider
                                v-model="info.cornerSquareGradientRotation"
                                :min="0"
                                :max="360"
                                :step="1"
                                @input="handleCornerSquareGradientChange"
                                show-input
                              />
                            </div>
                            
                            <!-- 渐变色选择 -->
                            <div class="flex gap-4">
                              <div class="flex-1">
                                <label class="text-xs text-gray-500 mb-1 block">起始色</label>
                                <el-color-picker
                                  v-model="info.cornerSquareGradientColor1"
                                  @change="handleCornerSquareGradientChange"
                                />
                              </div>
                              <div class="flex-1">
                                <label class="text-xs text-gray-500 mb-1 block">结束色</label>
                                <el-color-picker
                                  v-model="info.cornerSquareGradientColor2"
                                  @change="handleCornerSquareGradientChange"
                                />
                              </div>
                            </div>
                          </div>
                        </el-tab-pane>
                      </el-tabs>
                    </div>
                  </div>

                  <!-- 角落点设置 -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-gray-700">角落点</label>
                    
                    <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <!-- 角落点样式 -->
                      <div class="mb-3">
                        <label class="text-xs text-gray-500 mb-1 block">样式</label>
                        <el-select
                          v-model="info.cornerDotType"
                          class="w-full"
                          @change="handleDotTypeChange"
                        >
                          <el-option label="圆点" value="dot" />
                          <el-option label="方形" value="square" />
                        </el-select>
                      </div>
                      
                      <!-- 角落点颜色设置 -->
                      <el-tabs v-model="info.cornerDotColorMode" @tab-change="handleCornerDotColorModeChange">
                        <el-tab-pane label="单色" name="single">
                          <div class="space-y-2">
                            <label class="text-xs text-gray-500 mb-1 block">颜色</label>
                            <el-color-picker
                              v-model="info.cornerDotColor"
                              @change="handleCornerDotGradientChange"
                            />
                          </div>
                        </el-tab-pane>
                        
                        <el-tab-pane label="渐变色" name="gradient">
                          <div class="space-y-3">
                            <!-- 渐变类型 -->
                            <div>
                              <label class="text-xs text-gray-500 mb-1 block">渐变类型</label>
                              <el-select
                                v-model="info.cornerDotGradientType"
                                class="w-full"
                                @change="handleCornerDotGradientChange"
                              >
                                <el-option label="线性渐变" value="linear" />
                                <el-option label="径向渐变" value="radial" />
                              </el-select>
                            </div>
                            
                            <!-- 渐变角度（线性渐变时显示） -->
                            <div v-if="info.cornerDotGradientType === 'linear'">
                              <label class="text-xs text-gray-500 mb-1 block">渐变角度</label>
                              <el-slider
                                v-model="info.cornerDotGradientRotation"
                                :min="0"
                                :max="360"
                                :step="1"
                                @input="handleCornerDotGradientChange"
                                show-input
                              />
                            </div>
                            
                            <!-- 渐变色选择 -->
                            <div class="flex gap-4">
                              <div class="flex-1">
                                <label class="text-xs text-gray-500 mb-1 block">起始色</label>
                                <el-color-picker
                                  v-model="info.cornerDotGradientColor1"
                                  @change="handleCornerDotGradientChange"
                                />
                              </div>
                              <div class="flex-1">
                                <label class="text-xs text-gray-500 mb-1 block">结束色</label>
                                <el-color-picker
                                  v-model="info.cornerDotGradientColor2"
                                  @change="handleCornerDotGradientChange"
                                />
                              </div>
                            </div>
                          </div>
                        </el-tab-pane>
                      </el-tabs>
                    </div>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </div>

      <!-- 右侧预览区域始终渲染，但内容区做条件渲染 -->
      <div class="preview-container">
        <div class="flex flex-col items-center space-y-4 lg:w-80">
          <template v-if="info.content && info.content.trim()">
            <div class="text-center">
              <h3 class="text-lg font-medium text-gray-900 mb-2">二维码预览</h3>
              <p class="text-sm text-gray-500">点击二维码查看大图</p>
            </div>
            <div class="qr-code bg-white p-4 rounded-lg border border-gray-200">
              <div class="qr-code-wrapper" @click="viewLargeQR">
                <QRCodeVue3
                  :key="info.qrKey"
                  :value="info.content"
                  :width="qrSize"
                  :height="qrSize"
                  :qrOptions="{
                    typeNumber: 0,
                    mode: 'Byte',
                    errorCorrectionLevel: info.errorCorrectionLevel,
                  }"
                  :imageOptions="{
                    hideBackgroundDots: true,
                    imageSize: 0.4,
                    margin: 0,
                  }"
                  :dotsOptions="dotsOptions"
                  :image="info.fileList[0] || undefined"
                  :background-options="{ color: info.bgColor }"
                  :cornersSquareOptions="cornersSquareOptions"
                  :cornersDotOptions="cornersDotOptions"
                  :download="true"
                  :download-options="{
                    name: downloadFileName,
                    extension: 'png',
                  }"
                  myclass="qr-code-container"
                  imgclass="qr-code-image"
                  download-button="qr-download-btn"
                  file-ext="png"
                />
              </div>
            </div>
          </template>
          <template v-else>
            <!-- 占位内容，可自定义为空白或友好提示 -->
            <div class="flex flex-col items-center justify-center h-64 w-full opacity-60">
              <el-icon size="48"><svg viewBox="0 0 1024 1024"><path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.2 0-372-166.8-372-372S306.8 140 512 140s372 166.8 372 372-166.8 372-372 372zm0-624c-139.2 0-252 112.8-252 252s112.8 252 252 252 252-112.8 252-252S651.2 260 512 260zm0 432c-99.2 0-180-80.8-180-180s80.8-180 180-180 180 80.8 180 180-80.8 180-180 180z" fill="#d3d3d3"/></svg></el-icon>
              <span class="text-gray-400 mt-4">请输入内容以生成二维码</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 大图弹窗 -->
    <el-dialog
      v-model="showQRDialog"
      title="二维码大图预览"
      width="auto"
      :close-on-click-modal="true"
      :show-close="true"
      center
    >
      <div class="flex flex-col items-center">
        <QRCodeVue3
          :key="info.qrKey + '-large'"
          :value="info.content"
          :width="largeQRSize"
          :height="largeQRSize"
          :qrOptions="{
            typeNumber: 0,
            mode: 'Byte',
            errorCorrectionLevel: info.errorCorrectionLevel,
          }"
          :imageOptions="{
            hideBackgroundDots: true,
            imageSize: 0.4,
            margin: 0,
          }"
          :dotsOptions="dotsOptions"
          :image="info.fileList[0] || undefined"
          :background-options="{ color: info.bgColor }"
          :cornersSquareOptions="cornersSquareOptions"
          :cornersDotOptions="cornersDotOptions"
          myclass="qr-code-container-large"
          imgclass="qr-code-image-large"
        />
      </div>
    </el-dialog>

    <!-- 页面底部 ToolDetail，始终显示 -->
    <ToolDetail title="描述">
      <el-text>
        本工具支持生成高颜值二维码，支持丰富的自定义样式（点样式、渐变、角落方块、角落点等）、多种精美预设、一键切换风格，并可上传Logo。扫码可直达目标链接，适用于宣传、分享、名片等多种场景。
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
/* 预设卡片样式 */
.preset-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  background: #fafbfc;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.preset-card-active {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.08);
  background: #f0f7ff;
}
.preset-preview {
  flex-shrink: 0;
}
.preset-info {
  flex: 1;
}
.preset-name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 2px;
}
.preset-desc {
  font-size: 12px;
  color: #888;
}

/* 预览容器固定在右侧，不再悬浮 */
.preview-container {
  width: 320px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  padding: 16px;
  align-self: flex-start;
  margin-left: auto;
}

@media (max-width: 1024px) {
  .preview-container {
    width: 100%;
    margin-left: 0;
    margin-top: 24px;
  }
}

/* 确保所有输入框和选择器都有正确的宽度限制 */
:deep(.el-input),
:deep(.el-select),
:deep(.el-input-number) {
  width: 100% !important;
  max-width: 100% !important;
}

:deep(.el-textarea__inner) {
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* 确保颜色选择器不会超出容器 */
:deep(.el-color-picker) {
  width: 100% !important;
  max-width: 100% !important;
}

.color-picker-limit {
  max-width: 120px;
  width: 100%;
}

.qr-code {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* 二维码包装器，添加点击效果 */
.qr-code-wrapper {
  cursor: pointer;
  transition: transform 0.3s ease;
  border-radius: 8px;
  overflow: hidden;
}

.qr-code-wrapper:hover {
  transform: scale(1.05);
}

.qr-code-wrapper:active {
  transform: scale(1.02);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .qr-code {
    max-width: 300px;
    margin: 0 auto;
  }
}

/* 上传组件样式优化 */
:deep(.el-upload--picture-card) {
  width: 100px;
  height: 100px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  transition: border-color 0.3s;
}

:deep(.el-upload--picture-card:hover) {
  border-color: #409eff;
}

/* 二维码组件样式 */
:deep(.qr-code canvas) {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 自定义下载按钮样式 */
:deep(.qr-download-btn) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  margin-top: 12px;
  width: 100%;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:deep(.qr-download-btn:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
}

:deep(.qr-download-btn:active) {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
}

/* 修改下载按钮文本为"下载二维码" */
:deep(.qr-download-btn) {
  font-size: 0; /* 隐藏原始文本 */
}

:deep(.qr-download-btn::before) {
  content: "下载二维码";
  font-size: 14px;
  display: inline-block;
}

/* 二维码容器样式 */
:deep(.qr-code-container) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* 二维码图片样式 */
:deep(.qr-code-image) {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

:deep(.qr-code-image:hover) {
  transform: scale(1.02);
}

/* 大图对话框中的二维码样式 */
:deep(.qr-code-container-large) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

:deep(.qr-code-image-large) {
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

:deep(.qr-download-btn-large) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  margin-top: 16px;
  width: 100%;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:deep(.qr-download-btn-large:hover) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
}

:deep(.qr-download-btn-large:active) {
  transform: translateY(0);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

:deep(.qr-download-btn-large) {
  font-size: 0;
}

:deep(.qr-download-btn-large::before) {
  content: "下载二维码";
  font-size: 16px;
  display: inline-block;
}

/* 让el-slider的输入框变窄，滑块更宽 */
:deep(.el-slider__input) {
  width: 120px !important;
  min-width: 0 !important;
  margin-left: 28px !important;
}

:deep(.el-slider__runway) {
  margin-left: 20px;
}
</style>
<script setup lang="ts">
import { reactive, ref, computed, onMounted } from "vue";
import DetailHeader from "@/components/Layout/DetailHeader/DetailHeader.vue";
import QRCodeVue3 from "qrcode-vue3";
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElMessage, type UploadFile } from "element-plus";
import { v4 as uuidv4 } from "uuid";

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
});

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
              >内容（网站链接，扫码会直接打开）</label
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
                          class="color-picker-limit"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="text-xs text-gray-500 mb-1 block">背景色</label>
                        <el-color-picker
                          v-model="info.bgColor"
                          @change="handleColorChange"
                          class="color-picker-limit"
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
                        @change="handleGradientChange"
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
                          class="color-picker-limit"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="text-xs text-gray-500 mb-1 block">结束色</label>
                        <el-color-picker
                          v-model="info.gradientColor2"
                          @change="handleGradientChange"
                          class="color-picker-limit"
                        />
                      </div>
                    </div>
                    
                    <!-- 背景色 -->
                    <div>
                      <label class="text-xs text-gray-500 mb-1 block">背景色</label>
                      <el-color-picker
                        v-model="info.bgColor"
                        @change="handleColorChange"
                        class="color-picker-limit"
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
                      class="color-picker-limit"
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
                        @change="handleCornerSquareGradientChange"
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
                          class="color-picker-limit"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="text-xs text-gray-500 mb-1 block">结束色</label>
                        <el-color-picker
                          v-model="info.cornerSquareGradientColor2"
                          @change="handleCornerSquareGradientChange"
                          class="color-picker-limit"
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
                      class="color-picker-limit"
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
                        @change="handleCornerDotGradientChange"
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
                          class="color-picker-limit"
                        />
                      </div>
                      <div class="flex-1">
                        <label class="text-xs text-gray-500 mb-1 block">结束色</label>
                        <el-color-picker
                          v-model="info.cornerDotGradientColor2"
                          @change="handleCornerDotGradientChange"
                          class="color-picker-limit"
                        />
                      </div>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
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
                      @click="handleRemove"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </span>
                </div>
              </template>
            </el-upload>
          </div>

          <!-- 操作按钮 -->
          <div class="flex gap-3 pt-4">
            <el-button @click="clearContent" class="flex-1">
              清除内容
            </el-button>
          </div>
        </div>
      </div>

      <!-- 右侧预览区域 -->
      <div class="preview-container">
        <div class="flex flex-col items-center space-y-4 lg:w-80">
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
  </div>
</template>

<style scoped>
/* 预览容器固定在右侧，不再悬浮 */
.preview-container {
  width: 320px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  padding: 16px;
  /* 取消 position: fixed; */
  /* 保持和内容区同一高度对齐 */
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
</style>
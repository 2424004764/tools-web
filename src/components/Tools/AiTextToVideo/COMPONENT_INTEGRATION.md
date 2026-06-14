# 组件集成指南

## 已完成的工作

### 1. 创建的子组件
- ✅ `prompts.ts` - 数据文件
- ✅ `ChatSessionList.vue` - AI对话会话列表
- ✅ `ChatMessageArea.vue` - AI对话消息区
- ✅ `TextToVideoForm.vue` - 文生视频表单
- ✅ `ImageToVideoForm.vue` - 图生视频表单
- ✅ `TextToImageForm.vue` - 文生图表单
- ✅ `ImageToImageForm.vue` - 图生图表单
- ✅ `ResultDisplay.vue` - 结果显示组件

### 2. 已在主组件中完成
- ✅ 导入所有子组件
- ✅ 导入 imagePromptExamples
- ✅ 添加 randomImagePrompt 函数
- ✅ 替换文生视频表单为 TextToVideoForm 组件

## 待完成的集成步骤

### 3. 替换图生视频表单（行号约1126）

**查找：**
```vue
<!-- 图生视频表单 -->
<div v-if="activeTab === 'image-to-video'">
  <!-- 整个表单内容 -->
</div>
```

**替换为：**
```vue
<!-- 图生视频表单 -->
<ImageToVideoForm
  v-if="activeTab === 'image-to-video'"
  v-model:imageMode="imageMode"
  v-model:videoPrompt="videoPrompt"
  v-model:duration="duration"
  v-model:aspectRatio="aspectRatio"
  v-model:autoOptimize="autoGenerateImagePrompt"
  :uploadedImages="uploadedImages"
  :disabled="isGenerating"
  :isUploading="isUploading"
  @upload="handleImageUpload"
  @remove-image="removeImage"
  @add-preset="addPresetImage"
  @random-prompt="randomVideoPrompt"
  @generate="generateImageToVideo"
/>
```

### 4. 替换文生图表单（行号约1356）

**查找：**
```vue
<!-- 文生图表单 -->
<div v-if="activeTab === 'text-to-image'">
  <!-- 整个表单内容 -->
</div>
```

**替换为：**
```vue
<!-- 文生图表单 -->
<TextToImageForm
  v-if="activeTab === 'text-to-image'"
  v-model:model="imageModel"
  v-model:prompt="imagePrompt"
  v-model:aspectRatio="imageAspectRatio"
  v-model:count="imageCount"
  :disabled="isGenerating"
  @random="randomImagePrompt"
  @generate="generateTextToImage"
/>
```

### 5. 替换图生图表单（行号约1433）

**查找：**
```vue
<!-- 图生图表单 -->
<div v-if="activeTab === 'image-to-image'">
  <!-- 整个表单内容 -->
</div>
```

**替换为：**
```vue
<!-- 图生图表单 -->
<ImageToImageForm
  v-if="activeTab === 'image-to-image'"
  :sourceImage="imageToImageSourceImage"
  v-model:model="imageToImageModel"
  v-model:prompt="imageToImagePrompt"
  v-model:strength="imageToImageStrength"
  v-model:aspectRatio="imageToImageAspectRatio"
  v-model:count="imageToImageCount"
  :disabled="isGenerating"
  :isUploading="isUploading"
  @upload="handleImageToImageUpload"
  @remove="removeSourceImage"
  @generate="generateImageToImage"
/>
```

### 6. 替换右侧结果显示区（行号约1684）

**查找整个结果显示区块：**
```vue
<!-- 右侧：结果显示 -->
<div v-if="activeTab !== 'ai-chat'" class="lg:w-1/2 mt-6 lg:mt-0">
  <!-- 阶段进度 -->
  <!-- 进度提示 -->
  <!-- 生成的文案 -->
  <!-- 生成的图片 -->
  <!-- 生成的视频 -->
</div>
```

**替换为：**
```vue
<!-- 右侧：结果显示 -->
<div v-if="activeTab !== 'ai-chat'" class="lg:w-1/2 mt-6 lg:mt-0">
  <ResultDisplay
    :activeTab="activeTab"
    :currentStage="currentStage"
    :currentStep="currentStep"
    :generatedScript="generatedScript"
    :generatedImages="generatedImages"
    :generatedVideoUrl="generatedVideoUrl"
    :scriptGenerateTime="scriptGenerateTime"
    :generateTime="videoGenerateTime"
    :videoDuration="videoDuration"
    :videoProgress="videoProgress"
    :isVideoPlaying="isVideoPlaying"
    :autoOptimize="autoGeneratePrompt"
    :autoOptimizeImage="autoGenerateImagePrompt"
    @download-image="downloadImage"
    @download-video="downloadVideo"
    @show-video-modal="showVideoModal = true"
    @video-loaded="handleVideoLoaded"
    @video-timeupdate="handleVideoTimeUpdate"
    @video-mouseenter="handleVideoMouseEnter"
    @video-mouseleave="handleVideoMouseLeave"
  />
</div>
```

### 7. 需要添加的辅助函数

在主组件的 script 部分添加这些函数（如果还没有）：

```typescript
const removeImage = (index: number) => {
  uploadedImages.value.splice(index, 1)
}

const addPresetImage = (url: string) => {
  if (imageMode.value === 'single') {
    uploadedImages.value = [url]
  } else if (uploadedImages.value.length < 2) {
    uploadedImages.value.push(url)
  }
  ElMessage.success('已添加预设图片')
}
```

## 集成后的好处

1. **主组件代码减少约800行**
   - 从 1800+ 行减少到 1000- 行
   
2. **职责清晰**
   - 主组件：状态管理 + API调用
   - 子组件：UI展示 + 用户交互

3. **易于维护**
   - 每个表单独立文件
   - 修改某个功能只需编辑对应组件

4. **可复用**
   - 表单组件可以在其他页面复用
   - 结果显示组件通用化

## 测试清单

完成集成后需要测试：
- [ ] 文生视频：输入、随机、优化开关、生成
- [ ] 图生视频：单图/双图、上传、预设、生成
- [ ] 文生图：输入、随机、生成
- [ ] 图生图：上传、强度滑块、生成
- [ ] AI对话：会话管理、消息发送
- [ ] 结果显示：文案、图片、视频展示
- [ ] 下载功能：图片下载、视频下载

## 注意事项

1. **v-model 绑定**
   - 确保所有 v-model 绑定正确
   - 双向绑定使用 `v-model:propName`

2. **事件触发**
   - 所有 @event 需要在主组件中有对应的处理函数

3. **props 类型**
   - 确保传递的 props 类型与子组件定义一致

4. **构建测试**
   - 每替换一个组件后运行 `pnpm build:pro` 测试
   - 确保没有编译错误

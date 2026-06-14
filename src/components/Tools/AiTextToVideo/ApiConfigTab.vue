<template>
  <div>
    <div class="mb-6 p-4 bg-blue-50 rounded-lg">
      <h3 class="text-sm font-semibold mb-2">API配置</h3>
      <p class="text-xs text-gray-600 mb-3">
        在 <a href="https://agnes-ai.com" target="_blank" class="text-blue-500">agnes-ai.com</a> 注册并获取 API Key
      </p>
      <div class="flex gap-2">
        <input
          v-model="localApiKey"
          type="password"
          placeholder="请输入 Agnes AI API Key"
          class="flex-1 px-3 py-2 border rounded-lg text-sm"
        />
        <button
          @click="handleSave"
          class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm whitespace-nowrap"
        >
          保存
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-2">
        {{ isLoggedIn ? 'API Key将保存到服务器（需登录）' : 'API Key将保存到本地浏览器' }}
      </p>
    </div>

    <div class="text-sm text-gray-700 space-y-4">
      <section>
        <h3 class="font-semibold mb-2">功能概览</h3>
        <ul class="list-disc list-inside space-y-1">
          <li><strong>文生视频：</strong>输入主题自动生成视频，支持5-15秒，多种比例</li>
          <li><strong>图生视频：</strong>上传图片生成动态视频，支持单图/双图模式</li>
          <li><strong>文生图：</strong>文字描述生成图片，支持多种比例和数量</li>
          <li><strong>图生图：</strong>基于参考图修改生成新图，可调整生成强度</li>
          <li><strong>AI对话：</strong>智能对话助手，支持会话管理</li>
        </ul>
      </section>

      <section>
        <h3 class="font-semibold mb-2">使用流程</h3>
        <ol class="list-decimal list-inside space-y-1">
          <li>在 <a href="https://agnes-ai.com" target="_blank" class="text-blue-500">agnes-ai.com</a> 注册账号</li>
          <li>获取 API Key 并在此页面保存</li>
          <li>选择功能Tab，填写参数后点击生成</li>
          <li>等待生成完成，可在线预览或下载</li>
        </ol>
      </section>

      <section>
        <h3 class="font-semibold mb-2">技术参数</h3>
        <ul class="list-disc list-inside space-y-1">
          <li><strong>视频模型：</strong>agnes-video-v2.0，24fps，最高15秒</li>
          <li><strong>图像模型：</strong>agnes-image-2.1-flash / agnes-image-2.0</li>
          <li><strong>对话模型：</strong>agnes-2.0-flash / agnes-2.0</li>
          <li><strong>支持比例：</strong>9:16 / 16:9 / 1:1 / 4:3 / 3:4</li>
        </ul>
      </section>

      <section>
        <h3 class="font-semibold mb-2">提示词最佳实践</h3>
        <p class="mb-2">推荐结构：<strong>[主体] + [动作] + [场景] + [镜头] + [光照] + [风格]</strong></p>
        <p class="text-gray-600 italic text-xs">
          示例：A young astronaut walking across a red desert planet, dust blowing in the wind,
          slow cinematic tracking shot, dramatic sunset lighting, realistic sci-fi style
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

interface Props {
  apiKey: string
  isLoggedIn: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:apiKey': [value: string]
  'save': []
}>()

const localApiKey = ref(props.apiKey)

watch(() => props.apiKey, (newVal) => {
  localApiKey.value = newVal
})

watch(localApiKey, (newVal) => {
  emit('update:apiKey', newVal)
})

const handleSave = () => {
  if (!localApiKey.value.trim()) {
    ElMessage.warning('请输入API Key')
    return
  }
  emit('save')
}
</script>

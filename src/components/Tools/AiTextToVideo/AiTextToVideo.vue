<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const apiKey = ref('')
const topic = ref('')
const duration = ref(5)
const isGenerating = ref(false)
const currentStep = ref('')
const generatedScript = ref('')
const generatedVideoUrl = ref('')

const topicExamples = [
  '一只可爱的猫咪在草地上玩耍',
  '日落时分的海边，海浪拍打着礁石',
  '城市夜景，霓虹灯闪烁，车流如梭',
  '森林中的小溪，阳光穿过树叶洒下斑驳光影',
  '宇航员在太空中漂浮，地球在远方',
  '樱花飘落，一对情侣在树下漫步',
  '雨后的街道，倒映着五彩的霓虹',
  '雪山之巅，登山者举起胜利的旗帜',
  '咖啡馆里，温暖的灯光下有人在看书',
  '小狗追逐着飞舞的蝴蝶',
  '未来科技城市，飞行汽车穿梭其间',
  '秋天的枫叶林，红叶漫天飞舞'
]

const durationOptions = [
  { label: '5秒 (125帧)', value: 5, frames: 125 },
  { label: '10秒 (250帧)', value: 10, frames: 250 }
]

const randomTopic = () => {
  topic.value = topicExamples[Math.floor(Math.random() * topicExamples.length)]
}

onMounted(() => {
  const stored = localStorage.getItem('agnes_api_key')
  if (stored) apiKey.value = stored
})

const saveApiKey = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请输入API Key')
    return
  }

  if (userStore.user?.uid) {
    // TODO: 调用接口保存到服务器
    ElMessage.warning('暂不支持保存到服务器')
  }

  localStorage.setItem('agnes_api_key', apiKey.value.trim())
  ElMessage.success('API Key已保存到本地')
}

const generateVideo = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请先填写并保存API Key')
    return
  }

  if (!topic.value.trim()) {
    ElMessage.warning('请输入视频主题')
    return
  }

  isGenerating.value = true
  generatedScript.value = ''
  generatedVideoUrl.value = ''

  try {
    // 第一步：生成文案
    currentStep.value = '正在生成视频文案...'
    const script = await generateScript(topic.value.trim())
    generatedScript.value = script

    // 第二步：生成视频
    currentStep.value = '正在生成视频（这可能需要几分钟）...'
    const selectedDuration = durationOptions.find(d => d.value === duration.value)!
    const videoUrl = await generateVideoFromScript(script, selectedDuration.frames)
    generatedVideoUrl.value = videoUrl

    currentStep.value = '视频生成完成！'
    ElMessage.success('视频生成成功')
  } catch (error: any) {
    ElMessage.error(error.message || '生成失败')
    currentStep.value = ''
  } finally {
    isGenerating.value = false
  }
}

const generateScript = async (topicText: string): Promise<string> => {
  // 开发环境提示
  if (import.meta.env.DEV) {
    throw new Error('本地开发环境暂不支持，请部署到生产环境测试')
  }

  const response = await fetch('/api/agnes-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.value.trim()}`
    },
    body: JSON.stringify({
      model: 'agnes-2.0-flash',
      messages: [
        {
          role: 'user',
          content: `请为以下主题创作一个${duration.value}秒的短视频文案，要求简洁有力、适合视觉呈现：${topicText}`
        }
      ]
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '文案生成失败')
  }

  const data = await response.json()
  return data.choices[0].message.content
}

const generateVideoFromScript = async (script: string, frames: number): Promise<string> => {
  const response = await fetch('/api/agnes-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.value.trim()}`
    },
    body: JSON.stringify({
      model: 'agnes-video-v2.0',
      prompt: script,
      num_frames: frames,
      frame_rate: 25
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '视频生成失败')
  }

  const data = await response.json()
  const videoId = data.video_id

  // 轮询查询视频状态
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 5000)) // 等待5秒

    currentStep.value = '视频生成中，请稍候...'

    const statusResponse = await fetch(`/api/agnes-video-status?video_id=${encodeURIComponent(videoId)}`, {
      headers: {
        'Authorization': `Bearer ${apiKey.value.trim()}`
      }
    })

    if (!statusResponse.ok) {
      throw new Error('查询视频状态失败')
    }

    const statusData = await statusResponse.json()

    if (statusData.status === 'completed') {
      return statusData.remixed_from_video_id
    } else if (statusData.status === 'failed' || statusData.error) {
      throw new Error(statusData.error || '视频生成失败')
    }

    // 更新进度
    if (statusData.progress) {
      currentStep.value = `视频生成中 ${statusData.progress}%...`
    }
  }
}

const downloadVideo = () => {
  const a = document.createElement('a')
  a.href = generatedVideoUrl.value
  a.download = `video_${Date.now()}.mp4`
  a.click()
}
</script>

<template>
  <div>
    <DetailHeader title="AI文生视频" :id="1" />

    <div class="bg-white rounded-2xl p-6 shadow-sm">
      <!-- API Key配置 -->
      <div class="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 class="text-sm font-semibold mb-2">API Key配置</h3>
        <div class="flex gap-2">
          <input
            v-model="apiKey"
            type="password"
            placeholder="请输入Agnes AI的API Key"
            class="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button
            @click="saveApiKey"
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
          >
            保存
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          获取API Key: <a href="https://agnes-ai.com" target="_blank" class="text-blue-500">agnes-ai.com</a>
          {{ userStore.user?.uid ? ' (已登录，保存到服务器)' : ' (未登录，保存到本地)' }}
        </p>
      </div>

      <!-- 主题输入 -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">视频主题</label>
        <div class="flex gap-2">
          <textarea
            v-model="topic"
            placeholder="例如：一只可爱的猫咪在草地上玩耍"
            rows="3"
            class="flex-1 px-3 py-2 border rounded-lg text-sm"
            :disabled="isGenerating"
          />
          <button
            @click="randomTopic"
            :disabled="isGenerating"
            class="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm whitespace-nowrap disabled:bg-gray-50 disabled:cursor-not-allowed"
            title="随机示例"
          >
            🎲 随机
          </button>
        </div>
      </div>

      <!-- 时长选择 -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">视频时长</label>
        <select
          v-model="duration"
          class="px-3 py-2 border rounded-lg text-sm"
          :disabled="isGenerating"
        >
          <option v-for="opt in durationOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- 生成按钮 -->
      <button
        @click="generateVideo"
        :disabled="isGenerating"
        class="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
      >
        {{ isGenerating ? '生成中...' : '生成视频' }}
      </button>

      <!-- 进度提示 -->
      <div v-if="currentStep" class="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
        {{ currentStep }}
      </div>

      <!-- 生成的文案 -->
      <div v-if="generatedScript" class="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 class="text-sm font-semibold mb-2">生成的文案</h3>
        <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ generatedScript }}</p>
      </div>

      <!-- 生成的视频 -->
      <div v-if="generatedVideoUrl" class="mt-6">
        <h3 class="text-sm font-semibold mb-2">生成的视频</h3>
        <video
          :src="generatedVideoUrl"
          controls
          class="w-full max-w-2xl mx-auto rounded-lg shadow"
        />
        <div class="mt-3 text-center">
          <button
            @click="downloadVideo"
            class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
          >
            下载视频
          </button>
        </div>
      </div>
    </div>

    <ToolDetail />
  </div>
</template>

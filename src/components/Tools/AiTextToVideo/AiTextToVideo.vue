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
const aspectRatio = ref('9:16')
const isGenerating = ref(false)
const currentStep = ref('')
const generatedScript = ref('')
const generatedVideoUrl = ref('')
const scriptGenerateTime = ref(0)
const videoGenerateTime = ref(0)
const currentStageStartTime = ref(0)
const elapsedTimer = ref<number | null>(null)
const currentStage = ref(0) // 0:未开始 1:生成文案 2:生成视频 3:完成

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
  { label: '5秒', value: 5, frames: 121 },
  { label: '10秒', value: 10, frames: 241 },
  { label: '15秒', value: 15, frames: 361 }
]

const aspectRatioOptions = [
  { label: '横屏 16:9', value: '16:9', width: 1280, height: 720 },
  { label: '竖屏 9:16', value: '9:16', width: 720, height: 1280 },
  { label: '方形 1:1', value: '1:1', width: 1024, height: 1024 },
  { label: '标准 4:3', value: '4:3', width: 1024, height: 768 },
  { label: '竖屏 3:4', value: '3:4', width: 768, height: 1024 }
]

const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}秒`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
}

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

const startElapsedTimer = (stage: string) => {
  if (elapsedTimer.value) {
    clearInterval(elapsedTimer.value)
  }
  currentStageStartTime.value = Date.now()
  elapsedTimer.value = window.setInterval(() => {
    const elapsed = Math.round((Date.now() - currentStageStartTime.value) / 1000)
    currentStep.value = `${stage} (已耗时 ${elapsed}秒)...`
  }, 1000)
}

const stopElapsedTimer = () => {
  if (elapsedTimer.value) {
    clearInterval(elapsedTimer.value)
    elapsedTimer.value = null
  }
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
  scriptGenerateTime.value = 0
  videoGenerateTime.value = 0
  currentStage.value = 0

  try {
    // 第一步：生成文案
    currentStage.value = 1
    startElapsedTimer('正在生成视频文案')
    const script = await generateScript(topic.value.trim())
    stopElapsedTimer()
    scriptGenerateTime.value = Math.round((Date.now() - currentStageStartTime.value) / 1000)
    generatedScript.value = script

    // 第二步：生成视频
    currentStage.value = 2
    const selectedDuration = durationOptions.find(d => d.value === duration.value)!
    const videoUrl = await generateVideoFromScript(script, selectedDuration.frames)
    stopElapsedTimer()
    videoGenerateTime.value = Math.round((Date.now() - currentStageStartTime.value) / 1000)
    generatedVideoUrl.value = videoUrl

    currentStage.value = 3
    currentStep.value = `视频生成完成！`
    ElMessage.success('视频生成成功')
  } catch (error: any) {
    stopElapsedTimer()
    ElMessage.error(error.message || '生成失败')
    currentStep.value = ''
  } finally {
    isGenerating.value = false
  }
}

const generateScript = async (topicText: string): Promise<string> => {
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
          content: `请为以下主题创作一个${duration.value}秒的短视频提示词(Prompt)，要求：
1. 描述主体、动作、场景、镜头运动、光照和视觉风格
2. 结构：[主体] + [动作] + [场景] + [镜头运动] + [光照] + [风格]
3. 用中文输出，生动细腻
4. 示例格式：一位年轻的宇航员走过红色沙漠星球，沙尘随风飘扬，缓慢的电影级跟踪镜头，戏剧性的日落光照，写实科幻风格

主题：${topicText}`
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
  const selectedAspectRatio = aspectRatioOptions.find(r => r.value === aspectRatio.value)!

  // 提交视频生成任务
  startElapsedTimer('正在提交视频生成任务')
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
      frame_rate: 24,
      width: selectedAspectRatio.width,
      height: selectedAspectRatio.height
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || '视频生成失败')
  }

  const data = await response.json()
  const videoId = data.video_id

  // 轮询查询视频状态
  currentStageStartTime.value = Date.now()
  startElapsedTimer('视频生成中')

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 5000)) // 等待5秒

    const elapsed = Math.round((Date.now() - currentStageStartTime.value) / 1000)

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

    // 更新进度（手动更新，不依赖定时器）
    if (statusData.progress) {
      currentStep.value = `视频生成中 ${statusData.progress}% (已耗时 ${elapsed}秒)...`
    } else {
      currentStep.value = `视频生成中 (已耗时 ${elapsed}秒)...`
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
      <div class="lg:flex lg:gap-6">
        <!-- 左侧：输入区域 -->
        <div class="lg:w-1/2">
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
            <p class="text-xs text-gray-500 mt-1">
              描述主体、动作、场景、镜头运动、光照和视觉风格，生成效果更佳
            </p>
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

          <!-- 宽高比选择 -->
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">视频比例</label>
            <select
              v-model="aspectRatio"
              class="px-3 py-2 border rounded-lg text-sm"
              :disabled="isGenerating"
            >
              <option v-for="opt in aspectRatioOptions" :key="opt.value" :value="opt.value">
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
        </div>

        <!-- 右侧：结果显示区域 -->
        <div class="lg:w-1/2 mt-6 lg:mt-0">
          <!-- 阶段进度 -->
          <div v-if="currentStage > 0" class="mb-4 p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                  currentStage >= 1 ? (currentStage > 1 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white') : 'bg-gray-300 text-gray-500']">
                  {{ currentStage > 1 ? '✓' : '1' }}
                </div>
                <span class="text-sm font-medium">生成文案</span>
              </div>
              <div v-if="scriptGenerateTime > 0" class="text-xs text-gray-600">
                {{ formatTime(scriptGenerateTime) }}
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                  currentStage >= 2 ? (currentStage > 2 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white') : 'bg-gray-300 text-gray-500']">
                  {{ currentStage > 2 ? '✓' : '2' }}
                </div>
                <span class="text-sm font-medium">生成视频</span>
              </div>
              <div v-if="videoGenerateTime > 0" class="text-xs text-gray-600">
                {{ formatTime(videoGenerateTime) }}
              </div>
            </div>
          </div>

          <!-- 进度提示 -->
          <div v-if="currentStep" class="mb-4 p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
            {{ currentStep }}
          </div>

          <!-- 生成的文案 -->
          <div v-if="generatedScript" class="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 class="text-sm font-semibold mb-2">生成的文案</h3>
            <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ generatedScript }}</p>
          </div>

          <!-- 生成的视频 -->
          <div v-if="generatedVideoUrl">
            <h3 class="text-sm font-semibold mb-2">生成的视频</h3>
            <video
              :src="generatedVideoUrl"
              controls
              class="w-full rounded-lg shadow"
            />
            <div class="mt-3">
              <button
                @click="downloadVideo"
                class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
              >
                下载视频
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail>
      <div class="space-y-4 text-sm text-gray-700">
        <section>
          <h3 class="font-semibold mb-2">功能介绍</h3>
          <p>基于 Agnes AI 的文生视频工具，输入主题自动生成专业视频 Prompt 并创作短视频。支持 5-15 秒时长，多种宽高比选择，24帧流畅播放。</p>
        </section>

        <section>
          <h3 class="font-semibold mb-2">使用说明</h3>
          <ol class="list-decimal list-inside space-y-1">
            <li>在 <a href="https://agnes-ai.com" target="_blank" class="text-blue-500">agnes-ai.com</a> 注册并获取 API Key</li>
            <li>填写 API Key 并保存（已登录保存到服务器，未登录保存到本地）</li>
            <li>输入视频主题，建议描述主体、动作、场景、镜头运动、光照和视觉风格</li>
            <li>选择视频时长（5秒/10秒/15秒）和宽高比（9:16竖屏/16:9横屏/1:1方形等）</li>
            <li>点击生成，系统会先生成英文 Prompt，再提交视频任务并轮询查询进度</li>
            <li>生成完成后可在线预览或下载视频</li>
          </ol>
        </section>

        <section>
          <h3 class="font-semibold mb-2">Prompt 最佳实践</h3>
          <p class="mb-2">建议使用结构：<strong>[主体] + [动作] + [场景] + [镜头运动] + [光照] + [风格]</strong></p>
          <p class="text-gray-600 italic">示例：A young astronaut walking across a red desert planet, dust blowing in the wind, slow cinematic tracking shot, dramatic sunset lighting, realistic sci-fi style</p>
        </section>

        <section>
          <h3 class="font-semibold mb-2">技术参数</h3>
          <ul class="list-disc list-inside space-y-1">
            <li>模型：agnes-video-v2.0</li>
            <li>帧率：固定 24fps</li>
            <li>时长：5秒(121帧) / 10秒(241帧) / 15秒(361帧)</li>
            <li>宽高比：9:16 (720x1280) / 16:9 (1280x720) / 1:1 (1024x1024) / 4:3 (1024x768) / 3:4 (768x1024)</li>
          </ul>
        </section>
      </div>
    </ToolDetail>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { useUserStore } from '@/store/modules/user'
import ApiConfigTab from './ApiConfigTab.vue'
import TextToVideoTab from './TextToVideoTab.vue'
import ImageToVideoTab from './ImageToVideoTab.vue'
import TextToImageTab from './TextToImageTab.vue'
import ImageToImageTab from './ImageToImageTab.vue'
import AiChatTab from './AiChatTab.vue'
import {
  topicExamples,
  videoPromptExamples,
  presetImages,
  durationOptions,
  aspectRatioOptions,
  imagePromptExamples
} from './prompts'
import * as agnesApi from './api'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const apiKey = ref('')
const activeTab = ref<'api-config' | 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image' | 'ai-chat'>('api-config')
const topic = ref('')
const duration = ref(5)
const aspectRatio = ref('9:16')
const autoGeneratePrompt = ref(false) // 是否自动生成提示词

// 每个Tab独立的生成状态
const isGeneratingTextToVideo = ref(false)
const isGeneratingImageToVideo = ref(false)
const isGeneratingTextToImage = ref(false)
const isGeneratingImageToImage = ref(false)

// 每个Tab独立的步骤提示
const currentStepTextToVideo = ref('')
const currentStepImageToVideo = ref('')
const currentStepTextToImage = ref('')
const currentStepImageToImage = ref('')

// 计算属性：当前Tab的生成状态
const isGenerating = computed(() => {
  switch (activeTab.value) {
    case 'text-to-video':
      return isGeneratingTextToVideo.value
    case 'image-to-video':
      return isGeneratingImageToVideo.value
    case 'text-to-image':
      return isGeneratingTextToImage.value
    case 'image-to-image':
      return isGeneratingImageToImage.value
    default:
      return false
  }
})

// 计算属性：当前Tab的步骤提示
const currentStep = computed(() => {
  switch (activeTab.value) {
    case 'text-to-video':
      return currentStepTextToVideo.value
    case 'image-to-video':
      return currentStepImageToVideo.value
    case 'text-to-image':
      return currentStepTextToImage.value
    case 'image-to-image':
      return currentStepImageToImage.value
    default:
      return ''
  }
})

// 文生视频结果
const textToVideoResult = ref({
  script: '',
  videoUrl: '',
  scriptTime: 0,
  videoTime: 0
})

// 图生视频结果
const imageToVideoResult = ref({
  videoUrl: '',
  generateTime: 0
})

// 文生图结果
const textToImageResult = ref({
  images: [] as string[],
  generateTime: 0
})

// 图生图结果
const imageToImageResult = ref({
  images: [] as string[],
  generateTime: 0
})

const currentStageStartTime = ref(0)
const elapsedTimer = ref<number | null>(null)
const currentStage = ref(0) // 0:未开始 1:生成文案 2:生成视频 3:完成
const showVideoModal = ref(false)
const showImageModal = ref(false)
const currentImageUrl = ref('')
const currentImageIndex = ref(0)

// 视频播放相关状态（每个Tab独立）
const videoDurationTextToVideo = ref(0)
const videoDurationImageToVideo = ref(0)
const videoProgressTextToVideo = ref(0)
const videoProgressImageToVideo = ref(0)
const isVideoPlayingTextToVideo = ref(false)
const isVideoPlayingImageToVideo = ref(false)

// 计算属性：当前Tab的视频状态
const videoDuration = computed(() => {
  return activeTab.value === 'text-to-video' ? videoDurationTextToVideo.value : videoDurationImageToVideo.value
})
const videoProgress = computed(() => {
  return activeTab.value === 'text-to-video' ? videoProgressTextToVideo.value : videoProgressImageToVideo.value
})
const isVideoPlaying = computed(() => {
  return activeTab.value === 'text-to-video' ? isVideoPlayingTextToVideo.value : isVideoPlayingImageToVideo.value
})

const videoRef = ref<HTMLVideoElement | null>(null)

// 图生视频相关
const imageMode = ref<'single' | 'double'>('single')
const uploadedImages = ref<string[]>([])
const videoPrompt = ref('')
const isUploading = ref(false)
const autoGenerateImagePrompt = ref(false) // 图生视频是否自动生成提示词

// 文生图相关
const imageModel = ref<'agnes-image-2.1-flash' | 'agnes-image-2.0'>('agnes-image-2.1-flash')
const imagePrompt = ref('')
const imageCount = ref(1)
const imageAspectRatio = ref('9:16')

// 图生图相关
const imageToImageSourceImage = ref('')
const imageToImagePrompt = ref('')
const imageToImageStrength = ref(0.8) // 生成强度，0-1
const imageToImageModel = ref<'agnes-image-2.1-flash' | 'agnes-image-2.0'>('agnes-image-2.1-flash')
const imageToImageCount = ref(1)
const imageToImageAspectRatio = ref('9:16')

// AI对话相关
const chatModel = ref<'agnes-2.0-flash' | 'agnes-2.0'>('agnes-2.0-flash')
const chatInput = ref('')
const chatSessions = ref<Array<{id: string, title: string, messages: Array<{role: 'user' | 'assistant', content: string}>}>>([])
const currentSessionId = ref<string | null>(null)
const isChatting = ref(false)
const chatContainerRef = ref<HTMLDivElement | null>(null)

const currentSession = computed(() => {
  return chatSessions.value.find(s => s.id === currentSessionId.value)
})

// 当前Tab的结果（用于显示）
const generatedScript = computed(() => textToVideoResult.value.script)
const generatedVideoUrl = computed({
  get: () => {
    if (activeTab.value === 'text-to-video') return textToVideoResult.value.videoUrl
    if (activeTab.value === 'image-to-video') return imageToVideoResult.value.videoUrl
    return ''
  },
  set: (val) => {
    if (activeTab.value === 'text-to-video') textToVideoResult.value.videoUrl = val
    if (activeTab.value === 'image-to-video') imageToVideoResult.value.videoUrl = val
  }
})
const scriptGenerateTime = computed(() => textToVideoResult.value.scriptTime)
const videoGenerateTime = computed({
  get: () => {
    if (activeTab.value === 'text-to-video') return textToVideoResult.value.videoTime
    if (activeTab.value === 'image-to-video') return imageToVideoResult.value.generateTime
    return 0
  },
  set: (val) => {
    if (activeTab.value === 'text-to-video') textToVideoResult.value.videoTime = val
    if (activeTab.value === 'image-to-video') imageToVideoResult.value.generateTime = val
  }
})
const generatedImages = computed(() => {
  if (activeTab.value === 'text-to-image') return textToImageResult.value.images
  if (activeTab.value === 'image-to-image') return imageToImageResult.value.images
  return []
})
const imageGenerateTime = computed(() => {
  if (activeTab.value === 'text-to-image') return textToImageResult.value.generateTime
  if (activeTab.value === 'image-to-image') return imageToImageResult.value.generateTime
  return 0
})

const imagePromptExamples = [
  '一位穿着飘逸白裙的少女站在薰衣草花田中，夕阳余晖洒在她的长发上，微风吹动裙摆，背景是连绵的紫色花海和远山，梦幻唯美的油画风格，柔和的光影，浪漫氛围',
  '赛博朋克风格的未来都市夜景，高耸的摩天大楼布满巨型霓虹广告牌，悬浮飞车穿梭空中，街道湿润反射着五彩灯光，细腻的雨滴效果，超现实主义风格，冷色调科技感',
  '一只威严的白狮王站在非洲草原的巨石上仰天长啸，金色晨光从云层中洒下照亮它的鬃毛，远处是辽阔的草原和成群的动物剪影，史诗级写实风格，戏剧性光影',
  '古风中国山水意境，云雾缭绕的青山之间有一座古朴的亭台，身着古装的女子撑着油纸伞独立于石桥上，桃花飘落水面，水墨画风格，空灵诗意',
  '宇宙深处的星云漩涡，璀璨的星光和多彩的星云气体交织，一颗蓝色的行星悬浮其中，周围环绕着小行星带，超高清天文摄影风格，壮丽神秘',
  '温馨的圣诞节场景，壁炉前的客厅摆满礼物和装饰，窗外飘着雪花，一家人围坐在圣诞树旁露出幸福笑容，暖黄灯光，温馨治愈的插画风格',
  '中世纪欧洲城堡全景，城堡矗立在山崖之上，周围是茂密的森林和流淌的河流，城堡高塔飘扬着旗帜，乌云密布天空透出丝缕阳光，史诗级奇幻概念艺术',
  '日式和风庭院，樱花树下的石灯笼和小桥流水，锦鲤在池塘中游动，远处是传统日式建筑和竹林，清晨薄雾弥漫，细腻的日系动画风格，宁静雅致',
  '科幻机甲战士全身像，银白色金属装甲布满蓝色能量纹路，背后展开巨大的能量翼，单膝跪地握着光剑，背景是废墟战场和烟尘，超精细机械设计，硬核科幻风',
  '魔法森林深处，古老巨树环绕着发光的蘑菇群，精灵在空中飞舞留下光迹，树根间流淌着荧光溪流，神秘的蓝紫色调，奇幻插画风格，梦幻迷离',
  '北欧极光下的雪山风光，绚丽的绿色极光在夜空中舞动，雪白的山峰倒映在冰冻的湖面上，远处有一座孤独的小木屋透出温暖灯光，超现实自然摄影风格',
  '蒸汽朋克风格的机械城市，巨大的齿轮和蒸汽管道构成建筑，铜制的飞艇在空中航行，街道上是复古机械装置和穿着维多利亚服饰的人群，复古科幻风格'
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

const randomVideoPrompt = () => {
  videoPrompt.value = videoPromptExamples[Math.floor(Math.random() * videoPromptExamples.length)]
}

const randomImagePrompt = () => {
  imagePrompt.value = imagePromptExamples[Math.floor(Math.random() * imagePromptExamples.length)]
}

const handleImageUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const maxImages = imageMode.value === 'single' ? 1 : 2
  const filesToProcess = Array.from(files).slice(0, maxImages - uploadedImages.value.length)

  isUploading.value = true

  try {
    for (const file of filesToProcess) {
      // 转换为base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // 上传到ImgBB
      const formData = new FormData()
      formData.append('image', base64)

      const response = await fetch('https://api.imgbb.com/1/upload?key=df54760d0a641fb1f8cf178e59b603e4', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('图片上传失败')
      }

      const data = await response.json()
      if (data.success) {
        uploadedImages.value.push(data.data.url)
      }
    }

    ElMessage.success('图片上传成功')
  } catch (error: any) {
    ElMessage.error(error.message || '图片上传失败')
  } finally {
    isUploading.value = false
    // 清空input
    if (target) target.value = ''
  }
}

const removeImage = (index: number) => {
  uploadedImages.value.splice(index, 1)
}

const addPresetImage = (url: string) => {
  const maxImages = imageMode.value === 'single' ? 1 : 2
  if (uploadedImages.value.length >= maxImages) {
    ElMessage.warning(`${imageMode.value === 'single' ? '单图模式只能添加1张' : '双图模式只能添加2张'}图片`)
    return
  }
  uploadedImages.value.push(url)
  ElMessage.success('已添加预设图片')
}

const switchImageMode = (mode: 'single' | 'double') => {
  imageMode.value = mode
  if (mode === 'single' && uploadedImages.value.length > 1) {
    uploadedImages.value = [uploadedImages.value[0]]
  }
}

const switchTab = (tab: 'api-config' | 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image' | 'ai-chat') => {
  activeTab.value = tab
  // 不清空结果，保持各Tab独立
  currentStage.value = 0
  // currentStep现在是computed属性，由各Tab独立状态计算得出，不需要手动清空

  // 更新URL参数
  router.replace({
    query: {
      ...route.query,
      tab
    }
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sendChatMessage = async () => {
  if (isChatting.value) {
    return // 发送中时不允许再次发送
  }

  if (!apiKey.value.trim()) {
    ElMessage.warning('请先填写并保存API Key')
    return
  }

  if (!chatInput.value.trim()) {
    ElMessage.warning('请输入消息')
    return
  }

  // 如果没有当前会话，创建新会话
  if (!currentSessionId.value) {
    createNewSession()
  }

  const currentSession = chatSessions.value.find(s => s.id === currentSessionId.value)
  if (!currentSession) return

  const userMessage = chatInput.value.trim()
  chatInput.value = ''

  // 添加用户消息
  currentSession.messages.push({
    role: 'user',
    content: userMessage
  })

  // 添加一个空的AI消息占位
  const aiMessageIndex = currentSession.messages.length
  currentSession.messages.push({
    role: 'assistant',
    content: ''
  })

  // 滚动到底部
  setTimeout(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  }, 100)

  isChatting.value = true

  try {
    const response = await fetch('/api/agnes-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.value.trim()}`
      },
      body: JSON.stringify({
        model: chatModel.value,
        messages: currentSession.messages.slice(0, -1), // 不包含空的AI消息
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || '对话失败')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('无法获取响应流')
    }

    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            const content = json.choices[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              currentSession.messages[aiMessageIndex].content = fullContent

              // 实时滚动到底部
              setTimeout(() => {
                if (chatContainerRef.value) {
                  chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
                }
              }, 10)
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    // 更新会话标题（用第一条用户消息）
    if (currentSession.messages.length === 2 && currentSession.title === '新对话') {
      currentSession.title = userMessage.slice(0, 20) + (userMessage.length > 20 ? '...' : '')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '对话失败')
    // 移除刚才添加的用户消息和AI消息
    currentSession.messages.pop()
    currentSession.messages.pop()
  } finally {
    isChatting.value = false
  }
}

const createNewSession = () => {
  const newSession = {
    id: Date.now().toString(),
    title: '新对话',
    messages: []
  }
  chatSessions.value.unshift(newSession)
  currentSessionId.value = newSession.id
}

const selectSession = (sessionId: string) => {
  currentSessionId.value = sessionId
}

const deleteSession = (sessionId: string) => {
  const index = chatSessions.value.findIndex(s => s.id === sessionId)
  if (index !== -1) {
    chatSessions.value.splice(index, 1)
    if (currentSessionId.value === sessionId) {
      currentSessionId.value = chatSessions.value[0]?.id || null
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const clearChat = () => {
  if (currentSessionId.value) {
    const session = chatSessions.value.find(s => s.id === currentSessionId.value)
    if (session) {
      session.messages = []
      ElMessage.success('当前对话已清空')
    }
  }
}

const copyMessage = (content: string) => {
  navigator.clipboard.writeText(content).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const renderMarkdown = (content: string) => {
  return md.render(content)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const generateTextToImage = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请先填写并保存API Key')
    return
  }

  if (!imagePrompt.value.trim()) {
    ElMessage.warning('请输入图片描述')
    return
  }

  isGeneratingTextToImage.value = true
  textToImageResult.value.images = []
  textToImageResult.value.generateTime = 0

  try {
    currentStageStartTime.value = Date.now()
    startElapsedTimer('正在生成图片', 'text-to-image')

    const images = await agnesApi.generateImage({
      apiKey: apiKey.value.trim(),
      model: imageModel.value,
      prompt: imagePrompt.value.trim(),
      aspectRatio: imageAspectRatio.value,
      count: imageCount.value,
      aspectRatioOptions
    })

    textToImageResult.value.images = images

    stopElapsedTimer()
    textToImageResult.value.generateTime = Math.round((Date.now() - currentStageStartTime.value) / 1000)
    currentStepTextToImage.value = `图片生成完成！耗时 ${formatTime(textToImageResult.value.generateTime)}`
    ElMessage.success('图片生成成功')
  } catch (error: any) {
    stopElapsedTimer()
    ElMessage.error(error.message || '生成失败')
    currentStepTextToImage.value = `生成失败: ${error.message || '未知错误'}`
    console.error('文生图错误:', error)
  } finally {
    isGeneratingTextToImage.value = false
  }
}

const downloadImage = (url: string, index: number) => {
  const a = document.createElement('a')
  a.href = url
  a.download = `image_${index + 1}_${Date.now()}.png`
  a.click()
}

const handleShowImageModal = (url: string, index: number) => {
  currentImageUrl.value = url
  currentImageIndex.value = index
  showImageModal.value = true
}

// 图生图相关函数
const handleImageToImageUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploading.value = true

  try {
    // 转换为base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve((e.target?.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    // 上传到ImgBB
    const formData = new FormData()
    formData.append('image', base64)

    const response = await fetch('https://api.imgbb.com/1/upload?key=df54760d0a641fb1f8cf178e59b603e4', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('图片上传失败')
    }

    const data = await response.json()
    if (data.success) {
      imageToImageSourceImage.value = data.data.url
      ElMessage.success('图片上传成功')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '图片上传失败')
  } finally {
    isUploading.value = false
    if (target) target.value = ''
  }
}

const removeSourceImage = () => {
  imageToImageSourceImage.value = ''
}

const generateImageToImage = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请先填写并保存API Key')
    return
  }

  if (!imageToImageSourceImage.value) {
    ElMessage.warning('请先上传参考图片')
    return
  }

  if (!imageToImagePrompt.value.trim()) {
    ElMessage.warning('请输入修改描述')
    return
  }

  isGeneratingImageToImage.value = true
  imageToImageResult.value.images = []
  imageToImageResult.value.generateTime = 0

  try {
    currentStageStartTime.value = Date.now()
    startElapsedTimer('正在生成图片', 'image-to-image')

    const images = await agnesApi.editImage({
      apiKey: apiKey.value.trim(),
      model: imageToImageModel.value,
      sourceImage: imageToImageSourceImage.value,
      prompt: imageToImagePrompt.value.trim(),
      strength: imageToImageStrength.value,
      aspectRatio: imageToImageAspectRatio.value,
      count: imageToImageCount.value,
      aspectRatioOptions
    })

    imageToImageResult.value.images = images

    stopElapsedTimer()
    imageToImageResult.value.generateTime = Math.round((Date.now() - currentStageStartTime.value) / 1000)
    currentStepImageToImage.value = `图片生成完成！耗时 ${formatTime(imageToImageResult.value.generateTime)}`
    ElMessage.success('图片生成成功')
  } catch (error: any) {
    stopElapsedTimer()
    ElMessage.error(error.message || '生成失败')
    currentStepImageToImage.value = `生成失败: ${error.message || '未知错误'}`
    console.error('图生图错误:', error)
  } finally {
    isGeneratingImageToImage.value = false
  }
}

onMounted(() => {
  const stored = localStorage.getItem('agnes_api_key')
  if (stored) apiKey.value = stored

  // 从URL恢复Tab状态
  const tabFromUrl = route.query.tab as string
  if (tabFromUrl && ['api-config', 'text-to-video', 'image-to-video', 'text-to-image', 'image-to-image', 'ai-chat'].includes(tabFromUrl)) {
    activeTab.value = tabFromUrl as any
  }

  // AI对话默认创建一个会话
  if (chatSessions.value.length === 0) {
    createNewSession()
  }
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

const startElapsedTimer = (stage: string, tab: 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image') => {
  if (elapsedTimer.value) {
    clearInterval(elapsedTimer.value)
  }
  currentStageStartTime.value = Date.now()
  elapsedTimer.value = window.setInterval(() => {
    const elapsed = Math.round((Date.now() - currentStageStartTime.value) / 1000)
    const stepText = `${stage} (已耗时 ${elapsed}秒)...`

    // 根据Tab更新对应的状态
    switch (tab) {
      case 'text-to-video':
        currentStepTextToVideo.value = stepText
        break
      case 'image-to-video':
        currentStepImageToVideo.value = stepText
        break
      case 'text-to-image':
        currentStepTextToImage.value = stepText
        break
      case 'image-to-image':
        currentStepImageToImage.value = stepText
        break
    }
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

  isGeneratingTextToVideo.value = true
  textToVideoResult.value.script = ''
  textToVideoResult.value.videoUrl = ''
  textToVideoResult.value.scriptTime = 0
  textToVideoResult.value.videoTime = 0
  currentStage.value = 0

  try {
    let script = topic.value.trim()

    // 根据开关决定是否生成提示词
    if (autoGeneratePrompt.value) {
      currentStage.value = 1
      startElapsedTimer('正在生成视频文案', 'text-to-video')

      script = await agnesApi.generateOptimizedPrompt(apiKey.value.trim(), topic.value.trim())

      stopElapsedTimer()
      textToVideoResult.value.scriptTime = Math.round((Date.now() - currentStageStartTime.value) / 1000)
      textToVideoResult.value.script = script
    } else {
      textToVideoResult.value.script = script
      textToVideoResult.value.scriptTime = 0
    }

    // 第二步：生成视频
    currentStage.value = 2
    startElapsedTimer('正在生成视频', 'text-to-video')

    const selectedDuration = durationOptions.find(d => d.value === duration.value)!
    const selectedAspectRatio = aspectRatioOptions.find(r => r.value === aspectRatio.value)!

    // 提交任务
    const videoId = await agnesApi.submitVideoTask(
      apiKey.value.trim(),
      script,
      selectedDuration.frames,
      selectedAspectRatio.width,
      selectedAspectRatio.height
    )

    // 轮询状态（不更新currentStep，让计时器继续显示）
    const videoUrl = await agnesApi.pollVideoStatus(
      apiKey.value.trim(),
      videoId,
      (status) => {
        // 轮询时不更新currentStep，保持计时器显示
        // currentStep由startElapsedTimer控制
      }
    )

    stopElapsedTimer()
    textToVideoResult.value.videoTime = Math.round((Date.now() - currentStageStartTime.value) / 1000)
    textToVideoResult.value.videoUrl = videoUrl

    currentStage.value = 3
    currentStepTextToVideo.value = `视频生成完成！`
    ElMessage.success('视频生成成功')
  } catch (error: any) {
    stopElapsedTimer()
    ElMessage.error(error.message || '生成失败')
    currentStepTextToVideo.value = `生成失败: ${error.message || '未知错误'}`
    console.error('文生视频错误:', error)
  } finally {
    isGeneratingTextToVideo.value = false
  }
}

// 删除旧的generateScript和generateVideoFromScript函数，已迁移到api.ts

const downloadVideo = () => {
  const a = document.createElement('a')
  a.href = generatedVideoUrl.value
  a.download = `video_${Date.now()}.mp4`
  a.click()
}

const handleVideoLoaded = (event: Event) => {
  const video = event.target as HTMLVideoElement
  const duration = Math.round(video.duration)

  // 根据当前Tab更新对应的状态
  if (activeTab.value === 'text-to-video') {
    videoDurationTextToVideo.value = duration
  } else if (activeTab.value === 'image-to-video') {
    videoDurationImageToVideo.value = duration
  }
}

const handleVideoTimeUpdate = (event: Event) => {
  const video = event.target as HTMLVideoElement
  if (video.duration > 0) {
    const progress = (video.currentTime / video.duration) * 100

    // 根据当前Tab更新对应的状态
    if (activeTab.value === 'text-to-video') {
      videoProgressTextToVideo.value = progress
    } else if (activeTab.value === 'image-to-video') {
      videoProgressImageToVideo.value = progress
    }
  }
}

const handleVideoMouseEnter = (event: Event) => {
  const video = event.target as HTMLVideoElement

  // 根据当前Tab更新对应的状态
  if (activeTab.value === 'text-to-video') {
    isVideoPlayingTextToVideo.value = true
  } else if (activeTab.value === 'image-to-video') {
    isVideoPlayingImageToVideo.value = true
  }

  video.play()
}

const handleVideoMouseLeave = (event: Event) => {
  const video = event.target as HTMLVideoElement

  // 根据当前Tab更新对应的状态
  if (activeTab.value === 'text-to-video') {
    isVideoPlayingTextToVideo.value = false
    videoProgressTextToVideo.value = 0
  } else if (activeTab.value === 'image-to-video') {
    isVideoPlayingImageToVideo.value = false
    videoProgressImageToVideo.value = 0
  }

  video.pause()
  video.currentTime = 0
}

const generateImageToVideo = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请先填写并保存API Key')
    return
  }

  if (uploadedImages.value.length === 0) {
    ElMessage.warning('请先上传图片')
    return
  }

  if (imageMode.value === 'double' && uploadedImages.value.length < 2) {
    ElMessage.warning('双图模式需要上传2张图片')
    return
  }

  if (!videoPrompt.value.trim()) {
    ElMessage.warning('请输入视频描述')
    return
  }

  isGeneratingImageToVideo.value = true
  imageToVideoResult.value.videoUrl = ''
  imageToVideoResult.value.generateTime = 0
  currentStage.value = 0

  try {
    let finalPrompt = videoPrompt.value.trim()

    // 如果开启优化，先生成提示词
    if (autoGenerateImagePrompt.value) {
      currentStage.value = 1
      startElapsedTimer('正在优化视频描述', 'image-to-video')

      finalPrompt = await agnesApi.generateOptimizedPrompt(apiKey.value.trim(), videoPrompt.value.trim())

      stopElapsedTimer()
    }

    // 生成视频
    currentStage.value = 2
    startElapsedTimer('正在生成视频', 'image-to-video')

    const selectedDuration = durationOptions.find(d => d.value === duration.value)!
    const selectedAspectRatio = aspectRatioOptions.find(r => r.value === aspectRatio.value)!

    // 提交任务
    const videoId = await agnesApi.submitVideoTask(
      apiKey.value.trim(),
      finalPrompt,
      selectedDuration.frames,
      selectedAspectRatio.width,
      selectedAspectRatio.height,
      uploadedImages.value
    )

    // 轮询状态（不更新currentStep，让计时器继续显示）
    const videoUrl = await agnesApi.pollVideoStatus(
      apiKey.value.trim(),
      videoId,
      (status) => {
        // 轮询时不更新currentStep，保持计时器显示
        // currentStep由startElapsedTimer控制
      }
    )

    stopElapsedTimer()
    imageToVideoResult.value.generateTime = Math.round((Date.now() - currentStageStartTime.value) / 1000)
    imageToVideoResult.value.videoUrl = videoUrl

    currentStage.value = 3
    currentStepImageToVideo.value = '视频生成完成！'
    ElMessage.success('视频生成成功')
  } catch (error: any) {
    stopElapsedTimer()
    ElMessage.error(error.message || '生成失败')
    currentStepImageToVideo.value = `生成失败: ${error.message || '未知错误'}`
    console.error('图生视频错误:', error)
  } finally {
    isGeneratingImageToVideo.value = false
  }
}
</script>

<template>
  <div>
    <DetailHeader title="AI文生视频" :id="1" />

    <div class="bg-white rounded-2xl p-6 shadow-sm">
      <!-- 左右布局：左侧Tab，右侧内容 -->
      <div class="flex gap-6">
        <!-- 左侧Tab导航 -->
        <div class="w-48 flex-shrink-0">
          <div class="flex flex-col gap-2">
            <button
              @click="switchTab('api-config')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left',
                activeTab === 'api-config'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🔑 API配置
            </button>
            <button
              @click="switchTab('text-to-video')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left',
                activeTab === 'text-to-video'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🎬 文生视频
            </button>
            <button
              @click="switchTab('image-to-video')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left',
                activeTab === 'image-to-video'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🖼️ 图生视频
            </button>
            <button
              @click="switchTab('text-to-image')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left',
                activeTab === 'text-to-image'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🎨 文生图
            </button>
            <button
              @click="switchTab('image-to-image')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left',
                activeTab === 'image-to-image'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🎭 图生图
            </button>
            <button
              @click="switchTab('ai-chat')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left',
                activeTab === 'ai-chat'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              💬 AI对话
            </button>
          </div>
        </div>

        <!-- 右侧内容区域 -->
        <div class="flex-1 min-w-0">
          <!-- API配置Tab -->
          <ApiConfigTab
            v-if="activeTab === 'api-config'"
            v-model:apiKey="apiKey"
            :isLoggedIn="!!userStore.user?.uid"
            @save="saveApiKey"
          />

          <!-- 文生视频Tab -->
          <TextToVideoTab
            v-if="activeTab === 'text-to-video'"
            v-model:topic="topic"
            v-model:duration="duration"
            v-model:aspectRatio="aspectRatio"
            v-model:autoOptimize="autoGeneratePrompt"
            :isGenerating="isGenerating"
            :currentStage="currentStage"
            :currentStep="currentStep"
            :generatedScript="generatedScript"
            :generatedVideoUrl="generatedVideoUrl"
            :scriptGenerateTime="scriptGenerateTime"
            :videoGenerateTime="videoGenerateTime"
            :videoDuration="videoDuration"
            :videoProgress="videoProgress"
            :isVideoPlaying="isVideoPlaying"
            @random-topic="randomTopic"
            @generate="generateVideo"
            @download-video="downloadVideo"
            @show-video-modal="showVideoModal = true"
            @video-loaded="handleVideoLoaded"
            @video-timeupdate="handleVideoTimeUpdate"
            @video-mouseenter="handleVideoMouseEnter"
            @video-mouseleave="handleVideoMouseLeave"
          />

          <!-- 图生视频Tab -->
          <ImageToVideoTab
            v-if="activeTab === 'image-to-video'"
            v-model:imageMode="imageMode"
            v-model:videoPrompt="videoPrompt"
            v-model:duration="duration"
            v-model:aspectRatio="aspectRatio"
            v-model:autoOptimize="autoGenerateImagePrompt"
            :uploadedImages="uploadedImages"
            :isGenerating="isGenerating"
            :isUploading="isUploading"
            :currentStage="currentStage"
            :currentStep="currentStep"
            :generatedVideoUrl="generatedVideoUrl"
            :videoGenerateTime="videoGenerateTime"
            :videoDuration="videoDuration"
            :videoProgress="videoProgress"
            :isVideoPlaying="isVideoPlaying"
            @upload="handleImageUpload"
            @remove-image="removeImage"
            @add-preset="addPresetImage"
            @random-prompt="randomVideoPrompt"
            @generate="generateImageToVideo"
            @download-video="downloadVideo"
            @show-video-modal="showVideoModal = true"
            @video-loaded="handleVideoLoaded"
            @video-timeupdate="handleVideoTimeUpdate"
            @video-mouseenter="handleVideoMouseEnter"
            @video-mouseleave="handleVideoMouseLeave"
          />

          <!-- 文生图Tab -->
          <TextToImageTab
            v-if="activeTab === 'text-to-image'"
            v-model:model="imageModel"
            v-model:prompt="imagePrompt"
            v-model:aspectRatio="imageAspectRatio"
            v-model:count="imageCount"
            :isGenerating="isGenerating"
            :currentStep="currentStep"
            :generatedImages="generatedImages"
            :generateTime="imageGenerateTime"
            @random="randomImagePrompt"
            @generate="generateTextToImage"
            @download-image="downloadImage"
            @show-image-modal="handleShowImageModal"
          />

          <!-- 图生图Tab -->
          <ImageToImageTab
            v-if="activeTab === 'image-to-image'"
            :sourceImage="imageToImageSourceImage"
            v-model:model="imageToImageModel"
            v-model:prompt="imageToImagePrompt"
            v-model:strength="imageToImageStrength"
            v-model:aspectRatio="imageToImageAspectRatio"
            v-model:count="imageToImageCount"
            :isGenerating="isGenerating"
            :isUploading="isUploading"
            :currentStep="currentStep"
            :generatedImages="imageToImageResult.images"
            :generateTime="imageToImageResult.generateTime"
            @upload="handleImageToImageUpload"
            @remove="removeSourceImage"
            @generate="generateImageToImage"
            @download-image="downloadImage"
            @show-image-modal="handleShowImageModal"
          />

          <!-- AI对话Tab -->
          <AiChatTab
            v-if="activeTab === 'ai-chat'"
            :sessions="chatSessions"
            :currentSessionId="currentSessionId"
            :currentSession="currentSession"
            v-model:chatModel="chatModel"
            v-model:chatInput="chatInput"
            :isChatting="isChatting"
            :chatContainerRef="chatContainerRef"
            @new-session="createNewSession"
            @select-session="selectSession"
            @delete-session="deleteSession"
            @send-message="sendChatMessage"
          />
        </div>

        <!-- 右侧：结果显示区域（非AI对话Tab时显示，已移到各Tab组件内） -->
        <!-- 注意：为了保持兼容，这里保留了，但实际上各Tab组件内部已经包含了结果显示 -->
      </div>
    </div>

    <!-- 视频放大模态框 -->
    <div
      v-if="showVideoModal"
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      @click="showVideoModal = false"
    >
      <div class="relative max-w-4xl max-h-[90vh] w-full" @click.stop>
        <button
          @click="showVideoModal = false"
          class="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300"
        >
          ✕
        </button>
        <video
          :src="generatedVideoUrl"
          controls
          autoplay
          class="w-full max-h-[85vh] rounded-lg shadow-2xl"
        />
      </div>
    </div>

    <!-- 图片放大模态框 -->
    <div
      v-if="showImageModal"
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      @click="showImageModal = false"
    >
      <div class="relative max-w-4xl max-h-[90vh] w-full" @click.stop>
        <button
          @click="showImageModal = false"
          class="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300"
        >
          ✕
        </button>
        <img
          :src="currentImageUrl"
          class="w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        <div class="absolute -bottom-10 left-0 right-0 text-center text-white text-sm">
          图片 {{ currentImageIndex + 1 }}
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

<style scoped>
.markdown-body {
  line-height: 1.6;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.markdown-body h1 {
  font-size: 1.5em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.3em;
}

.markdown-body h2 {
  font-size: 1.3em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.3em;
}

.markdown-body h3 {
  font-size: 1.1em;
}

.markdown-body p {
  margin-bottom: 0.5em;
}

.markdown-body ul,
.markdown-body ol {
  margin-left: 1.5em;
  margin-bottom: 0.5em;
}

.markdown-body li {
  margin-bottom: 0.25em;
}

.markdown-body code {
  background-color: #f3f4f6;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.markdown-body pre {
  background-color: #1f2937;
  color: #f3f4f6;
  padding: 1em;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 0.5em;
}

.markdown-body pre code {
  background-color: transparent;
  padding: 0;
  color: inherit;
}

.markdown-body blockquote {
  border-left: 4px solid #e5e7eb;
  padding-left: 1em;
  margin-left: 0;
  color: #6b7280;
  margin-bottom: 0.5em;
}

.markdown-body table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 0.5em;
}

.markdown-body table th,
.markdown-body table td {
  border: 1px solid #e5e7eb;
  padding: 0.5em;
}

.markdown-body table th {
  background-color: #f3f4f6;
  font-weight: 600;
}

.markdown-body a {
  color: #3b82f6;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1em 0;
}
</style>

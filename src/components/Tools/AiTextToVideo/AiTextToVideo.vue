<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { useUserStore } from '@/store/modules/user'
import TextToVideoTab from './TextToVideoTab.vue'
import ImageToVideoTab from './ImageToVideoTab.vue'
import TextToImageTab from './TextToImageTab.vue'
import ImageToImageTab from './ImageToImageTab.vue'
import AiChatTab from './AiChatTab.vue'
import AppsTab from './AppsTab.vue'
import CustomAppChat from './CustomAppChat.vue'
import DreamAnalysisApp from './DreamAnalysisApp.vue'
import CityGuideApp from './CityGuideApp.vue'
import PetAvatarApp from './PetAvatarApp.vue'
import BlessingsGeneratorApp from './BlessingsGeneratorApp.vue'
import CopywritingAssistantApp from './CopywritingAssistantApp.vue'
import IdPhotoApp from './IdPhotoApp.vue'
import AdditiveHazardApp from './AdditiveHazardApp.vue'
import MedicineGuideApp from './MedicineGuideApp.vue'
import ContractRiskApp from './ContractRiskApp.vue'
import FoodCalorieApp from './FoodCalorieApp.vue'
import ModelConfigTab from './ModelConfigTab.vue'
import { useUserModels } from './composables/useUserModels'
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
const userModels = useUserModels()
const route = useRoute()
const router = useRouter()

const activeTab = ref<'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image' | 'ai-chat' | 'apps' | 'model-config'>('text-to-video')
const tabContainerRef = ref<HTMLDivElement | null>(null)

// 兼容旧版：仍可能从 localStorage 读到旧的 Agnes API Key
// 新版应通过 ⚙️ 模型配置 Tab 的厂商编辑设置
const legacyApiKey = ref('')

// 应用Tab状态
const currentApp = ref<string | null>(null)
const customAppData = ref<any>(null) // 存储自建应用的完整数据

// 有独立 Vue 组件的命名系统应用（无需 customAppData）
const NAMED_SYSTEM_APPS = [
  'dream-analysis', 'city-guide', 'pet-avatar', 'blessings-generator',
  'copywriting-assistant', 'id-photo', 'additive-hazard', 'medicine-guide',
  'contract-risk', 'food-calorie'
]
const isNamedSystemApp = (appId: string) => NAMED_SYSTEM_APPS.includes(appId)
const dreamInput = ref('')
const dreamResult = ref('')
const dreamStreamingContent = ref('')
const isDreamAnalyzing = ref(false)
const dreamChatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])
const cityInput = ref('')
const cityResult = ref('')
const cityStreamingContent = ref('')
const isCityGenerating = ref(false)
const cityChatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])
const petImage = ref('')
const petStyle = ref('anime')
const petGeneratedImage = ref('')
const isPetGenerating = ref(false)

// 祝福语生成器状态
const blessingsOccasion = ref('birthday')
const blessingsTarget = ref('friend')
const blessingsStyle = ref('warm')
const blessingsFollowUpQuestion = ref('')
const blessingsResult = ref('')
const blessingsStreamingContent = ref('')
const isBlessingsGenerating = ref(false)
const blessingsChatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])

// 智能文案助手状态
const copyType = ref('product')
const copyPlatform = ref('wechat')
const copyTopic = ref('')
const copyResult = ref('')
const copyStreamingContent = ref('')
const isCopyGenerating = ref(false)
const copyChatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])

// AI证件照状态
const idPhotoImage = ref('')
const idPhotoColor = ref('blue')
const idPhotoSize = ref('1inch')
const idPhotoGenerated = ref('')
const isIdPhotoGenerating = ref(false)

// 添加剂危害查询状态
const additiveInput = ref('')
const additiveResult = ref('')
const additiveStreamingContent = ref('')
const isAdditiveQuerying = ref(false)
const additiveChatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])

// 药品说明书解读状态
const medicineInput = ref('')
const medicineUploadedImage = ref('')
const medicineResult = ref('')
const medicineStreamingContent = ref('')
const isMedicineQuerying = ref(false)
const medicineChatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string; image?: string }>>([])

// 合同风险检测状态
const contractInput = ref('')
const contractType = ref('rental')
const contractUploadedImage = ref('')
const contractResult = ref('')
const contractStreamingContent = ref('')
const isContractAnalyzing = ref(false)
const contractChatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string; image?: string }>>([])

// 食物热量识别状态
const foodInput = ref('')
const foodPortion = ref('')
const foodUploadedImage = ref('')
const foodResult = ref('')
const foodStreamingContent = ref('')
const isFoodQuerying = ref(false)
const foodChatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string; image?: string }>>([])


const topic = ref('')
const duration = ref(5)
const aspectRatio = ref('9:16')
const autoGeneratePrompt = ref(false) // 是否自动生成提示词

// 用户自定义 API Key（按 provider slug 分组，存 localStorage）
const userApiKeys = ref<Record<string, string>>({})
const newApiKeyProviderSlug = ref('')
const newApiKeyValue = ref('')
const userApiKeyCount = computed(() => Object.keys(userApiKeys.value).length)

// 开放用户 Key 的厂商列表（来自后端 /api/open-providers，游客也能拿到）
const openProviders = ref<Array<{ id: number; slug: string; name: string; icon?: string; description?: string }>>([])

function loadUserApiKeys() {
  try {
    const raw = localStorage.getItem('ai_user_api_keys_by_provider')
    userApiKeys.value = raw ? JSON.parse(raw) : {}
  } catch {
    userApiKeys.value = {}
  }
}

async function loadOpenProviders() {
  try {
    const res = await fetch('/api/open-providers')
    const json = await res.json()
    if (json.success) {
      openProviders.value = json.data || []
    }
  } catch {
    openProviders.value = []
  }
}

function saveUserApiKey() {
  const slug = newApiKeyProviderSlug.value.trim()
  if (!slug) {
    ElMessage.warning('请选择厂商')
    return
  }
  if (!newApiKeyValue.value.trim()) {
    ElMessage.warning('API Key 不能为空')
    return
  }
  userApiKeys.value = { ...userApiKeys.value, [slug]: newApiKeyValue.value.trim() }
  localStorage.setItem('ai_user_api_keys_by_provider', JSON.stringify(userApiKeys.value))
  ElMessage.success(`已保存厂商 Key：${slug}`)
  newApiKeyProviderSlug.value = ''
  newApiKeyValue.value = ''
}

function deleteUserApiKey(slug: string) {
  const next = { ...userApiKeys.value }
  delete next[slug]
  userApiKeys.value = next
  localStorage.setItem('ai_user_api_keys_by_provider', JSON.stringify(next))
  ElMessage.success(`已删除厂商 Key：${slug}`)
}

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

// 应用Tab处理函数
const selectApp = (app: string, appData?: any) => {
  currentApp.value = app
  customAppData.value = appData || null

  // 同步URL：保留其他query参数，只更新/添加 app
  router.replace({
    query: {
      ...route.query,
      app
    }
  })
}

const backToAppList = () => {
  currentApp.value = null
  customAppData.value = null

  // 同步URL：删除 app 参数
  const newQuery = { ...route.query }
  delete newQuery.app
  router.replace({ query: newQuery })
}

const analyzeDream = async () => {
  
  if (!dreamInput.value.trim()) {
    ElMessage.warning('请描述你的梦境')
    return
  }

  // 保存用户消息
  dreamChatMessages.value.push({
    role: 'user',
    content: dreamInput.value
  })

  isDreamAnalyzing.value = true
  dreamStreamingContent.value = ''

  try {
    let result: string
    const isFollowUp = dreamChatMessages.value.length > 1

    if (isFollowUp) {
      // 追问：使用对话历史
      const messages = dreamChatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: '',
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          dreamStreamingContent.value = content
        }
      )
    } else {
      // 首次查询：使用详细提示词
      const prompt = `请作为专业的梦境分析师，对以下梦境进行双重解析。请使用Markdown格式输出，包含标题、列表等格式。

梦境描述：${dreamInput.value}

请按以下格式返回完整的解析：

## 一、弗洛伊德精神分析视角

从以下角度深入分析：
- **潜意识含义**：梦境符号的深层心理意义
- **象征解读**：关键元素的象征意义
- **心理动机**：梦境反映的内心需求和冲突

## 二、周公解梦视角

从传统文化角度解读：
- **传统解读**：古典解梦的文化解释
- **吉凶预示**：梦境的征兆意义
- **民俗寓意**：相关的文化象征

## 三、综合建议

结合两种体系给出实用建议：
- **心理调适**：如何理解和处理梦境传递的信息
- **生活指引**：对现实生活的启发和建议
- **关注重点**：需要特别注意的方面

请用温和、专业的语气，给出深入但易懂的解析。使用Markdown格式，让内容更清晰易读。`

      result = await agnesApi.sendChatMessageStream(
        '',
        prompt,
        'agnes-2.0-flash',
        (content) => {
          dreamStreamingContent.value = content
        }
      )
    }

    // 保存AI回复
    dreamChatMessages.value.push({
      role: 'assistant',
      content: result
    })

    // 清空输入
    dreamInput.value = ''

    ElMessage.success(isFollowUp ? '回答完成' : '解梦完成')
  } catch (error: any) {
    // 移除失败的用户消息
    dreamChatMessages.value.pop()
    ElMessage.error('解梦失败: ' + (error.message || '未知错误'))
  } finally {
    isDreamAnalyzing.value = false
    dreamStreamingContent.value = ''
  }
}

// 清空解梦对话历史
const clearDreamHistory = () => {
  dreamChatMessages.value = []
  dreamInput.value = ''
  dreamStreamingContent.value = ''
}

// 开始新解梦话题
const newDreamTopic = () => {
  clearDreamHistory()
}


const generateCityGuide = async () => {
  
  if (!cityInput.value.trim()) {
    ElMessage.warning('请输入城市名称')
    return
  }

  // 判断是追问还是首次生成
  const isFollowUp = cityChatMessages.value.length > 0

  isCityGenerating.value = true
  cityStreamingContent.value = ''

  try {
    let result: string

    if (isFollowUp) {
      // 追问：添加用户消息
      cityChatMessages.value.push({
        role: 'user',
        content: cityInput.value
      })

      // 使用对话历史
      const messages = cityChatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: '',
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          cityStreamingContent.value = content
        }
      )
    } else {
      // 首次生成：使用详细提示词
      const prompt = `请作为专业的旅游规划师，为"${cityInput.value}"这个城市提供详细的旅行指南。请使用Markdown格式输出，包含标题、列表、加粗等格式。

请按以下结构返回完整的指南：

## 一、城市概览

- **地理位置**：城市的地理坐标和区域位置
- **气候特点**：四季气候特征
- **最佳旅行时间**：推荐的旅游季节及理由

## 二、历史文化

- **发展历史**：城市的历史沿革和重要时期
- **文化特色**：独特的文化传统和民俗
- **著名历史事件**：对城市影响深远的历史事件

## 三、必去景点

推荐至少5个景点，每个包含：
1. **景点名称**
   - 简介：景点的历史和特色
   - 游览建议：参观时间、门票、注意事项
   - 亮点：不容错过的看点

## 四、美食推荐

- **特色美食**：当地代表性菜品和小吃
- **推荐餐厅**：知名餐厅或美食街
- **美食体验**：独特的用餐文化

## 五、旅行建议

- **交通方式**：如何到达和市内交通
- **住宿推荐**：不同档次的住宿区域建议
- **注意事项**：安全、礼仪、消费等提示
- **实用小贴士**：省钱、避坑的经验分享

请用生动、专业的语气，提供实用且有深度的信息。使用Markdown格式让内容结构清晰。`

      // 保存用户消息
      cityChatMessages.value.push({
        role: 'user',
        content: cityInput.value
      })

      result = await agnesApi.sendChatMessageStream(
        '',
        prompt,
        'agnes-2.0-flash',
        (content) => {
          cityStreamingContent.value = content
        }
      )
    }

    // 保存AI回复
    cityChatMessages.value.push({
      role: 'assistant',
      content: result
    })

    // 清空输入
    cityInput.value = ''

    ElMessage.success('城市指南生成完成')
  } catch (error: any) {
    ElMessage.error('生成失败: ' + (error.message || '未知错误'))
    // 失败时移除刚添加的用户消息
    if (cityChatMessages.value.length > 0) {
      cityChatMessages.value.pop()
    }
  } finally {
    isCityGenerating.value = false
    cityStreamingContent.value = ''
  }
}

const clearCityHistory = () => {
  cityChatMessages.value = []
  cityStreamingContent.value = ''
  cityInput.value = ''
}

const newCityTopic = () => {
  clearCityHistory()
  ElMessage.success('已开启新话题')
}

const generatePetAvatar = async () => {
  
  if (!petImage.value) {
    ElMessage.warning('请先上传宠物照片')
    return
  }

  isPetGenerating.value = true
  try {
    const styleMap: Record<string, string> = {
      'anime': 'Transform into Japanese anime style with big expressive eyes, cute features, vibrant colors, and clean line art while preserving the pet\'s key characteristics',
      'cartoon': 'Transform into American cartoon style with exaggerated expressions, bold outlines, playful features, and vibrant colors while keeping the pet recognizable',
      'pixel': 'Transform into 8-bit pixel art style with retro game aesthetics, limited color palette, and blocky pixelated appearance while maintaining the pet\'s main features',
      'watercolor': 'Transform into watercolor painting style with soft brush strokes, gentle color blending, artistic textures, and dreamy atmosphere while preserving the pet\'s essence'
    }

    const prompt = styleMap[petStyle.value]

    // 调用图生图API
    const result = await agnesApi.generateImageToImage(
      '',
      petImage.value,
      prompt
    )

    if (result.images && result.images.length > 0) {
      petGeneratedImage.value = result.images[0]
      ElMessage.success('头像生成完成')
    }
  } catch (error: any) {
    ElMessage.error('生成失败: ' + (error.message || '未知错误'))
  } finally {
    isPetGenerating.value = false
  }
}

const downloadPetAvatar = () => {
  if (!petGeneratedImage.value) return

  const link = document.createElement('a')
  link.href = petGeneratedImage.value
  link.download = `pet-avatar-${Date.now()}.png`
  link.click()
  ElMessage.success('下载成功')
}

const usePetPreset = (url: string) => {
  petImage.value = url
}

// 祝福语生成器
const generateBlessings = async () => {
  
  // 判断是追问还是首次生成
  const isFollowUp = blessingsChatMessages.value.length > 0

  if (isFollowUp && !blessingsFollowUpQuestion.value.trim()) {
    ElMessage.warning('请输入追问内容')
    return
  }

  isBlessingsGenerating.value = true
  blessingsStreamingContent.value = ''

  try {
    let result: string

    if (isFollowUp) {
      // 追问：添加用户消息
      blessingsChatMessages.value.push({
        role: 'user',
        content: blessingsFollowUpQuestion.value
      })

      // 使用对话历史
      const messages = blessingsChatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: '',
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          blessingsStreamingContent.value = content
        }
      )
    } else {
      // 首次生成：使用详细提示词
      const occasionMap: Record<string, string> = {
        'birthday': '生日',
        'wedding': '婚礼',
        'newjob': '入职新工作',
        'newhome': '乔迁新居',
        'newyear': '新年',
        'festival': '节日',
        'graduation': '毕业',
        'promotion': '升职加薪'
      }

      const targetMap: Record<string, string> = {
        'elder': '长辈',
        'friend': '朋友',
        'lover': '恋人',
        'colleague': '同事',
        'leader': '领导'
      }

      const styleMap: Record<string, string> = {
        'warm': '温馨感人',
        'formal': '正式得体',
        'humorous': '幽默风趣',
        'poetic': '诗意优美'
      }

      const prompt = `请为${occasionMap[blessingsOccasion.value]}场合，给${targetMap[blessingsTarget.value]}写一段${styleMap[blessingsStyle.value]}的祝福语。

要求：
1. 语言${styleMap[blessingsStyle.value]}，情感真挚
2. 适合${targetMap[blessingsTarget.value]}的身份和关系
3. 贴合${occasionMap[blessingsOccasion.value]}的场景
4. 提供3-5个不同版本的祝福语
5. 使用Markdown格式，用序号分隔

请用心创作，让祝福语既有个性又不失温度。`

      // 保存用户意图
      blessingsChatMessages.value.push({
        role: 'user',
        content: `场合：${occasionMap[blessingsOccasion.value]}，对象：${targetMap[blessingsTarget.value]}，风格：${styleMap[blessingsStyle.value]}`
      })

      result = await agnesApi.sendChatMessageStream(
        '',
        prompt,
        'agnes-2.0-flash',
        (content) => {
          blessingsStreamingContent.value = content
        }
      )
    }

    // 保存AI回复
    blessingsChatMessages.value.push({
      role: 'assistant',
      content: result
    })

    // 清空追问输入
    if (isFollowUp) {
      blessingsFollowUpQuestion.value = ''
    }

    ElMessage.success('祝福语生成完成')
  } catch (error: any) {
    ElMessage.error('生成失败: ' + (error.message || '未知错误'))
    // 失败时移除刚添加的用户消息
    if (blessingsChatMessages.value.length > 0) {
      blessingsChatMessages.value.pop()
    }
  } finally {
    isBlessingsGenerating.value = false
    blessingsStreamingContent.value = ''
  }
}

const clearBlessingsHistory = () => {
  blessingsChatMessages.value = []
  blessingsStreamingContent.value = ''
  blessingsFollowUpQuestion.value = ''
}

const newBlessingsTopic = () => {
  clearBlessingsHistory()
  ElMessage.success('已开启新话题')
}

// 智能文案助手
const generateCopywriting = async () => {
  
  if (!copyTopic.value.trim()) {
    ElMessage.warning('请输入文案主题')
    return
  }

  // 判断是追问还是首次生成
  const isFollowUp = copyChatMessages.value.length > 0

  isCopyGenerating.value = true
  copyStreamingContent.value = ''

  try {
    let result: string

    if (isFollowUp) {
      // 追问：添加用户消息
      copyChatMessages.value.push({
        role: 'user',
        content: copyTopic.value
      })

      // 使用对话历史
      const messages = copyChatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: '',
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          copyStreamingContent.value = content
        }
      )
    } else {
      // 首次生成：使用详细提示词
      const typeMap: Record<string, string> = {
        'product': '产品推广',
        'activity': '活动宣传',
        'daily': '日常分享',
        'brand': '品牌故事'
      }

      const platformMap: Record<string, string> = {
        'wechat': '微信朋友圈（简洁，适合配图）',
        'xiaohongshu': '小红书（标题吸睛，加emoji和标签）',
        'douyin': '抖音（短视频脚本式，口语化）',
        'weibo': '微博（140字左右，话题性强）',
        'general': '通用平台'
      }

      const prompt = `请为"${copyTopic.value}"创作${typeMap[copyType.value]}文案，发布平台是${platformMap[copyPlatform.value]}。

要求：
1. 符合${platformMap[copyPlatform.value]}的特点和风格
2. ${copyType.value === 'product' ? '突出产品卖点和优势' : copyType.value === 'activity' ? '营造氛围，号召参与' : copyType.value === 'daily' ? '真实自然，引起共鸣' : '讲好品牌故事，建立情感连接'}
3. 语言生动，吸引眼球
4. 提供3个不同版本供选择
5. 使用Markdown格式，标题、正文、标签分明

${copyPlatform.value === 'xiaohongshu' ? '注意：小红书要加相关话题标签（#）和emoji' : ''}
${copyPlatform.value === 'douyin' ? '注意：抖音文案要口语化，适合视频旁白' : ''}

请创作吸引人的文案。`

      // 保存用户意图
      copyChatMessages.value.push({
        role: 'user',
        content: `主题：${copyTopic.value}，类型：${typeMap[copyType.value]}，平台：${platformMap[copyPlatform.value]}`
      })

      result = await agnesApi.sendChatMessageStream(
        '',
        prompt,
        'agnes-2.0-flash',
        (content) => {
          copyStreamingContent.value = content
        }
      )
    }

    // 保存AI回复
    copyChatMessages.value.push({
      role: 'assistant',
      content: result
    })

    // 清空输入
    copyTopic.value = ''

    ElMessage.success('文案生成完成')
  } catch (error: any) {
    ElMessage.error('生成失败: ' + (error.message || '未知错误'))
    // 失败时移除刚添加的用户消息
    if (copyChatMessages.value.length > 0) {
      copyChatMessages.value.pop()
    }
  } finally {
    isCopyGenerating.value = false
    copyStreamingContent.value = ''
  }
}

const clearCopyHistory = () => {
  copyChatMessages.value = []
  copyStreamingContent.value = ''
  copyTopic.value = ''
}

const newCopyTopic = () => {
  clearCopyHistory()
  ElMessage.success('已开启新话题')
}

const copyCopywriting = () => {
  if (!copyResult.value) return
  navigator.clipboard.writeText(copyResult.value)
  ElMessage.success('已复制到剪贴板')
}

// AI证件照
const generateIdPhoto = async () => {
  
  if (!idPhotoImage.value) {
    ElMessage.warning('请先上传照片')
    return
  }

  isIdPhotoGenerating.value = true
  try {
    const colorMap: Record<string, string> = {
      'blue': 'blue background',
      'red': 'red background',
      'white': 'white background',
      'gray': 'gray background'
    }

    const prompt = `Transform this photo into a professional ID photo with ${colorMap[idPhotoColor.value]}, proper lighting, centered face position, neutral expression, and clean appearance. The person should face forward with both ears visible, wearing appropriate attire. Remove any distracting elements and ensure the photo meets standard ID photo requirements.`

    const result = await agnesApi.generateImageToImage(
      '',
      idPhotoImage.value,
      prompt
    )

    if (result.images && result.images.length > 0) {
      idPhotoGenerated.value = result.images[0]
      ElMessage.success('证件照生成完成')
    }
  } catch (error: any) {
    ElMessage.error('生成失败: ' + (error.message || '未知错误'))
  } finally {
    isIdPhotoGenerating.value = false
  }
}

const downloadIdPhoto = () => {
  if (!idPhotoGenerated.value) return

  const link = document.createElement('a')
  link.href = idPhotoGenerated.value
  link.download = `id-photo-${Date.now()}.png`
  link.click()
  ElMessage.success('下载成功')
}

const useIdPhotoPreset = (url: string) => {
  idPhotoImage.value = url
}

// 添加剂危害查询
const queryAdditiveHazard = async () => {
  
  if (!additiveInput.value.trim()) {
    ElMessage.warning('请输入添加剂名称')
    return
  }

  // 判断是追问还是首次查询
  const isFollowUp = additiveChatMessages.value.length > 0

  isAdditiveQuerying.value = true
  additiveStreamingContent.value = ''

  try {
    let result: string

    if (isFollowUp) {
      // 追问：添加用户消息
      additiveChatMessages.value.push({
        role: 'user',
        content: additiveInput.value
      })

      // 使用对话历史
      const messages = additiveChatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: '',
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          additiveStreamingContent.value = content
        }
      )
    } else {
      // 首次查询：使用详细提示词
      const prompt = `请作为食品安全专家，详细介绍"${additiveInput.value}"这种食品添加剂。请使用Markdown格式输出，包含以下内容：

## 一、添加剂简介

- **化学名称**：标准化学名称
- **CAS编号**：国际化学文摘登记号（如有）
- **E编号**：欧盟食品添加剂编号（如有）
- **基本信息**：这是什么，属于哪类添加剂

## 二、制作原料

- **主要原料**：制作该添加剂的原材料
- **来源**：天然提取还是化学合成
- **原料特性**：原料的基本特征

## 三、制作过程

详细描述制作工艺流程：
1. 步骤一：...
2. 步骤二：...
3. 步骤三：...

## 四、使用场景

- **常见应用**：在哪些食品中使用
- **作用功能**：起到什么作用（防腐、增色、增味等）
- **使用范围**：允许使用的食品种类
- **使用限量**：国家标准规定的最大使用量

## 五、潜在危害

### 短期影响
- 可能的急性反应和症状

### 长期影响
- 长期摄入的健康风险
- 累积毒性问题

### 敏感人群
- 哪些人群应特别注意

### 安全剂量
- ADI值（每日允许摄入量）
- 安全使用建议

## 六、监管状态

- **中国**：GB 2760标准规定
- **国际**：FDA、EFSA等机构的评估结果
- **使用限制**：是否有禁用或限用规定

## 七、健康建议

- 日常饮食中如何规避或减少摄入
- 购买食品时的注意事项
- 替代方案（如有）

请提供科学、客观、准确的信息，避免过度恐慌或过度乐观。`

      // 保存用户消息
      additiveChatMessages.value.push({
        role: 'user',
        content: additiveInput.value
      })

      result = await agnesApi.sendChatMessageStream(
        '',
        prompt,
        'agnes-2.0-flash',
        (content) => {
          additiveStreamingContent.value = content
        }
      )
    }

    // 保存AI回复
    additiveChatMessages.value.push({
      role: 'assistant',
      content: result
    })

    // 清空输入
    additiveInput.value = ''

    ElMessage.success('查询完成')
  } catch (error: any) {
    ElMessage.error('查询失败: ' + (error.message || '未知错误'))
    // 失败时移除刚添加的用户消息
    if (additiveChatMessages.value.length > 0) {
      additiveChatMessages.value.pop()
    }
  } finally {
    isAdditiveQuerying.value = false
    additiveStreamingContent.value = ''
  }
}

const clearAdditiveHistory = () => {
  additiveChatMessages.value = []
  additiveStreamingContent.value = ''
  additiveInput.value = ''
}

const newAdditiveTopic = () => {
  clearAdditiveHistory()
  ElMessage.success('已开启新话题')
}

// 药品说明书解读
const queryMedicineGuide = async () => {
  
  if (!medicineInput.value.trim() && !medicineUploadedImage.value) {
    ElMessage.warning('请输入药品名称或上传说明书照片')
    return
  }

  // 保存用户消息
  const userMessage: any = {
    role: 'user',
    content: medicineInput.value
  }
  if (medicineUploadedImage.value) {
    userMessage.image = medicineUploadedImage.value
  }
  medicineChatMessages.value.push(userMessage)

  isMedicineQuerying.value = true
  medicineStreamingContent.value = ''

  try {
    let result: string

    // 判断是首次查询还是追问
    const isFollowUp = medicineChatMessages.value.length > 1

    if (isFollowUp) {
      // 追问：使用对话历史
      const messages = medicineChatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: '',
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          medicineStreamingContent.value = content
        }
      )
    } else {
      // 首次查询：使用详细提示词
      let prompt = ''

      if (medicineUploadedImage.value) {
        // 有照片时，使用视觉识别提示词
        prompt = `请作为医药专家，识别图片中的药品说明书内容，并用通俗易懂的语言进行解读。请使用Markdown格式输出：

## 一、药品基本信息

- **通用名称**：标准药品名称
- **商品名**：常见商品名
- **药品类别**：属于哪类药物（如抗生素、解热镇痛药等）
- **主要成分**：主要有效成分

## 二、这个药是干什么的？

用大白话说明：
- 主要治疗什么病
- 适用于哪些症状
- 什么情况下需要吃这个药

## 三、怎么吃？

- **用法用量**：
  - 成人：每次多少，每天几次
  - 儿童：剂量如何调整
  - 老人：是否需要减量
- **服用时间**：饭前还是饭后
- **服用注意**：能否掰开、嚼碎、用热水送服

## 四、副作用有哪些？

### 常见副作用（10%以上人会出现）
- 列出常见副作用及应对方法

### 偶见副作用（1-10%人会出现）
- 列出偶见副作用

### 严重副作用（立即就医）
- 列出需要马上停药并就医的症状

## 五、哪些人不能吃？

- **绝对禁忌**：哪些人绝对不能吃
- **相对禁忌**：哪些人需要谨慎使用
- **特殊人群**：
  - 孕妇：是否能用
  - 哺乳期：是否能用
  - 儿童：是否能用
  - 老人：注意事项

## 六、不能和什么一起吃？

- **药物相互作用**：不能同时吃的其他药物
- **食物相互作用**：不能同时吃的食物
- **饮酒**：能否饮酒

## 七、服药期间注意事项

- 需要定期检查什么指标
- 开车、工作有无影响
- 多久见效
- 需要吃多久
- 症状好转后能否立即停药

## 八、常见问题解答

- 忘记吃药怎么办
- 吃多了怎么办
- 过期了还能吃吗
- 如何保存

请用通俗易懂的语言，避免专业术语。如果必须使用专业术语，请加上通俗解释。`

        result = await agnesApi.sendChatMessageWithImageStream(
          '',
          prompt,
          medicineUploadedImage.value,
          'agnes-2.0-flash',
          (content) => {
            medicineStreamingContent.value = content
          }
        )
      } else {
        // 只有文本时，使用原有提示词
        prompt = `请作为医药专家，用通俗易懂的语言解读"${medicineInput.value}"的药品说明书。请使用Markdown格式输出：

## 一、药品基本信息

- **通用名称**：标准药品名称
- **商品名**：常见商品名
- **药品类别**：属于哪类药物（如抗生素、解热镇痛药等）
- **主要成分**：主要有效成分

## 二、这个药是干什么的？

用大白话说明：
- 主要治疗什么病
- 适用于哪些症状
- 什么情况下需要吃这个药

## 三、怎么吃？

- **用法用量**：
  - 成人：每次多少，每天几次
  - 儿童：剂量如何调整
  - 老人：是否需要减量
- **服用时间**：饭前还是饭后
- **服用注意**：能否掰开、嚼碎、用热水送服

## 四、副作用有哪些？

### 常见副作用（10%以上人会出现）
- 列出常见副作用及应对方法

### 偶见副作用（1-10%人会出现）
- 列出偶见副作用

### 严重副作用（立即就医）
- 列出需要马上停药并就医的症状

## 五、哪些人不能吃？

- **绝对禁忌**：哪些人绝对不能吃
- **相对禁忌**：哪些人需要谨慎使用
- **特殊人群**：
  - 孕妇：是否能用
  - 哺乳期：是否能用
  - 儿童：是否能用
  - 老人：注意事项

## 六、不能和什么一起吃？

- **药物相互作用**：不能同时吃的其他药物
- **食物相互作用**：不能同时吃的食物
- **饮酒**：能否饮酒

## 七、服药期间注意事项

- 需要定期检查什么指标
- 开车、工作有无影响
- 多久见效
- 需要吃多久
- 症状好转后能否立即停药

## 八、常见问题解答

- 忘记吃药怎么办
- 吃多了怎么办
- 过期了还能吃吗
- 如何保存

请用通俗易懂的语言，避免专业术语。如果必须使用专业术语，请加上通俗解释。`

        result = await agnesApi.sendChatMessageStream(
          '',
          prompt,
          'agnes-2.0-flash',
          (content) => {
            medicineStreamingContent.value = content
          }
        )
      }
    }

    // 保存AI回复
    medicineChatMessages.value.push({
      role: 'assistant',
      content: result
    })

    // 清空输入和图片
    medicineInput.value = ''
    medicineUploadedImage.value = ''

    ElMessage.success(isFollowUp ? '回答完成' : '解读完成')
  } catch (error: any) {
    // 移除失败的用户消息
    medicineChatMessages.value.pop()
    ElMessage.error('解读失败: ' + (error.message || '未知错误'))
  } finally {
    isMedicineQuerying.value = false
    medicineStreamingContent.value = ''
  }
}

// 清空药品对话历史
const clearMedicineHistory = () => {
  medicineChatMessages.value = []
  medicineInput.value = ''
  medicineUploadedImage.value = ''
  medicineStreamingContent.value = ''
}

// 开始新药品话题
const newMedicineTopic = () => {
  clearMedicineHistory()
}


// 合同风险检测
const analyzeContractRisk = async () => {
  
  if (!contractInput.value.trim() && !contractUploadedImage.value) {
    ElMessage.warning('请输入合同内容或上传合同照片')
    return
  }

  // 保存用户消息
  const userMessage: any = {
    role: 'user',
    content: contractInput.value
  }
  if (contractUploadedImage.value) {
    userMessage.image = contractUploadedImage.value
  }
  contractChatMessages.value.push(userMessage)

  isContractAnalyzing.value = true
  contractStreamingContent.value = ''

  try {
    let result: string

    // 判断是首次分析还是追问
    const isFollowUp = contractChatMessages.value.length > 1

    if (isFollowUp) {
      // 追问：使用对话历史
      const messages = contractChatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: '',
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          contractStreamingContent.value = content
        }
      )
    } else {
      // 首次分析：使用详细提示词
      const typeMap: Record<string, string> = {
        'rental': '租房合同',
        'labor': '劳动合同',
        'sale': '买卖合同',
        'service': '服务合同',
        'loan': '借款合同',
        'partnership': '合作协议'
      }

      let prompt = ''

      if (contractUploadedImage.value) {
        // 有照片时，使用视觉识别提示词
        prompt = `请作为专业律师，识别图片中的${typeMap[contractType.value]}内容，并分析风险。使用Markdown格式输出：

## 一、风险等级评估

- **总体风险等级**：🔴 高风险 / 🟡 中风险 / 🟢 低风险
- **风险评分**：X/10分
- **建议**：是否建议签署

## 二、高风险条款 🔴

逐条列出对您不利的条款：
1. **条款内容**：[摘录原文]
   - **风险说明**：这个条款可能导致什么后果
   - **修改建议**：应该如何修改
   - **严重程度**：⭐⭐⭐⭐⭐（5星最严重）

## 三、中风险条款 🟡

列出需要注意的条款：
1. **条款内容**：[摘录原文]
   - **风险说明**：可能的隐患
   - **注意事项**：签署前需要澄清什么

## 四、不平等条款

指出明显不合理的条款：
- 哪些条款明显偏向对方
- 哪些条款违反公平原则
- 法律上是否有效

## 五、缺失的保护性条款

合同中应该有但没有的条款：
- 缺少哪些对您有利的保护条款
- 建议增加什么内容
- 如何保护自己的权益

## 六、法律问题

- 是否符合相关法律法规
- 是否有违法条款
- 是否有法律漏洞

## 七、具体建议

### 如果必须签署：
- 至少要争取修改哪些条款
- 需要补充什么协议
- 签署时注意什么

### 如果可以不签：
- 这份合同的主要问题
- 更好的替代方案

## 八、重要提醒

- ⚠️ 最需要警惕的3个风险点
- 💡 签署前必须确认的事项
- 📝 建议保留的证据材料

${contractInput.value ? `\n补充说明：${contractInput.value}` : ''}

请客观、专业地分析，突出重点风险。`

        result = await agnesApi.sendChatMessageWithImageStream(
          '',
          prompt,
          contractUploadedImage.value,
          'agnes-2.0-flash',
          (content) => {
            contractStreamingContent.value = content
          }
        )
      } else {
        // 只有文本时
        prompt = `请作为专业律师，分析这份${typeMap[contractType.value]}的风险。使用Markdown格式输出：

合同内容：
${contractInput.value}

## 一、风险等级评估

- **总体风险等级**：🔴 高风险 / 🟡 中风险 / 🟢 低风险
- **风险评分**：X/10分
- **建议**：是否建议签署

## 二、高风险条款 🔴

逐条列出对您不利的条款：
1. **条款内容**：[摘录原文]
   - **风险说明**：这个条款可能导致什么后果
   - **修改建议**：应该如何修改
   - **严重程度**：⭐⭐⭐⭐⭐（5星最严重）

## 三、中风险条款 🟡

列出需要注意的条款：
1. **条款内容**：[摘录原文]
   - **风险说明**：可能的隐患
   - **注意事项**：签署前需要澄清什么

## 四、不平等条款

指出明显不合理的条款：
- 哪些条款明显偏向对方
- 哪些条款违反公平原则
- 法律上是否有效

## 五、缺失的保护性条款

合同中应该有但没有的条款：
- 缺少哪些对您有利的保护条款
- 建议增加什么内容
- 如何保护自己的权益

## 六、法律问题

- 是否符合相关法律法规
- 是否有违法条款
- 是否有法律漏洞

## 七、具体建议

### 如果必须签署：
- 至少要争取修改哪些条款
- 需要补充什么协议
- 签署时注意什么

### 如果可以不签：
- 这份合同的主要问题
- 更好的替代方案

## 八、重要提醒

- ⚠️ 最需要警惕的3个风险点
- 💡 签署前必须确认的事项
- 📝 建议保留的证据材料

请客观、专业地分析，突出重点风险。`

        result = await agnesApi.sendChatMessageStream(
          '',
          prompt,
          'agnes-2.0-flash',
          (content) => {
            contractStreamingContent.value = content
          }
        )
      }
    }

    // 保存AI回复
    contractChatMessages.value.push({
      role: 'assistant',
      content: result
    })

    // 清空输入和图片
    contractInput.value = ''
    contractUploadedImage.value = ''

    ElMessage.success('分析完成')
  } catch (error: any) {
    // 移除失败的用户消息
    contractChatMessages.value.pop()
    ElMessage.error('分析失败: ' + (error.message || '未知错误'))
  } finally {
    isContractAnalyzing.value = false
    contractStreamingContent.value = ''
  }
}

const clearContractHistory = () => {
  contractChatMessages.value = []
  contractStreamingContent.value = ''
  contractInput.value = ''
  contractUploadedImage.value = ''
}

const newContractTopic = () => {
  clearContractHistory()
  ElMessage.success('已开启新话题')
}

// 食物热量识别
const queryFoodCalorie = async () => {
  
  if (!foodInput.value.trim() && !foodUploadedImage.value) {
    ElMessage.warning('请输入食物名称或上传食物照片')
    return
  }

  // 保存用户消息
  const userMessage: any = {
    role: 'user',
    content: foodInput.value || '请识别图片中的食物'
  }
  if (foodUploadedImage.value) {
    userMessage.image = foodUploadedImage.value
  }
  foodChatMessages.value.push(userMessage)

  isFoodQuerying.value = true
  foodStreamingContent.value = ''

  try {
    let result: string

    // 判断是首次查询还是追问
    const isFollowUp = foodChatMessages.value.length > 1

    if (isFollowUp) {
      // 追问：使用对话历史
      const messages = foodChatMessages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      result = await agnesApi.chatStream(
        {
          apiKey: '',
          model: 'agnes-2.0-flash',
          messages
        },
        (content) => {
          foodStreamingContent.value = content
        }
      )
    } else {
      // 首次查询：使用详细提示词
      let prompt = ''

      if (foodUploadedImage.value) {
        // 有照片时，使用视觉识别提示词
        prompt = `请作为营养师，识别图片中的食物，并详细分析其营养信息。使用Markdown格式输出：

## 一、食物识别

- **食物名称**：识别出的食物名称
- **估算份量**：根据图片估算的大概份量

## 二、热量信息

- **总热量**：XXX 千卡（kcal）
- **热量等级**：🔴 高热量 / 🟡 中热量 / 🟢 低热量
- **等价运动**：
  - 需要走路 XX 分钟消耗
  - 需要跑步 XX 分钟消耗
  - 需要游泳 XX 分钟消耗

## 三、营养成分详解

### 三大营养素
- **碳水化合物**：XX克（占总热量XX%）
- **蛋白质**：XX克（占总热量XX%）
- **脂肪**：XX克（占总热量XX%）

### 其他重要营养素
- **膳食纤维**：XX克
- **钠**：XX毫克
- **维生素**：主要含有哪些维生素
- **矿物质**：主要含有哪些矿物质

## 四、健康评价

### 优点 ✅
- 列出这个食物的营养优势
- 对健康有什么好处

### 缺点 ⚠️
- 列出需要注意的地方
- 过量食用的风险

## 五、适合人群

- ✅ **推荐人群**：哪些人适合吃
- ⚠️ **谨慎人群**：哪些人要少吃
- ❌ **不宜人群**：哪些人不能吃

## 六、减肥建议

- **减肥指数**：⭐⭐⭐⭐⭐（5星最适合减肥）
- **建议**：
  - 减肥期间能否吃
  - 如果吃，建议吃多少
  - 最佳食用时间
  - 搭配什么更健康

## 七、增肌建议

- **增肌指数**：⭐⭐⭐⭐⭐（5星最适合增肌）
- **建议**：
  - 增肌期间是否推荐
  - 建议摄入量
  - 最佳食用时间
  - 如何搭配效果更好

## 八、替代食物

### 更健康的替代选择
- 推荐3-5个营养更好的替代食物
- 说明为什么更好

### 同等热量的其他选择
- 列出热量相近的其他食物
- 对比营养价值

## 九、烹饪建议

- **最健康的烹饪方式**：蒸/煮/炒/烤等
- **要避免的烹饪方式**：油炸等
- **搭配建议**：和什么一起吃更营养

${foodInput.value ? `\n补充说明：${foodInput.value}` : ''}

请提供准确的数据和实用的建议。`

        result = await agnesApi.sendChatMessageWithImageStream(
          '',
          prompt,
          foodUploadedImage.value,
          'agnes-2.0-flash',
          (content) => {
            foodStreamingContent.value = content
          }
        )
      } else {
        // 只有文本时
        // 首次查询需要份量
        if (!foodPortion.value.trim()) {
          ElMessage.warning('请输入份量')
          // 移除刚添加的用户消息
          foodChatMessages.value.pop()
          isFoodQuerying.value = false
          return
        }

        prompt = `请作为营养师，详细分析"${foodInput.value}"（${foodPortion.value}）的营养信息。使用Markdown格式输出：

## 一、热量信息

- **总热量**：XXX 千卡（kcal）
- **热量等级**：🔴 高热量 / 🟡 中热量 / 🟢 低热量
- **等价运动**：
  - 需要走路 XX 分钟消耗
  - 需要跑步 XX 分钟消耗
  - 需要游泳 XX 分钟消耗

## 二、营养成分详解

### 三大营养素
- **碳水化合物**：XX克（占总热量XX%）
- **蛋白质**：XX克（占总热量XX%）
- **脂肪**：XX克（占总热量XX%）

### 其他重要营养素
- **膳食纤维**：XX克
- **钠**：XX毫克
- **维生素**：主要含有哪些维生素
- **矿物质**：主要含有哪些矿物质

## 三、健康评价

### 优点 ✅
- 列出这个食物的营养优势
- 对健康有什么好处

### 缺点 ⚠️
- 列出需要注意的地方
- 过量食用的风险

## 四、适合人群

- ✅ **推荐人群**：哪些人适合吃
- ⚠️ **谨慎人群**：哪些人要少吃
- ❌ **不宜人群**：哪些人不能吃

## 五、减肥建议

- **减肥指数**：⭐⭐⭐⭐⭐（5星最适合减肥）
- **建议**：
  - 减肥期间能否吃
  - 如果吃，建议吃多少
  - 最佳食用时间
  - 搭配什么更健康

## 六、增肌建议

- **增肌指数**：⭐⭐⭐⭐⭐（5星最适合增肌）
- **建议**：
  - 增肌期间是否推荐
  - 建议摄入量
  - 最佳食用时间
  - 如何搭配效果更好

## 七、替代食物

### 更健康的替代选择
- 推荐3-5个营养更好的替代食物
- 说明为什么更好

### 同等热量的其他选择
- 列出热量相近的其他食物
- 对比营养价值

## 八、烹饪建议

- **最健康的烹饪方式**：蒸/煮/炒/烤等
- **要避免的烹饪方式**：油炸等
- **搭配建议**：和什么一起吃更营养

请提供准确的数据和实用的建议。`

        result = await agnesApi.sendChatMessageStream(
          '',
          prompt,
          'agnes-2.0-flash',
          (content) => {
            foodStreamingContent.value = content
          }
        )
      }
    }

    // 保存AI回复
    foodChatMessages.value.push({
      role: 'assistant',
      content: result
    })

    // 清空输入和图片
    foodInput.value = ''
    foodUploadedImage.value = ''

    ElMessage.success('查询完成')
  } catch (error: any) {
    // 移除失败的用户消息
    foodChatMessages.value.pop()
    ElMessage.error('查询失败: ' + (error.message || '未知错误'))
  } finally {
    isFoodQuerying.value = false
    foodStreamingContent.value = ''
  }
}

const clearFoodHistory = () => {
  foodChatMessages.value = []
  foodStreamingContent.value = ''
  foodInput.value = ''
  foodPortion.value = ''
  foodUploadedImage.value = ''
}

const newFoodTopic = () => {
  clearFoodHistory()
  ElMessage.success('已开启新话题')
}

const switchTab = (tab: 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image' | 'ai-chat' | 'apps' | 'model-config') => {
  if (tab === 'model-config' && !userStore.getLoginStatus) {
    ElMessage.warning('模型配置需要登录后使用')
    router.push('/login?redirect=' + encodeURIComponent(router.currentRoute.value.fullPath))
    return
  }
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
        'Authorization': `Bearer ${''}`
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

    const selectedAspectRatioForImage = aspectRatioOptions.find(r => r.value === imageAspectRatio.value)!
    const images = await agnesApi.generateImage(
      userModels.imageModel.value,
      imagePrompt.value.trim(),
      {
        width: selectedAspectRatioForImage.width,
        height: selectedAspectRatioForImage.height,
        n: imageCount.value,
      }
    )

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
  
  if (!imageToImageSourceImage.value) {
    ElMessage.warning('请先上传参考图片')
    return
  }

  // 防御性：直接读 DOM 校验，避免 v-model 链路丢值导致误判
  const promptFromDom = (document.getElementById('image-to-image-prompt-input') as HTMLTextAreaElement | null)?.value?.trim() || ''
  if (!imageToImagePrompt.value.trim() && !promptFromDom) {
    ElMessage.warning('请输入修改描述')
    return
  }

  isGeneratingImageToImage.value = true
  imageToImageResult.value.images = []
  imageToImageResult.value.generateTime = 0

  try {
    currentStageStartTime.value = Date.now()
    startElapsedTimer('正在生成图片', 'image-to-image')

    // 防御性：直接从 DOM 读 textarea 当前值（绕过中间层 v-model 链路可能丢值的问题）
    const promptFromDom = (document.getElementById('image-to-image-prompt-input') as HTMLTextAreaElement | null)?.value?.trim() || ''
    const finalPrompt = imageToImagePrompt.value.trim() || promptFromDom

    // 按用户选择的图片比例查 width/height（同样从 DOM 读，作为权威值）
    const aspectRatioFromDom = (document.getElementById('image-to-image-aspect-ratio-select') as HTMLSelectElement | null)?.value
      || imageToImageAspectRatio.value
    const ar = aspectRatioOptions.find(o => o.value === aspectRatioFromDom) || aspectRatioOptions.find(o => o.value === '1:1')!

    const images = await agnesApi.editImage(
      userModels.imageModel.value,
      imageToImageSourceImage.value,
      finalPrompt,
      ar.width,
      ar.height
    )

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
  loadUserApiKeys()
  loadOpenProviders()

  // 从URL恢复Tab状态
  const tabFromUrl = route.query.tab as string
  if (tabFromUrl && ['text-to-video', 'image-to-video', 'text-to-image', 'image-to-image', 'ai-chat', 'apps', 'model-config'].includes(tabFromUrl)) {
    // model-config 需要登录，未登录时不从 URL 恢复
    if (tabFromUrl === 'model-config' && !userStore.getLoginStatus) {
      // 跳过
    } else {
      activeTab.value = tabFromUrl as any
    }
  }

  // 从URL恢复应用状态：?app=xxx
  const appFromUrl = route.query.app as string
  if (appFromUrl) {
    currentApp.value = appFromUrl
  }

  // AI对话默认创建一个会话
  if (chatSessions.value.length === 0) {
    createNewSession()
  }

  // 手机端：滚动到选中的Tab
  setTimeout(() => {
    if (tabContainerRef.value && window.innerWidth < 768) {
      const tabs = ['text-to-video', 'image-to-video', 'text-to-image', 'image-to-image', 'ai-chat', 'apps', 'model-config']
      const activeIndex = tabs.indexOf(activeTab.value)
      if (activeIndex > 0) {
        const scrollAmount = activeIndex * 150 // 每个Tab大约150px
        tabContainerRef.value.scrollTo({ left: scrollAmount, behavior: 'smooth' })
      }
    }
  }, 100)
})

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

      script = await agnesApi.generateOptimizedPrompt(userModels.chatModel.value, topic.value.trim())

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
      userModels.videoModel.value,
      script,
      {
        frames: selectedDuration.frames,
        width: selectedAspectRatio.width,
        height: selectedAspectRatio.height,
      }
    )

    // 轮询状态（不更新currentStep，让计时器继续显示）
    const videoUrl = await agnesApi.pollVideoStatus(
      userModels.videoModel.value,
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

      finalPrompt = await agnesApi.generateOptimizedPrompt(userModels.chatModel.value, videoPrompt.value.trim())

      stopElapsedTimer()
    }

    // 生成视频
    currentStage.value = 2
    startElapsedTimer('正在生成视频', 'image-to-video')

    const selectedDuration = durationOptions.find(d => d.value === duration.value)!
    const selectedAspectRatio = aspectRatioOptions.find(r => r.value === aspectRatio.value)!

    // 提交任务
    const videoId = await agnesApi.submitVideoTask(
      userModels.videoModel.value,
      finalPrompt,
      {
        frames: selectedDuration.frames,
        width: selectedAspectRatio.width,
        height: selectedAspectRatio.height,
        images: uploadedImages.value,
      }
    )

    // 轮询状态（不更新currentStep，让计时器继续显示）
    const videoUrl = await agnesApi.pollVideoStatus(
      userModels.videoModel.value,
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

    <div class="bg-white rounded-2xl p-4 md:p-6 shadow-sm">
      <!-- 用户 API Key 配置（游客必填，登录用户可选覆盖系统 key） -->
      <details class="mb-4 border border-gray-200 rounded-lg">
        <summary class="px-3 py-2 cursor-pointer text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between">
          <span>
            🔑 我的 API Key
            <span v-if="userApiKeyCount > 0" class="ml-1 text-xs text-green-600">（已配置 {{ userApiKeyCount }} 个）</span>
            <span v-else class="ml-1 text-xs text-gray-400">（未配置）</span>
          </span>
          <span class="text-xs text-gray-400">点击展开</span>
        </summary>
        <div class="px-3 py-2 border-t border-gray-200 space-y-2">
          <p class="text-xs text-gray-500">
            {{ userStore.getLoginStatus ? '你也可以用自己的 Key 覆盖系统配置。' : '游客必须配置 Key 才能使用 AI 功能。Key 仅保存在你的浏览器本地，不会上传到服务器。' }}
          </p>
          <div class="flex flex-col md:flex-row gap-2">
            <select
              v-model="newApiKeyProviderSlug"
              class="flex-1 px-3 py-1.5 border rounded text-xs"
            >
              <option value="" disabled>选择已开放 Key 的厂商…</option>
              <option v-for="p in openProviders" :key="p.slug" :value="p.slug">
                {{ p.icon || '🔌' }} {{ p.name }}（{{ p.slug }}）
              </option>
            </select>
            <input
              v-model="newApiKeyValue"
              type="password"
              placeholder="API Key"
              class="flex-1 px-3 py-1.5 border rounded text-xs font-mono"
            />
            <button
              @click="saveUserApiKey"
              class="px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
            >💾 保存</button>
          </div>
          <p v-if="openProviders.length === 0" class="text-xs text-gray-400">
            暂无可配置 Key 的厂商（管理员尚未开放任何厂商）。
          </p>
          <div v-if="Object.keys(userApiKeys).length > 0" class="border-t pt-2 mt-2">
            <div class="text-xs font-semibold text-gray-600 mb-1">已保存的厂商 Key：</div>
            <div
              v-for="(key, slug) in userApiKeys"
              :key="slug"
              class="flex items-center justify-between text-xs py-1"
            >
              <span class="font-mono text-gray-700">厂商 <b>{{ slug }}</b> 的 Key</span>
              <button
                @click="deleteUserApiKey(slug)"
                class="px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
              >删除</button>
            </div>
          </div>
        </div>
      </details>

      <!-- 左右布局：左侧Tab，右侧内容 -->
      <div class="flex flex-col md:flex-row gap-4 md:gap-6">
        <!-- 左侧Tab导航 -->
        <div class="w-full md:w-48 flex-shrink-0">
          <!-- 移动端：横向滚动 -->
          <div ref="tabContainerRef" class="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 -mx-2 px-2 md:mx-0 md:px-0">
            <button
              @click="switchTab('text-to-video')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left whitespace-nowrap md:whitespace-normal flex-shrink-0 md:flex-shrink',
                activeTab === 'text-to-video'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🎬 文生视频
            </button>
            <button
              @click="switchTab('image-to-video')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left whitespace-nowrap md:whitespace-normal flex-shrink-0 md:flex-shrink',
                activeTab === 'image-to-video'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🖼️ 图生视频
            </button>
            <button
              @click="switchTab('text-to-image')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left whitespace-nowrap md:whitespace-normal flex-shrink-0 md:flex-shrink',
                activeTab === 'text-to-image'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🎨 文生图
            </button>
            <button
              @click="switchTab('image-to-image')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left whitespace-nowrap md:whitespace-normal flex-shrink-0 md:flex-shrink',
                activeTab === 'image-to-image'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🎭 图生图
            </button>
            <button
              @click="switchTab('ai-chat')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left whitespace-nowrap md:whitespace-normal flex-shrink-0 md:flex-shrink',
                activeTab === 'ai-chat'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              💬 AI对话
            </button>
            <button
              @click="switchTab('apps')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left whitespace-nowrap md:whitespace-normal flex-shrink-0 md:flex-shrink',
                activeTab === 'apps'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              🎯 应用
            </button>
            <button
              v-if="userStore.getLoginStatus"
              @click="switchTab('model-config')"
              :class="['px-4 py-3 rounded-lg font-medium transition-all text-left whitespace-nowrap md:whitespace-normal flex-shrink-0 md:flex-shrink',
                activeTab === 'model-config'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100']"
            >
              ⚙️ 模型配置
            </button>
          </div>
        </div>

        <!-- 右侧内容区域 -->
        <div class="flex-1 min-w-0">
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

          <!-- 应用Tab -->
          <AppsTab
            v-if="activeTab === 'apps'"
            :currentApp="currentApp"
            :initialAppId="currentApp"
            @select-app="selectApp"
            @back-to-list="backToAppList"
          >
            <template #default="{ app }">
              <!-- 应用加载中：仅对非命名应用生效（命名应用直接用专属组件渲染） -->
              <div v-if="app && !customAppData && !isNamedSystemApp(app)" class="flex justify-center items-center py-12 text-gray-500">
                加载应用中...
              </div>

              <!-- 解梦应用 -->
              <DreamAnalysisApp
                v-if="app === 'dream-analysis'"
                v-model="dreamInput"
                :isAnalyzing="isDreamAnalyzing"
                :chatMessages="dreamChatMessages"
                :streamingContent="dreamStreamingContent"
                @analyze="analyzeDream"
                @clear-history="clearDreamHistory"
                @new-topic="newDreamTopic"
              />

              <!-- 城市指南应用 -->
              <CityGuideApp
                v-if="app === 'city-guide'"
                v-model="cityInput"
                :isGenerating="isCityGenerating"
                :chatMessages="cityChatMessages"
                :streamingContent="cityStreamingContent"
                @generate="generateCityGuide"
                @clear-history="clearCityHistory"
                @new-topic="newCityTopic"
              />

              <!-- 宠物头像应用 -->
              <PetAvatarApp
                v-if="app === 'pet-avatar'"
                :petImage="petImage"
                :selectedStyle="petStyle"
                :isGenerating="isPetGenerating"
                :generatedImage="petGeneratedImage"
                @update:petImage="petImage = $event"
                @update:selectedStyle="petStyle = $event"
                @generate="generatePetAvatar"
                @download="downloadPetAvatar"
                @use-preset="usePetPreset"
              />

              <!-- 祝福语生成器 -->
              <BlessingsGeneratorApp
                v-if="app === 'blessings-generator'"
                :selectedOccasion="blessingsOccasion"
                :selectedTarget="blessingsTarget"
                :selectedStyle="blessingsStyle"
                :followUpQuestion="blessingsFollowUpQuestion"
                :isGenerating="isBlessingsGenerating"
                :chatMessages="blessingsChatMessages"
                :streamingContent="blessingsStreamingContent"
                @update:selectedOccasion="blessingsOccasion = $event"
                @update:selectedTarget="blessingsTarget = $event"
                @update:selectedStyle="blessingsStyle = $event"
                @update:followUpQuestion="blessingsFollowUpQuestion = $event"
                @generate="generateBlessings"
                @clear-history="clearBlessingsHistory"
                @new-topic="newBlessingsTopic"
              />

              <!-- 智能文案助手 -->
              <CopywritingAssistantApp
                v-if="app === 'copywriting-assistant'"
                :selectedType="copyType"
                :selectedPlatform="copyPlatform"
                :topic="copyTopic"
                :isGenerating="isCopyGenerating"
                :chatMessages="copyChatMessages"
                :streamingContent="copyStreamingContent"
                @update:selectedType="copyType = $event"
                @update:selectedPlatform="copyPlatform = $event"
                @update:topic="copyTopic = $event"
                @generate="generateCopywriting"
                @clear-history="clearCopyHistory"
                @new-topic="newCopyTopic"
              />

              <!-- AI证件照 -->
              <IdPhotoApp
                v-if="app === 'id-photo'"
                :photoImage="idPhotoImage"
                :selectedColor="idPhotoColor"
                :selectedSize="idPhotoSize"
                :isGenerating="isIdPhotoGenerating"
                :generatedPhoto="idPhotoGenerated"
                @update:photoImage="idPhotoImage = $event"
                @update:selectedColor="idPhotoColor = $event"
                @update:selectedSize="idPhotoSize = $event"
                @generate="generateIdPhoto"
                @download="downloadIdPhoto"
                @use-preset="useIdPhotoPreset"
              />

              <!-- 添加剂危害查询 -->
              <AdditiveHazardApp
                v-if="app === 'additive-hazard'"
                v-model="additiveInput"
                :isQuerying="isAdditiveQuerying"
                :chatMessages="additiveChatMessages"
                :streamingContent="additiveStreamingContent"
                @query="queryAdditiveHazard"
                @clear-history="clearAdditiveHistory"
                @new-topic="newAdditiveTopic"
              />

              <!-- 药品说明书解读 -->
              <MedicineGuideApp
                v-if="app === 'medicine-guide'"
                v-model="medicineInput"
                :uploadedImage="medicineUploadedImage"
                :isQuerying="isMedicineQuerying"
                :chatMessages="medicineChatMessages"
                :streamingContent="medicineStreamingContent"
                @update:uploadedImage="medicineUploadedImage = $event"
                @query="queryMedicineGuide"
                @clear-history="clearMedicineHistory"
                @new-topic="newMedicineTopic"
              />

              <!-- 合同风险检测 -->
              <ContractRiskApp
                v-if="app === 'contract-risk'"
                v-model="contractInput"
                :selectedType="contractType"
                :uploadedImage="contractUploadedImage"
                :isAnalyzing="isContractAnalyzing"
                :chatMessages="contractChatMessages"
                :streamingContent="contractStreamingContent"
                @update:selectedType="contractType = $event"
                @update:uploadedImage="contractUploadedImage = $event"
                @analyze="analyzeContractRisk"
                @clear-history="clearContractHistory"
                @new-topic="newContractTopic"
              />

              <!-- 食物热量识别 -->
              <FoodCalorieApp
                v-if="app === 'food-calorie'"
                v-model="foodInput"
                :portion="foodPortion"
                :uploadedImage="foodUploadedImage"
                :isQuerying="isFoodQuerying"
                :chatMessages="foodChatMessages"
                :streamingContent="foodStreamingContent"
                @update:portion="foodPortion = $event"
                @update:uploadedImage="foodUploadedImage = $event"
                @query="queryFoodCalorie"
                @clear-history="clearFoodHistory"
                @new-topic="newFoodTopic"
              />

              <!-- 自建应用 -->
              <CustomAppChat
                v-if="customAppData"
                :app="customAppData"
                :apiKey="legacyApiKey"
              />
            </template>
          </AppsTab>

          <!-- 模型配置 Tab -->
          <ModelConfigTab
            v-if="activeTab === 'model-config'"
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

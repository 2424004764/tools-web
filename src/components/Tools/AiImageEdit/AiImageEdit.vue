<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { UploadProps } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import GenerationHistoryDialog from './GenerationHistoryDialog.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { autoDown } from '@/utils/file'
import { functionsRequest } from '@/utils/functionsRequest'
import { fetchToolModels, type PublicToolModel } from '@/api/tool-models'
import { fetchMyGenerationRecordImage } from '@/api/me'
import { useUserStore } from '@/store/modules/user'

const info = reactive({
  title: 'AI图片编辑',
  desc: 'AI智能图片编辑，支持图片生成（文生图）、图片编辑（图生图）。上传图片+输入文字描述，AI帮你一键生成新图片。',
})

// 模型列表（从后台 tool_models 拉取）
const modelList = ref<PublicToolModel[]>([])
const modelLoaded = ref(false)
const selectedModel = ref<string>('')
const currentModelCost = computed(() => {
  const m = modelList.value.find((x) => x.model_key === selectedModel.value)
  return m?.credit_cost ?? 0
})

// 尺寸选项（按宽高比显示；value 保留像素值发给上游 bafang.me）
const sizeOptions = [
  { value: 'auto', label: '自动（推荐）' },
  { value: '1024x1024', label: '1:1 正方形' },
  { value: '1024x1792', label: '9:16 竖版' },
  { value: '1792x1024', label: '16:9 横版' },
]

// 表单状态
const selectedSize = ref(sizeOptions[0].value)
const prompt = ref('')
const promptTouched = ref(false)
const isLoading = ref(false)

// 用户 store（右上角积分 badge 用）
const userStore = useUserStore()
const router = useRouter()

// 历史弹窗 ref
const historyRef = ref<InstanceType<typeof GenerationHistoryDialog> | null>(null)

// 图片上传 — 保存 File 对象，预览用 base64
const uploadRef = ref<any>(null)
const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const uploadedFileName = ref('')

const handleExceed: UploadProps['onExceed'] = (files) => {
  // 已有图片时再选新图：清空 el-upload 内部列表后，直接交给 processImageFile 处理。
  // 不再走 handleStart -> http-request 链路，避免 auto-upload 在 clearFiles 紧接 handleStart
  // 的时序下不触发导致预览不刷新。
  uploadRef.value!.clearFiles()
  const file = files[0] as File
  processImageFile(file)
}

const handleUpload = (options: any): Promise<void> => {
  return new Promise((resolve) => {
    processImageFile(options.file as File)
    resolve()
  })
}

const removeImage = () => {
  imageFile.value = null
  imagePreview.value = ''
  uploadedFileName.value = ''
  uploadRef.value?.clearFiles()
}

// 粘贴图片支持
const processImageFile = (file: File) => {
  imageFile.value = file
  uploadedFileName.value = file.name || 'clipboard.png'
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
  ElMessage.success('图片已就绪')
}

const handlePaste = (e: ClipboardEvent) => {
  if (isLoading.value) return
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (blob) {
        const file = new File([blob], 'clipboard.png', { type: blob.type })
        processImageFile(file)
      }
      return
    }
  }
}

// 提示词缓存 key：刷新页面后自动恢复上次输入
const PROMPT_CACHE_KEY = 'ai-image-edit:prompt'

// 响应式：< 640px 视为手机端 → 「我的历史」改走独立页面 /ai-image-edit/history
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

const openHistory = () => {
  if (isMobile.value) {
    router.push('/ai-image-edit/history')
  } else {
    historyRef.value?.open()
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  document.addEventListener('paste', handlePaste)
  fetchModelList()
  // 恢复上次提交的提示词
  try {
    const cached = localStorage.getItem(PROMPT_CACHE_KEY)
    if (cached) prompt.value = cached
  } catch {
    // localStorage 不可用（隐私模式等），静默忽略
  }
})

// 实时同步提示词到 localStorage
watch(prompt, (val) => {
  try {
    if (val && val.trim()) {
      localStorage.setItem(PROMPT_CACHE_KEY, val)
    } else {
      localStorage.removeItem(PROMPT_CACHE_KEY)
    }
  } catch {
    // 静默忽略
  }
})

// 拉取后台配置的 model 列表（key/label/cost/is_default）
const fetchModelList = async () => {
  try {
    const list = await fetchToolModels('/ai-image-edit/')
    modelList.value = list
    if (list.length > 0) {
      // 优先取 is_default，否则取第一项
      const def = list.find((m) => m.is_default) || list[0]
      selectedModel.value = def.model_key
    }
  } catch (err) {
    console.warn('[ai-image-edit] fetchModelList failed', err)
  } finally {
    // 无论成功失败都标记加载完成——失败时 modelList 为空，按钮自动 disabled
    modelLoaded.value = true
  }
}

onUnmounted(() => {
  document.removeEventListener('paste', handlePaste)
  window.removeEventListener('resize', updateIsMobile)
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
  stopCanvasLoading()
  stopBtnAnim()
  stopDotsAnim()
})

// 生成结果
const resultImageUrl = ref('')
const currentRecordId = ref('')
const elapsedSeconds = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

// Canvas loading 动画
const loadingCanvas = ref<HTMLCanvasElement | null>(null)
let canvasAnimId = 0

interface Particle {
  x: number; y: number; vx: number; vy: number; r: number; hue: number; alpha: number
}

let canvasResizeHandler: (() => void) | null = null

const startCanvasLoading = () => {
  if (!loadingCanvas.value) return
  const canvas = loadingCanvas.value
  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1

  const resize = () => {
    const parent = canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = rect.width + 'px'
    canvas.style.height = rect.height + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  canvasResizeHandler = resize
  window.addEventListener('resize', resize)

  const W = () => canvas.width / dpr
  const H = () => canvas.height / dpr
  const particles: Particle[] = []
  const count = 50

  const hues = [260, 280, 320, 220, 180] // purple, violet, pink, blue, teal
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * W(),
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2.5 + 1,
      hue: hues[Math.floor(Math.random() * hues.length)],
      alpha: Math.random() * 0.5 + 0.3,
    })
  }

  let frame = 0
  const draw = () => {
    const w = W(); const h = H()
    ctx.clearRect(0, 0, w, h)

    // Update & draw particles
    for (const p of particles) {
      p.x += p.vx + Math.sin(frame * 0.02 + p.y * 0.01) * 0.15
      p.y += p.vy + Math.cos(frame * 0.02 + p.x * 0.01) * 0.15
      if (p.x < -10) p.x = w + 10
      if (p.x > w + 10) p.x = -10
      if (p.y < -10) p.y = h + 10
      if (p.y > h + 10) p.y = -10

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.alpha})`
      ctx.fill()
    }

    // Draw connections
    const cx = w / 2; const cy = h / 2
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const maxDist = 90
        if (dist < maxDist) {
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          const alpha = (1 - dist / maxDist) * 0.18
          ctx.strokeStyle = `hsla(${particles[i].hue}, 60%, 65%, ${alpha})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
      // Attract to center hole
      const adx = cx - particles[i].x
      const ady = cy - particles[i].y
      const adist = Math.sqrt(adx * adx + ady * ady) || 1
      if (adist < 80) {
        particles[i].vx += adx / adist * 0.02
        particles[i].vy += ady / adist * 0.02
      }
    }

    // Center glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + Math.sin(frame * 0.03) * 10)
    glow.addColorStop(0, 'rgba(168,85,247,0.15)')
    glow.addColorStop(0.5, 'rgba(99,102,241,0.06)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    frame++
    canvasAnimId = requestAnimationFrame(draw)
  }
  draw()
}

const stopCanvasLoading = () => {
  if (canvasAnimId) { cancelAnimationFrame(canvasAnimId); canvasAnimId = 0 }
  if (canvasResizeHandler) { window.removeEventListener('resize', canvasResizeHandler); canvasResizeHandler = null }
}

// 按钮 JS 动画
const btnRef = ref<HTMLButtonElement | null>(null)
let btnAnimId = 0
let btnPhase = 0

const startBtnAnim = () => {
  if (!btnRef.value) return
  const btn = btnRef.value
  const colors = [
    [0x63, 0x66, 0xf1], // indigo
    [0xa8, 0x55, 0xf7], // purple
    [0xec, 0x48, 0x99], // pink
    [0xa8, 0x55, 0xf7], // purple
    [0x63, 0x66, 0xf1], // indigo
  ]
  const step = () => {
    btnPhase = (btnPhase + 0.004) % 1
    // 沿 colors 数组循环插值
    const t = btnPhase * (colors.length - 1)
    const i = Math.floor(t)
    const f = t - i
    const c0 = colors[i]
    const c1 = colors[Math.min(i + 1, colors.length - 1)]
    const r = Math.round(c0[0] + (c1[0] - c0[0]) * f)
    const g = Math.round(c0[1] + (c1[1] - c0[1]) * f)
    const b = Math.round(c0[2] + (c1[2] - c0[2]) * f)
    btn.style.background = `linear-gradient(90deg, rgb(${r},${g},${b}), rgb(${Math.round(c0[0])},${Math.round(c0[1])},${Math.round(c0[2])}))`
    btnAnimId = requestAnimationFrame(step)
  }
  step()
}

const stopBtnAnim = () => {
  if (btnAnimId) { cancelAnimationFrame(btnAnimId); btnAnimId = 0 }
  if (btnRef.value) {
    btnRef.value.style.background = ''
  }
}

// Dots animation
const dotsRef = ref<HTMLElement | null>(null)
let dotsAnimId = 0

const startDotsAnim = () => {
  if (!dotsRef.value) return
  const dots = Array.from(dotsRef.value.children) as HTMLElement[]
  let t = 0
  const step = () => {
    t += 0.06
    dots.forEach((dot, i) => {
      const y = Math.sin(t + i * 0.8) * 10
      const s = 1 + Math.abs(Math.sin(t + i * 0.8)) * 0.3
      dot.style.transform = `translateY(${y}px) scale(${s})`
      dot.style.opacity = String(0.4 + Math.abs(Math.sin(t + i * 0.8)) * 0.6)
    })
    dotsAnimId = requestAnimationFrame(step)
  }
  step()
}

const stopDotsAnim = () => {
  if (dotsAnimId) { cancelAnimationFrame(dotsAnimId); dotsAnimId = 0 }
}

// Watch isLoading to start/stop animations
watch(isLoading, (val) => {
  if (val) {
    setTimeout(() => {
      startBtnAnim()
      startDotsAnim()
      startCanvasLoading()
    }, 50)
  } else {
    stopBtnAnim()
    stopDotsAnim()
    stopCanvasLoading()
  }
})

const formatElapsed = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
}

// 是否可以生成（提示词必填 + model 已就绪）
const canGenerate = computed(() => {
  return !isLoading.value
    && modelLoaded.value
    && modelList.value.length > 0
    && !!selectedModel.value
    && prompt.value.trim().length > 0
})

// 清空提示词 + 移除 localStorage 缓存
const clearPrompt = () => {
  prompt.value = ''
  promptTouched.value = false
  try {
    localStorage.removeItem(PROMPT_CACHE_KEY)
  } catch {
    // 静默忽略
  }
}

// 调用后端 API（FormData 发送文件）
const generateImage = async () => {
  if (!canGenerate.value) {
    promptTouched.value = true
    if (!modelLoaded.value) {
      ElMessage.warning('模型列表加载中，请稍候')
    } else if (modelList.value.length === 0 || !selectedModel.value) {
      ElMessage.error('暂无可用模型，请联系管理员配置')
    } else {
      ElMessage.warning('请先输入提示词')
    }
    return
  }

  isLoading.value = true
  resultImageUrl.value = ''
  elapsedSeconds.value = 0
  elapsedTimer = setInterval(() => { elapsedSeconds.value++ }, 1000)

  // 乐观扣费：服务端在调上游前就已经扣费了，前端立即把余额减掉，
  // 这样在 30~90s 的生成期间徽章和弹窗都能保持与服务端一致。
  // 失败/退还路径会调 userStore.fetchCredits(true) 重新拉取对齐。
  const cost = currentModelCost.value
  const balanceBefore = userStore.credits.balance
  if (cost > 0 && balanceBefore >= cost) {
    userStore.setBalance(balanceBefore - cost)
  }

  // 出错时立即回退乐观扣费，同时调 fetchCredits 兜底对齐服务端权威值
  const revertOptimistic = () => {
    if (cost > 0) {
      userStore.setBalance(balanceBefore)
    }
  }

  try {
    const fd = new FormData()
    fd.append('model', selectedModel.value)
    fd.append('size', selectedSize.value)
    if (prompt.value.trim()) {
      fd.append('prompt', prompt.value.trim())
    }
    if (imageFile.value) {
      fd.append('image', imageFile.value)
    }

    // AI 生图偶尔跑到 3-5 分钟，覆盖默认 30s 超时到 11 分钟（后端 10 分钟 + 1 分钟缓冲）
    // 每次提交带 Idempotency-Key：网络重试时复用扣费；同 key 30 分钟内最多扣一次
    const idempotencyKey = crypto.randomUUID()
    const res = await functionsRequest.post('/api/ai-image-edit', fd, {
      timeout: 660000,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    const data = res.data

    if (!data.ok) {
      ElMessage.error(data.error || '生成失败')
      revertOptimistic()
      // 用服务端返回的 balance 覆盖显示（这是数据库真实值）
      if (typeof data.balance === 'number') {
        userStore.setBalance(data.balance)
      } else {
        userStore.fetchCredits(true)
      }
      return
    }

    resultImageUrl.value = data.data?.url || ''
    currentRecordId.value = data.data?.recordId || ''

    // 用服务端返回的权威 balanceAfter 覆盖（理论上等于 balanceBefore - cost，
    // 幂等命中时也可能不同；这里以服务端为准）
    if (typeof data.data?.balanceAfter === 'number') {
      userStore.setBalance(data.data.balanceAfter)
    }

    if (resultImageUrl.value) {
      ElMessage.success('图片生成成功')
    } else {
      ElMessage.warning('生成完成但未获取到图片URL')
    }
  } catch (error: any) {
    console.error('生成图片失败:', error)
    revertOptimistic()
    // 非 200 响应也带 balance 字段（数据库真实值），直接覆盖
    const errBalance = error?.response?.data?.balance
    if (typeof errBalance === 'number') {
      userStore.setBalance(errBalance)
    } else {
      userStore.fetchCredits(true)
    }
    const msg = error?.response?.data?.error || error?.message || '网络请求失败，请稍后重试'
    ElMessage.error(msg)
  } finally {
    isLoading.value = false
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
  }
}

// 下载图片
const downloadImage = () => {
  if (!resultImageUrl.value) return
  // 优先走后端代理（绕过第三方图床 CORS）；有 recordId 时必走
  if (currentRecordId.value) {
    fetchMyGenerationRecordImage(currentRecordId.value)
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob)
        autoDown(url, filename)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      })
      .catch(() => {
        // 代理失败降级：直接打开
        window.open(resultImageUrl.value, '_blank', 'noopener,noreferrer')
      })
    return
  }
  // 无 recordId（极少见）：直接 fetch 试一下，跨域失败再降级
  fetch(resultImageUrl.value)
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      autoDown(url, `ai-image-${Date.now()}.png`)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
    .catch(() => {
      window.open(resultImageUrl.value, '_blank', 'noopener,noreferrer')
    })
}

// 在新标签页查看
const openInNewTab = () => {
  if (resultImageUrl.value) {
    window.open(resultImageUrl.value, '_blank')
  }
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title">
        <template #right>
          <button
            v-if="userStore.getLoginStatus"
            type="button"
            class="px-3 py-1.5 text-sm rounded-lg border border-accent-300 text-accent-700 hover:bg-accent-50 transition-colors flex items-center gap-1.5"
            @click="openHistory"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            我的历史
          </button>
        </template>
      </DetailHeader>

    <div class="p-4 rounded-2xl bg-white">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- 左侧：输入区 -->
        <div class="space-y-6">
          <!-- 图片上传 -->
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-2">上传图片（可选）</label>
            <el-upload
              ref="uploadRef"
              class="w-full"
              drag
              :auto-upload="true"
              :limit="1"
              :on-exceed="handleExceed"
              :http-request="handleUpload"
              :show-file-list="false"
              accept="image/png,image/jpeg,image/webp,image/gif"
            >
              <div
                v-if="!imagePreview"
                class="flex flex-col items-center justify-center py-3"
              >
                <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span class="text-body-sm text-gray-500">拖拽图片、点击上传 或 Ctrl+V 粘贴</span>
                <span class="text-caption text-gray-400 mt-0.5">支持 PNG / JPEG / WebP / GIF</span>
              </div>
              <div v-else class="relative w-full" @click.stop>
                <img :src="imagePreview" class="max-h-24 mx-auto rounded-lg object-contain" alt="上传预览" />
                <span class="block text-center text-caption text-gray-500 mt-1">{{ uploadedFileName }}</span>
                <span class="block text-center text-caption text-gray-400 mt-0.5">点击周围空白、拖拽新图片 或 Ctrl+V 粘贴 即可替换</span>
              </div>
            </el-upload>
            <button
              v-if="imagePreview"
              @click="removeImage"
              class="mt-2 text-body-sm text-red-500 hover:text-red-700 flex items-center"
            >
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              移除图片
            </button>
          </div>

          <!-- 提示词 -->
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-2">
              提示词<span class="text-red-500">*</span>
              <span class="text-caption text-gray-400 ml-1">（必填）</span>
            </label>
            <div class="relative">
              <textarea
                v-model="prompt"
                placeholder="描述你想要的图片效果，例如：把图片中的天空变成日落、让人物戴上墨镜、生成一只坐在沙发上的猫..."
                maxlength="1000"
                class="w-full p-4 pr-10 pb-7 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
                :class="{ 'border-red-400': promptTouched && !prompt.trim() }"
                :disabled="isLoading"
                @blur="promptTouched = true"
              ></textarea>
              <button
                v-if="prompt"
                type="button"
                @click="clearPrompt"
                :disabled="isLoading"
                title="清空提示词（会同时清空本地缓存）"
                class="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <!-- 字符计数：右下角 -->
              <span
                class="absolute bottom-2 right-3 text-caption pointer-events-none tabular-nums"
                :class="prompt.length >= 1000 ? 'text-red-500 font-semibold' : prompt.length >= 800 ? 'text-amber-500' : 'text-gray-400'"
              >{{ prompt.length }} / 1000</span>
            </div>
            <span v-if="promptTouched && !prompt.trim()" class="text-caption text-red-500 mt-1 block">
              请输入提示词
            </span>
            <span v-else class="text-caption text-gray-400 mt-1 block">
              {{ imageFile ? '上传了参考图 + 描述修改效果 = 图生图；仅描述不传图 = 文生图' : '输入文字描述，AI为你生成图片' }}
            </span>
          </div>

          <!-- 模型 & 尺寸（一行一个） -->
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-body-sm font-medium text-gray-700 mb-2">模型</label>
              <select
                v-model="selectedModel"
                class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                :disabled="isLoading"
              >
                <option v-for="m in modelList" :key="m.model_key" :value="m.model_key">
                  {{ m.model_label }}{{ m.credit_cost > 0 ? `（${m.credit_cost} 积分）` : '' }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-body-sm font-medium text-gray-700 mb-2">输出尺寸</label>
              <select
                v-model="selectedSize"
                class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                :disabled="isLoading"
              >
                <option v-for="s in sizeOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
          </div>

          <!-- 生成按钮 + 悬浮模式徽章 -->
          <div class="relative group/btn">
            <!-- 模式徽章：悬浮在按钮左上角 + 呼吸光晕 + hover 摆动 -->
            <div
              class="absolute -top-3 -left-2 z-20 pointer-events-none select-none transition-transform duration-300 group-hover/btn:scale-110"
              :class="imageFile ? 'rotate-[-6deg] group-hover/btn:rotate-[-10deg]' : 'rotate-[6deg] group-hover/btn:rotate-[10deg]'"
            >
              <!-- 呼吸光晕（box-shadow 脉冲） -->
              <div
                class="absolute inset-0 rounded-full mode-badge-aura pointer-events-none"
                :class="imageFile
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'"
              ></div>
              <div
                class="relative px-3 py-1 rounded-full text-xs font-semibold shadow-lg ring-2 ring-white/40 backdrop-blur-sm flex items-center gap-1.5"
                :class="imageFile
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'"
              >
                <span class="inline-block animate-pulse">{{ imageFile ? '🖼️' : '✨' }}</span>
                <span>{{ imageFile ? 'AI 图片编辑' : '文生图' }}</span>
              </div>
            </div>

            <button
              ref="btnRef"
              @click="generateImage"
              :disabled="!canGenerate"
              class="relative w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 overflow-hidden shadow-lg transition-all duration-300 ease-out group"
              :class="canGenerate && !isLoading
                ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:-translate-y-0.5 hover:shadow-2xl hover:brightness-110 hover:saturate-150 active:translate-y-0 active:scale-[0.99]'
                : 'bg-gray-300 cursor-not-allowed shadow-none'"
            >
              <!-- 扫光层：hover 时扫过 -->
              <span
                v-if="canGenerate && !isLoading"
                aria-hidden="true"
                class="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-white/30 blur-md opacity-0 group-hover:opacity-100"
                style="animation: btn-shine 1.1s ease-in-out infinite;"
              ></span>

              <template v-if="isLoading">
                <span class="relative z-10 flex items-center gap-3">
                  <span ref="dotsRef" class="flex gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-white" />
                    <span class="w-2.5 h-2.5 rounded-full bg-white" />
                    <span class="w-2.5 h-2.5 rounded-full bg-white" />
                  </span>
                  <span class="text-body-lg tracking-wider">AI 生成中</span>
                </span>
              </template>
              <template v-else>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{{ currentModelCost > 0 ? `开始生成（${currentModelCost} 积分）` : '开始生成' }}</span>
              </template>
            </button>
          </div>

          <!-- 生成中警示：勿关闭浏览器 -->
          <div
            v-if="isLoading"
            class="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-caption"
          >
            <svg class="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <span>
              <strong>请勿关闭浏览器或刷新页面</strong>，否则请求将提前终止，已扣积分会自动退还
              <span v-if="currentModelCost === 0" class="text-amber-700">（当前为免费）</span>
            </span>
          </div>
        </div>

        <!-- 右侧：结果区 -->
        <div class="space-y-4">
          <label class="block text-body-sm font-medium text-gray-700">生成结果</label>

          <!-- 空状态 -->
          <div
            v-if="!resultImageUrl && !isLoading"
            class="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center py-16 text-gray-400"
          >
            <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="text-body-sm">点击「开始生成」查看结果</span>
          </div>

          <!-- Loading canvas 动画 -->
          <div
            v-if="isLoading"
            class="relative border rounded-xl overflow-hidden bg-gray-950 flex flex-col items-center justify-center"
            style="min-height: 360px;"
          >
            <canvas ref="loadingCanvas" class="absolute inset-0 w-full h-full" />
            <!-- 覆盖层文字 -->
            <div class="relative z-10 flex flex-col items-center gap-4 pointer-events-none">
              <!-- AI 灯泡图标 -->
              <div class="relative w-20 h-20 flex items-center justify-center">
                <div class="absolute inset-0 rounded-full bg-purple-500/20 animate-ping-slow" />
                <svg class="w-10 h-10 text-purple-300 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span class="text-white/90 font-semibold text-h4 tracking-wide">AI 正在创作</span>
              <div class="flex items-center gap-2 text-purple-300/80 text-body-sm">
                <span class="font-mono tabular-nums min-w-[3ch] text-right">{{ formatElapsed(elapsedSeconds) }}</span>
                <span>·</span>
                <span>{{ elapsedSeconds < 10 ? '分析构思中' : elapsedSeconds < 25 ? '精细渲染中' : '即将完成' }}</span>
                <span class="animate-bounce ml-0.5">...</span>
              </div>
              <!-- 请勿关闭浏览器 -->
              <div
                class="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/20 ring-1 ring-amber-400/40 text-amber-200 text-caption flex items-center gap-1.5 pointer-events-auto"
              >
                <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
                <span>请勿关闭浏览器或刷新页面，否则请求将提前终止，已扣积分会自动退还</span>
              </div>
            </div>
          </div>

          <!-- 结果展示：自然比例，点击放大（el-image 内置预览） -->
          <div v-if="resultImageUrl && !isLoading" class="space-y-4">
            <el-image
              :src="resultImageUrl"
              :preview-src-list="[resultImageUrl]"
              :initial-index="0"
              fit="contain"
              class="block w-full"
              style="cursor: zoom-in;"
              draggable="false"
              alt="生成结果"
            />
            <div class="flex gap-3">
              <button
                @click="downloadImage"
                class="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                下载图片
              </button>
              <button
                @click="openInNewTab"
                class="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                新标签页查看
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ToolDetail title="功能说明">
      <div class="space-y-3 text-body-sm text-ink-800">
        <p><strong>两种使用模式：</strong></p>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong>文生图：</strong>仅输入文字描述，AI根据描述生成图片。</li>
          <li><strong>图生图（图片编辑）：</strong>上传参考图片 + 输入编辑描述，AI根据你的指令修改图片。</li>
        </ul>
        <p><strong>模型说明：</strong></p>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong>gpt-image-2：</strong>通用图片编辑/生成模型，适用于文生图和图生图任务。</li>
        </ul>
        <p class="text-ink-500">提示：生成结果受提示词质量影响，详细的描述通常能得到更好的效果。</p>
      </div>
    </ToolDetail>

    <!-- 用户生成历史弹窗 -->
    <GenerationHistoryDialog ref="historyRef" />
  </div>
</template>

<style scoped>
.el-upload {
  width: 100%;
}
:deep(.el-upload-dragger) {
  width: 100%;
  border-radius: 12px;
}
</style>

<style>
/* 全局 keyframes */
@keyframes ping-slow {
  0%   { transform: scale(1); opacity: 0.4; }
  50%  { transform: scale(1.8); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
.animate-ping-slow {
  animation: ping-slow 2.5s ease-out infinite;
}

/* 模式徽章：呼吸光晕（box-shadow 强度脉冲） */
@keyframes mode-aura {
  0%, 100% { transform: scale(1);    opacity: 0.35; filter: blur(2px); }
  50%      { transform: scale(1.18); opacity: 0.65; filter: blur(4px); }
}
.mode-badge-aura {
  animation: mode-aura 2.4s ease-in-out infinite;
  z-index: -1;
}

/* 按钮 hover：彩虹扫光（更炫酷） */
@keyframes btn-shine {
  0%   { transform: translateX(-100%) skewX(-12deg); }
  100% { transform: translateX(220%)  skewX(-12deg); }
}
</style>

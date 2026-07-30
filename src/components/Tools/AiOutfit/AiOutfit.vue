<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { UploadProps } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import GenerationHistoryDialog from '@/components/Tools/AiImageEdit/GenerationHistoryDialog.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { autoDown } from '@/utils/file'
import { functionsRequest } from '@/utils/functionsRequest'
import { fetchToolModels, type PublicToolModel } from '@/api/tool-models'
import { fetchMyGenerationRecordImage } from '@/api/me'
import { useUserStore } from '@/store/modules/user'

const info = reactive({
  title: 'AI 穿搭建议',
  desc: '上传一张人物照片，再选择是否上传衣物照片，即可一键生成穿搭建议图：未传衣物时 AI 自动设计穿搭，传了衣物时把人物身上衣物替换为指定衣物。',
})

// ============ 模型 + 尺寸 ============
const modelList = ref<PublicToolModel[]>([])
const modelLoaded = ref(false)
const selectedModel = ref<string>('')
const currentModelCost = computed(() => {
  const m = modelList.value.find((x) => x.model_key === selectedModel.value)
  return m?.credit_cost ?? 0
})

const sizeOptions = [
  { value: 'auto', label: '自动（推荐）' },
  { value: '1024x1024', label: '1:1 正方形' },
  { value: '1024x1792', label: '9:16 竖版' },
  { value: '1792x1024', label: '16:9 横版' },
]
const selectedSize = ref(sizeOptions[0].value)

// 风格 / 场景 prompt（可选）
const stylePrompt = ref('')

// ============ 用户 / 历史 ============
const userStore = useUserStore()
const router = useRouter()
const historyRef = ref<InstanceType<typeof GenerationHistoryDialog> | null>(null)

const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

const openHistory = () => {
  if (isMobile.value) {
    router.push('/ai-outfit/history')
  } else {
    historyRef.value?.open()
  }
}

// ============ 人物照（必填）============
const personUploadRef = ref<any>(null)
const personFile = ref<File | null>(null)
const personPreview = ref('')
const personFileName = ref('')

const handlePersonExceed: UploadProps['onExceed'] = (files) => {
  personUploadRef.value!.clearFiles()
  processPersonFile(files[0] as File)
}
const handlePersonUpload = (options: any): Promise<void> => {
  return new Promise((resolve) => {
    processPersonFile(options.file as File)
    resolve()
  })
}
const removePersonImage = () => {
  personFile.value = null
  personPreview.value = ''
  personFileName.value = ''
  personUploadRef.value?.clearFiles()
}
const processPersonFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  personFile.value = file
  personFileName.value = file.name || 'person.png'
  const reader = new FileReader()
  reader.onload = (e) => { personPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
  ElMessage.success('人物照已就绪')
}

// ============ 衣物照（可选）============
const clothingUploadRef = ref<any>(null)
const clothingFile = ref<File | null>(null)
const clothingPreview = ref('')
const clothingFileName = ref('')

const handleClothingExceed: UploadProps['onExceed'] = (files) => {
  clothingUploadRef.value!.clearFiles()
  processClothingFile(files[0] as File)
}
const handleClothingUpload = (options: any): Promise<void> => {
  return new Promise((resolve) => {
    processClothingFile(options.file as File)
    resolve()
  })
}
const removeClothingImage = () => {
  clothingFile.value = null
  clothingPreview.value = ''
  clothingFileName.value = ''
  clothingUploadRef.value?.clearFiles()
}
const processClothingFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }
  clothingFile.value = file
  clothingFileName.value = file.name || 'clothing.png'
  const reader = new FileReader()
  reader.onload = (e) => { clothingPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
  ElMessage.success('衣物照已就绪')
}

// 粘贴图片：优先人物照位，已有人物照则填衣物照
const handlePaste = (e: ClipboardEvent) => {
  if (isLoading.value) return
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (!blob) return
      const file = new File([blob], personFile.value ? 'clothing.png' : 'person.png', { type: blob.type })
      if (personFile.value) {
        processClothingFile(file)
      } else {
        processPersonFile(file)
      }
      return
    }
  }
}

// ============ 加载态 / 动画 ============
const isLoading = ref(false)
const resultImageUrl = ref('')
const currentRecordId = ref('')
const elapsedSeconds = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

const loadingCanvas = ref<HTMLCanvasElement | null>(null)
let canvasAnimId = 0
interface Particle { x: number; y: number; vx: number; vy: number; r: number; hue: number; alpha: number }
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
  const hues = [340, 320, 280, 220, 30] // 暖色：粉/紫/蓝/橙
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * W(), y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2.5 + 1, hue: hues[Math.floor(Math.random() * hues.length)],
      alpha: Math.random() * 0.5 + 0.3,
    })
  }
  let frame = 0
  const draw = () => {
    const w = W(); const h = H()
    ctx.clearRect(0, 0, w, h)
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
    const cx = w / 2; const cy = h / 2
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 90) {
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          const alpha = (1 - dist / 90) * 0.18
          ctx.strokeStyle = `hsla(${particles[i].hue}, 60%, 65%, ${alpha})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
      const adx = cx - particles[i].x
      const ady = cy - particles[i].y
      const adist = Math.sqrt(adx * adx + ady * ady) || 1
      if (adist < 80) {
        particles[i].vx += adx / adist * 0.02
        particles[i].vy += ady / adist * 0.02
      }
    }
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + Math.sin(frame * 0.03) * 10)
    glow.addColorStop(0, 'rgba(236,72,153,0.15)')
    glow.addColorStop(0.5, 'rgba(168,85,247,0.06)')
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

const btnRef = ref<HTMLButtonElement | null>(null)
let btnAnimId = 0
let btnPhase = 0
const startBtnAnim = () => {
  if (!btnRef.value) return
  const btn = btnRef.value
  const colors = [
    [0xec, 0x48, 0x99], // pink
    [0xa8, 0x55, 0xf7], // purple
    [0x63, 0x66, 0xf1], // indigo
    [0xa8, 0x55, 0xf7], // purple
    [0xec, 0x48, 0x99], // pink
  ]
  const step = () => {
    btnPhase = (btnPhase + 0.004) % 1
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
  if (btnRef.value) btnRef.value.style.background = ''
}

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

watch(isLoading, (val) => {
  if (val) {
    setTimeout(() => {
      startBtnAnim(); startDotsAnim(); startCanvasLoading()
    }, 50)
  } else {
    stopBtnAnim(); stopDotsAnim(); stopCanvasLoading()
  }
})

const formatElapsed = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
}

// 必填校验：人物照必须有；衣物照可选
const canGenerate = computed(() => {
  return !isLoading.value
    && modelLoaded.value
    && modelList.value.length > 0
    && !!selectedModel.value
    && !!personFile.value
})

// ============ 调后端 ============
const fetchModelList = async () => {
  try {
    const list = await fetchToolModels('/ai-outfit/')
    modelList.value = list
    if (list.length > 0) {
      const def = list.find((m) => m.is_default) || list[0]
      selectedModel.value = def.model_key
    }
  } catch (err) {
    console.warn('[ai-outfit] fetchModelList failed', err)
  } finally {
    modelLoaded.value = true
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  document.addEventListener('paste', handlePaste)
  fetchModelList()
})
onUnmounted(() => {
  document.removeEventListener('paste', handlePaste)
  window.removeEventListener('resize', updateIsMobile)
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
  stopCanvasLoading()
  stopBtnAnim()
  stopDotsAnim()
})

const generateImage = async () => {
  if (!canGenerate.value) {
    if (!modelLoaded.value) {
      ElMessage.warning('模型列表加载中，请稍候')
    } else if (modelList.value.length === 0 || !selectedModel.value) {
      ElMessage.error('暂无可用模型，请联系管理员配置')
    } else if (!personFile.value) {
      ElMessage.warning('请先上传人物照')
    } else {
      ElMessage.warning('请检查输入后重试')
    }
    return
  }

  isLoading.value = true
  resultImageUrl.value = ''
  elapsedSeconds.value = 0
  elapsedTimer = setInterval(() => { elapsedSeconds.value++ }, 1000)

  const cost = currentModelCost.value
  const balanceBefore = userStore.credits.balance
  if (cost > 0 && balanceBefore >= cost) {
    userStore.setBalance(balanceBefore - cost)
  }
  const revertOptimistic = () => {
    if (cost > 0) userStore.setBalance(balanceBefore)
  }

  try {
    const fd = new FormData()
    fd.append('model', selectedModel.value)
    fd.append('size', selectedSize.value)
    fd.append('personImage', personFile.value!)
    if (clothingFile.value) {
      fd.append('clothingImage', clothingFile.value)
    }
    if (stylePrompt.value.trim()) {
      fd.append('style', stylePrompt.value.trim())
    }

    const idempotencyKey = crypto.randomUUID()
    const res = await functionsRequest.post('/api/ai-outfit', fd, {
      timeout: 660000,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    const data = res.data

    if (!data.ok) {
      ElMessage.error(data.error || '生成失败')
      revertOptimistic()
      if (typeof data.balance === 'number') {
        userStore.setBalance(data.balance)
      } else {
        userStore.fetchCredits(true)
      }
      return
    }

    resultImageUrl.value = data.data?.url || ''
    currentRecordId.value = data.data?.recordId || ''
    if (typeof data.data?.balanceAfter === 'number') {
      userStore.setBalance(data.data.balanceAfter)
    }
    if (resultImageUrl.value) {
      ElMessage.success('穿搭建议图生成成功')
    } else {
      ElMessage.warning('生成完成但未获取到图片URL')
    }
  } catch (error: any) {
    console.error('生成穿搭建议失败:', error)
    revertOptimistic()
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

// 下载生成的图片
const downloadImage = () => {
  if (!resultImageUrl.value) return
  if (currentRecordId.value) {
    fetchMyGenerationRecordImage(currentRecordId.value)
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob)
        autoDown(url, filename)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      })
      .catch(() => {
        window.open(resultImageUrl.value, '_blank', 'noopener,noreferrer')
      })
    return
  }
  fetch(resultImageUrl.value)
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      autoDown(url, `ai-outfit-${Date.now()}.png`)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
    .catch(() => {
      window.open(resultImageUrl.value, '_blank', 'noopener,noreferrer')
    })
}
const openInNewTab = () => {
  if (resultImageUrl.value) window.open(resultImageUrl.value, '_blank')
}

// 清空风格 prompt
const clearStyle = () => { stylePrompt.value = '' }

// ============ 模板渲染辅助 ============
const modeBadge = computed(() => clothingFile.value
  ? { icon: '🔁', label: '衣物替换', gradient: 'from-blue-500 to-cyan-500' }
  : { icon: '✨', label: 'AI 自动穿搭', gradient: 'from-pink-500 to-rose-500' })
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

    <!-- 介绍卡 -->
    <div class="px-4">
      <div class="rounded-2xl bg-gradient-to-r from-pink-50 via-rose-50 to-purple-50 p-4 border border-pink-100">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-2xl">👗</span>
          <h2 class="text-base font-semibold text-gray-800">AI 穿搭建议</h2>
        </div>
        <p class="text-sm text-gray-600 leading-relaxed">
          上传一张清晰的人物照片（必填），再选择是否上传衣物照片：不上传衣物时 AI 自动设计一套完整穿搭，上传衣物时把人物身上的衣物替换为指定衣物。
        </p>
      </div>
    </div>

    <div class="p-4 rounded-2xl bg-white mx-4 mt-3">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <!-- 左：输入区 -->
        <div class="space-y-6">

          <!-- 人物照（必填） -->
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-2">
              人物照 <span class="text-red-500">*</span>
              <span class="text-caption text-red-400 ml-1">必填</span>
            </label>
            <el-upload
              ref="personUploadRef"
              class="w-full"
              drag
              :auto-upload="true"
              :limit="1"
              :on-exceed="handlePersonExceed"
              :http-request="handlePersonUpload"
              :show-file-list="false"
              accept="image/png,image/jpeg,image/webp,image/gif"
            >
              <div v-if="!personPreview" class="flex flex-col items-center justify-center py-3">
                <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="text-body-sm text-gray-500">上传人物正面照 或 Ctrl+V 粘贴</span>
                <span class="text-caption text-gray-400 mt-0.5">要求人物清晰、姿态自然、面部可见；光线充足</span>
              </div>
              <div v-else class="relative w-full" @click.stop>
                <img :src="personPreview" class="max-h-32 mx-auto rounded-lg object-contain" alt="人物预览" />
                <span class="block text-center text-caption text-gray-500 mt-1">{{ personFileName }}</span>
                <span class="block text-center text-caption text-gray-400 mt-0.5">点击周围空白、拖拽新图片 或 Ctrl+V 粘贴 即可替换</span>
              </div>
            </el-upload>
            <button
              v-if="personPreview"
              @click="removePersonImage"
              class="mt-2 text-body-sm text-red-500 hover:text-red-700 flex items-center"
            >
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              移除人物照
            </button>
          </div>

          <!-- 衣物照（可选） -->
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-2">
              衣物照
              <span class="text-caption text-gray-400 ml-1">可选，不上传则 AI 自动设计穿搭</span>
            </label>
            <el-upload
              ref="clothingUploadRef"
              class="w-full"
              drag
              :auto-upload="true"
              :limit="1"
              :on-exceed="handleClothingExceed"
              :http-request="handleClothingUpload"
              :show-file-list="false"
              accept="image/png,image/jpeg,image/webp,image/gif"
            >
              <div v-if="!clothingPreview" class="flex flex-col items-center justify-center py-3">
                <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                <span class="text-body-sm text-gray-500">上传衣物照（可选）</span>
                <span class="text-caption text-gray-400 mt-0.5">建议单品清晰、背景干净；多件单品（上下装+配饰）也能识别</span>
              </div>
              <div v-else class="relative w-full" @click.stop>
                <img :src="clothingPreview" class="max-h-32 mx-auto rounded-lg object-contain" alt="衣物预览" />
                <span class="block text-center text-caption text-gray-500 mt-1">{{ clothingFileName }}</span>
                <span class="block text-center text-caption text-gray-400 mt-0.5">点击周围空白、拖拽新图片 即可替换</span>
              </div>
            </el-upload>
            <button
              v-if="clothingPreview"
              @click="removeClothingImage"
              class="mt-2 text-body-sm text-red-500 hover:text-red-700 flex items-center"
            >
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              移除衣物照（退回「自动设计穿搭」模式）
            </button>
          </div>

          <!-- 风格 / 场景（可选） -->
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-2">
              风格 / 场景
              <span class="text-caption text-gray-400 ml-1">（可选，留空走默认）</span>
            </label>
            <div class="relative">
              <textarea
                v-model="stylePrompt"
                placeholder="例如：商务休闲 / 夏日海边 / 约会 / 街头潮流 / 学院风 / 晚宴礼服 / 居家舒适…"
                maxlength="200"
                class="w-full p-4 pr-10 pb-7 border rounded-lg focus:ring-2 focus:ring-pink-500 min-h-[80px] resize-y"
                :disabled="isLoading"
              ></textarea>
              <button
                v-if="stylePrompt"
                type="button"
                @click="clearStyle"
                :disabled="isLoading"
                title="清空风格"
                class="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span
                class="absolute bottom-2 right-3 text-caption pointer-events-none tabular-nums"
                :class="stylePrompt.length >= 200 ? 'text-red-500 font-semibold' : 'text-gray-400'"
              >{{ stylePrompt.length }} / 200</span>
            </div>
          </div>

          <!-- 模型 + 尺寸 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-body-sm font-medium text-gray-700 mb-2">模型</label>
              <select
                v-model="selectedModel"
                class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500"
                :disabled="isLoading"
              >
                <option v-for="m in modelList" :key="m.model_key" :value="m.model_key">
                  {{ m.model_label }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-body-sm font-medium text-gray-700 mb-2">输出尺寸</label>
              <select
                v-model="selectedSize"
                class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-pink-500"
                :disabled="isLoading"
              >
                <option v-for="s in sizeOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
          </div>

          <!-- 生成按钮 + 模式徽章 -->
          <div class="relative group/btn">
            <div
              class="absolute -top-3 -left-2 z-20 pointer-events-none select-none transition-transform duration-300 group-hover/btn:scale-110"
              :class="clothingFile ? 'rotate-[-6deg] group-hover/btn:rotate-[-10deg]' : 'rotate-[6deg] group-hover/btn:rotate-[10deg]'"
            >
              <div
                class="absolute inset-0 rounded-full mode-badge-aura pointer-events-none bg-gradient-to-r"
                :class="modeBadge.gradient"
              ></div>
              <div
                class="relative px-3 py-1 rounded-full text-xs font-semibold shadow-lg ring-2 ring-white/40 backdrop-blur-sm flex items-center gap-1.5 text-white bg-gradient-to-r"
                :class="modeBadge.gradient"
              >
                <span class="inline-block animate-pulse">{{ modeBadge.icon }}</span>
                <span>{{ modeBadge.label }}</span>
              </div>
            </div>

            <button
              ref="btnRef"
              @click="generateImage"
              :disabled="!canGenerate"
              class="relative w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 overflow-hidden shadow-lg transition-all duration-300 ease-out group"
              :class="canGenerate && !isLoading
                ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:-translate-y-0.5 hover:shadow-2xl hover:brightness-110 hover:saturate-150 active:translate-y-0 active:scale-[0.99]'
                : 'bg-gray-300 cursor-not-allowed shadow-none'"
            >
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
                  <span class="text-body-lg tracking-wider">{{ clothingFile ? '替换衣物中' : '设计穿搭中' }}</span>
                </span>
              </template>
              <template v-else>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span>{{ currentModelCost > 0 ? `开始生成（${currentModelCost} 积分）` : '开始生成' }}</span>
              </template>
            </button>
          </div>

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

        <!-- 右：结果区 -->
        <div class="space-y-4">
          <label class="block text-body-sm font-medium text-gray-700">生成结果</label>

          <div
            v-if="!resultImageUrl && !isLoading"
            class="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center py-16 text-gray-400"
          >
            <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span class="text-body-sm">点击「开始生成」查看结果</span>
          </div>

          <div
            v-if="isLoading"
            class="relative border rounded-xl overflow-hidden bg-gray-950 flex flex-col items-center justify-center"
            style="min-height: 360px;"
          >
            <canvas ref="loadingCanvas" class="absolute inset-0 w-full h-full" />
            <div class="relative z-10 flex flex-col items-center gap-4 pointer-events-none">
              <div class="relative w-20 h-20 flex items-center justify-center">
                <div class="absolute inset-0 rounded-full bg-pink-500/20 animate-ping-slow" />
                <svg class="w-10 h-10 text-pink-300 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <span class="text-white/90 font-semibold text-h4 tracking-wide">{{ clothingFile ? '衣物替换中' : '设计穿搭中' }}</span>
              <div class="flex items-center gap-2 text-pink-300/80 text-body-sm">
                <span class="font-mono tabular-nums min-w-[3ch] text-right">{{ formatElapsed(elapsedSeconds) }}</span>
                <span>·</span>
                <span>{{ elapsedSeconds < 10 ? '解析构图' : elapsedSeconds < 25 ? '设计服装' : '即将完成' }}</span>
                <span class="animate-bounce ml-0.5">...</span>
              </div>
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
                class="flex-1 py-2.5 rounded-lg bg-pink-600 text-white font-medium hover:bg-pink-700 transition-colors flex items-center justify-center gap-2"
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
          <li><strong>AI 自动穿搭：</strong>只上传人物照，AI 根据人物的年龄、气质、姿态自动设计一套完整、风格协调的穿搭（含上衣、下装、鞋子、外套、配饰）。</li>
          <li><strong>衣物替换：</strong>同时上传人物照 + 衣物照，AI 把人物身上的衣物替换为上传的衣物（自然贴合到人物的身体与姿态，含光影与褶皱）。</li>
        </ul>
        <p><strong>风格 / 场景：</strong>在文本框里输入场景描述（商务休闲、夏日海边、约会、街头潮流、学院风、晚宴礼服、居家舒适…），AI 会按场景调整整体造型。留空走默认。</p>
        <p><strong>模型说明：</strong></p>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong>GPT Image 2：</strong>通用图片模型，支持文生图与图生图，速度快、性价比高，适合人物穿搭替换。</li>
          <li><strong>Gemini 3 Pro Image Preview：</strong>Google 旗舰图片模型，质量高、对多张图的理解力强，搭配建议效果最佳。</li>
          <li><strong>Gemini 3.1 Flash Image Preview：</strong>Google Flash 预览版，速度快、性价比高，同样支持多图理解。</li>
        </ul>
        <p class="text-ink-500">提示：人物照请上传清晰正面、面部可见、姿态自然、光线充足的照片，可显著提升效果。</p>
      </div>
    </ToolDetail>

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
@keyframes ping-slow {
  0%   { transform: scale(1); opacity: 0.4; }
  50%  { transform: scale(1.8); opacity: 0; }
  100%  { transform: scale(1); opacity: 0; }
}
.animate-ping-slow {
  animation: ping-slow 2.5s ease-out infinite;
}

@keyframes mode-aura {
  0%, 100% { transform: scale(1);    opacity: 0.35; filter: blur(2px); }
  50%      { transform: scale(1.18); opacity: 0.65; filter: blur(4px); }
}
.mode-badge-aura {
  animation: mode-aura 2.4s ease-in-out infinite;
  z-index: -1;
}

@keyframes btn-shine {
  0%   { transform: translateX(-100%) skewX(-12deg); }
  100% { transform: translateX(220%)  skewX(-12deg); }
}
</style>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ElImageViewer } from 'element-plus'
import type { UploadProps } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import GenerationHistoryDialog from '@/components/Tools/AiImageEdit/GenerationHistoryDialog.vue'
import UserPromptLibraryDialog from '@/components/Common/UserPromptLibraryDialog.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { autoDown } from '@/utils/file'
import { functionsRequest } from '@/utils/functionsRequest'
import { fetchToolModels, type PublicToolModel } from '@/api/tool-models'
import { fetchMyGenerationRecordImage } from '@/api/me'
import { useUserStore } from '@/store/modules/user'

const info = reactive({
  title: 'AI 穿搭建议',
  desc: '上传一张或多张人物照片（必填），再选择是否上传衣物照片（可多件），即可一键生成穿搭建议图：未传衣物时 AI 自动设计穿搭，传了衣物时把人物身上衣物替换为指定衣物。',
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

// 预设场景列表：随机按钮从这里抽一个填入。覆盖正式、休闲、约会、户外等常见场景
const STYLE_PRESETS = [
  '商务休闲',
  '职场精英',
  '夏日海边度假',
  '约会甜美风',
  '街头潮流',
  '学院风',
  '晚宴礼服',
  '居家舒适',
  '运动活力',
  '复古港风',
  '文艺小清新',
  '极简主义',
  '日系森系',
  '工装机能',
  '法式优雅',
  '节日派对',
  '暗黑哥特',
  '中式国风',
] as const

// 随机一个场景：如果当前已有值，优先抽不同的，避免「点了一下没变化」的错觉
const randomStyle = () => {
  const current = stylePrompt.value.trim()
  let pick = STYLE_PRESETS[Math.floor(Math.random() * STYLE_PRESETS.length)]
  // 最多重试 3 次避开当前值（极端小列表场景的安全网）
  for (let i = 0; i < 3 && pick === current; i++) {
    pick = STYLE_PRESETS[Math.floor(Math.random() * STYLE_PRESETS.length)]
  }
  stylePrompt.value = pick
}

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
    // 新标签页打开：留在当前页，正在生成的任务不会因路由跳转被中断
    window.open(router.resolve('/ai-outfit/history').href, '_blank', 'noopener,noreferrer')
  } else {
    historyRef.value?.open()
  }
}

// ============ 人物照（必填，≥1 张）============
// ============ 衣物照（可选）============
// 两人 + 衣物 共用一个 MAX_TOTAL_IMAGES 上限（默认 16）
const MAX_TOTAL_IMAGES = 16
const personUploadRef = ref<any>(null)
const personFiles = ref<File[]>([])
const personPreviews = ref<string[]>([])
const personFileNames = ref<string[]>([])

const clothingUploadRef = ref<any>(null)
const clothingFiles = ref<File[]>([])
const clothingPreviews = ref<string[]>([])
const clothingFileNames = ref<string[]>([])

const totalImageCount = computed(() => personFiles.value.length + clothingFiles.value.length)
const remainingSlots = computed(() => MAX_TOTAL_IMAGES - totalImageCount.value)
const personCanAddMore = computed(() => remainingSlots.value > 0)
const clothingCanAddMore = computed(() => remainingSlots.value > 0)

// 人物照 onChange：每次新增/移除文件都会触发，仅处理新增
const handlePersonChange: UploadProps['onChange'] = (uploadFile) => {
  if (uploadFile.status === 'ready' && uploadFile.raw) {
    addPersonFiles([uploadFile.raw])
  }
  personUploadRef.value?.clearFiles()
}
const handlePersonExceed: UploadProps['onExceed'] = () => {
  ElMessage.warning(`人物照已达 ${MAX_TOTAL_IMAGES} 张上限`)
}
const handlePersonUpload = (_options: any): Promise<void> => Promise.resolve()

const addPersonFiles = (files: File[]) => {
  let added = 0
  for (const file of files) {
    if (!personCanAddMore.value) {
      ElMessage.warning(`人物照已达上限（共 ${MAX_TOTAL_IMAGES} 张）`)
      break
    }
    if (!file.type.startsWith('image/')) {
      ElMessage.error(`已跳过非图片文件：${file.name || '未知'}`)
      continue
    }
    personFiles.value.push(file)
    personFileNames.value.push(file.name || 'person.png')
    const reader = new FileReader()
    reader.onload = (e) => { personPreviews.value.push(e.target?.result as string) }
    reader.readAsDataURL(file)
    added++
  }
  if (added > 0) {
    ElMessage.success(added === 1 ? '人物照已就绪' : `已添加 ${added} 张人物照（${totalImageCount.value}/${MAX_TOTAL_IMAGES}）`)
  }
}

const removePersonImage = (idx: number) => {
  if (isLoading.value) return
  personFiles.value.splice(idx, 1)
  personPreviews.value.splice(idx, 1)
  personFileNames.value.splice(idx, 1)
}

// 衣物照 onChange
const handleClothingChange: UploadProps['onChange'] = (uploadFile) => {
  if (uploadFile.status === 'ready' && uploadFile.raw) {
    addClothingFiles([uploadFile.raw])
  }
  clothingUploadRef.value?.clearFiles()
}
const handleClothingExceed: UploadProps['onExceed'] = () => {
  ElMessage.warning(`衣物照已达 ${MAX_TOTAL_IMAGES} 张上限`)
}
const handleClothingUpload = (_options: any): Promise<void> => Promise.resolve()

const addClothingFiles = (files: File[]) => {
  let added = 0
  for (const file of files) {
    if (!clothingCanAddMore.value) {
      ElMessage.warning(`衣物照已达上限（共 ${MAX_TOTAL_IMAGES} 张）`)
      break
    }
    if (!file.type.startsWith('image/')) {
      ElMessage.error(`已跳过非图片文件：${file.name || '未知'}`)
      continue
    }
    clothingFiles.value.push(file)
    clothingFileNames.value.push(file.name || 'clothing.png')
    const reader = new FileReader()
    reader.onload = (e) => { clothingPreviews.value.push(e.target?.result as string) }
    reader.readAsDataURL(file)
    added++
  }
  if (added > 0) {
    ElMessage.success(added === 1 ? '衣物照已就绪' : `已添加 ${added} 张衣物照（${totalImageCount.value}/${MAX_TOTAL_IMAGES}）`)
  }
}

const removeClothingImage = (idx: number) => {
  if (isLoading.value) return
  clothingFiles.value.splice(idx, 1)
  clothingPreviews.value.splice(idx, 1)
  clothingFileNames.value.splice(idx, 1)
}

// 清空（按钮触发）
const clearAllPersonImages = () => {
  if (isLoading.value) return
  personFiles.value = []
  personPreviews.value = []
  personFileNames.value = []
  personUploadRef.value?.clearFiles()
}
const clearAllClothingImages = () => {
  if (isLoading.value) return
  clothingFiles.value = []
  clothingPreviews.value = []
  clothingFileNames.value = []
  clothingUploadRef.value?.clearFiles()
}

// 粘贴图片：优先人物照位；人物照填满后填衣物照
const handlePaste = (e: ClipboardEvent) => {
  if (isLoading.value) return
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (!blob) return
      const file = new File([blob], `clipboard-${Date.now()}.png`, { type: blob.type })
      // 优先人物照；人物照已满时填衣物照
      if (personFiles.value.length === 0) {
        addPersonFiles([file])
      } else if (personCanAddMore.value) {
        addPersonFiles([file])
      } else if (clothingCanAddMore.value) {
        addClothingFiles([file])
      } else {
        ElMessage.warning(`已达 ${MAX_TOTAL_IMAGES} 张上限`)
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

// 上传原图的全屏放大（点击预览图 → el-image-viewer 弹大图）
const zoomImageUrl = ref<string | null>(null)
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

// 必填校验：人物照必须有（≥1 张）；衣物照可选
const canGenerate = computed(() => {
  return !isLoading.value
    && modelLoaded.value
    && modelList.value.length > 0
    && !!selectedModel.value
    && personFiles.value.length > 0
})

// ============ 调后端 ============

// ============ 拖拽支持：生成结果可直接拖回「人物照」位 ============
// 自定义 MIME，dataTransfer 用它区分「来自本页结果」与「外部文件」。
const RESULT_DRAG_MIME = 'application/x-ai-outfit-result'
// 两个上传位各一套 drag 状态，避免互相干扰
const isDragOverPerson = ref(false)
const isDragOverClothing = ref(false)
let dragCounterPerson = 0
let dragCounterClothing = 0
// 拖拽回填中：人物照 / 衣物照 各一个 state + JS rAF 自驱动 spinner
const isRefillingPerson = ref(false)
const isRefillingClothing = ref(false)
const spinnerPersonRef = ref<HTMLDivElement | null>(null)
const spinnerClothingRef = ref<HTMLDivElement | null>(null)
let spinnerPersonRafId = 0
let spinnerClothingRafId = 0
let spinnerAngle = 0

const startPersonSpinner = () => {
  if (!spinnerPersonRef.value || spinnerPersonRafId) return
  const tick = () => {
    spinnerAngle = (spinnerAngle + 6) % 360
    if (spinnerPersonRef.value) spinnerPersonRef.value.style.transform = `rotate(${spinnerAngle}deg)`
    spinnerPersonRafId = requestAnimationFrame(tick)
  }
  tick()
}
const stopPersonSpinner = () => {
  if (spinnerPersonRafId) { cancelAnimationFrame(spinnerPersonRafId); spinnerPersonRafId = 0 }
}
const startClothingSpinner = () => {
  if (!spinnerClothingRef.value || spinnerClothingRafId) return
  const tick = () => {
    spinnerAngle = (spinnerAngle + 6) % 360
    if (spinnerClothingRef.value) spinnerClothingRef.value.style.transform = `rotate(${spinnerAngle}deg)`
    spinnerClothingRafId = requestAnimationFrame(tick)
  }
  tick()
}
const stopClothingSpinner = () => {
  if (spinnerClothingRafId) { cancelAnimationFrame(spinnerClothingRafId); spinnerClothingRafId = 0 }
}
watch(isRefillingPerson, async (val) => {
  if (val) { await nextTick(); startPersonSpinner() } else { stopPersonSpinner() }
})
watch(isRefillingClothing, async (val) => {
  if (val) { await nextTick(); startClothingSpinner() } else { stopClothingSpinner() }
})

// 人物照 dropzone 回调
const onPersonDragEnter = (e: DragEvent) => {
  e.preventDefault()
  if (isLoading.value) return
  dragCounterPerson++
  const types = e.dataTransfer?.types
  if (!types) return
  if (types.includes('Files') || types.includes(RESULT_DRAG_MIME)) {
    isDragOverPerson.value = true
  }
}
const onPersonDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
const onPersonDragLeave = (e: DragEvent) => {
  e.preventDefault()
  dragCounterPerson = Math.max(0, dragCounterPerson - 1)
  if (dragCounterPerson === 0) isDragOverPerson.value = false
}
// 衣物照 dropzone 回调
const onClothingDragEnter = (e: DragEvent) => {
  e.preventDefault()
  if (isLoading.value) return
  dragCounterClothing++
  const types = e.dataTransfer?.types
  if (!types) return
  if (types.includes('Files') || types.includes(RESULT_DRAG_MIME)) {
    isDragOverClothing.value = true
  }
}
const onClothingDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
const onClothingDragLeave = (e: DragEvent) => {
  e.preventDefault()
  dragCounterClothing = Math.max(0, dragCounterClothing - 1)
  if (dragCounterClothing === 0) isDragOverClothing.value = false
}

// 统一的回填执行：从生成结果拿 blob → 包装成 File → 调用对应 addXxxFiles
async function refillFromResult(resultUrl: string, target: 'person' | 'clothing'): Promise<void> {
  let blob: Blob
  let filename = target === 'person' ? 'person-result.png' : 'clothing-result.png'
  if (currentRecordId.value) {
    const res = await fetchMyGenerationRecordImage(currentRecordId.value)
    blob = res.blob
    if (res.filename) filename = res.filename
  } else {
    const resp = await fetch(resultUrl)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    blob = await resp.blob()
  }
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  // 追加为新图片（不替换已有），addXxxFiles 内部自动校验上限和非图片
  if (target === 'person') {
    addPersonFiles([file])
  } else {
    addClothingFiles([file])
  }
}

// 人物照 drop：capture 阶段先于 el-upload-dragger，识别结果后拦截；文件也自己处理（多图）
const onPersonUploadDrop = async (e: DragEvent) => {
  // 生成中：直接吞掉事件，dropzone 不接收新文件
  if (isLoading.value) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterPerson = 0
    isDragOverPerson.value = false
    return
  }
  const resultUrl =
    e.dataTransfer?.getData(RESULT_DRAG_MIME) ||
    e.dataTransfer?.getData('text/uri-list')?.split('\n')[0] ||
    ''
  if (resultUrl) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterPerson = 0
    isDragOverPerson.value = false
    isRefillingPerson.value = true
    try {
      await refillFromResult(resultUrl, 'person')
    } catch (err) {
      ElMessage.error('读取生成结果失败：' + (err as Error)?.message)
    } finally {
      isRefillingPerson.value = false
    }
    return
  }
  // 多文件拖拽：自己处理（el-upload-dragger 默认只取第一个 file）
  const droppedFiles = Array.from(e.dataTransfer?.files || [])
  if (droppedFiles.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    addPersonFiles(droppedFiles)
  }
  dragCounterPerson = 0
  isDragOverPerson.value = false
}
// 衣物照 drop 同上
const onClothingUploadDrop = async (e: DragEvent) => {
  // 生成中：直接吞掉事件
  if (isLoading.value) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterClothing = 0
    isDragOverClothing.value = false
    return
  }
  const resultUrl =
    e.dataTransfer?.getData(RESULT_DRAG_MIME) ||
    e.dataTransfer?.getData('text/uri-list')?.split('\n')[0] ||
    ''
  if (resultUrl) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterClothing = 0
    isDragOverClothing.value = false
    isRefillingClothing.value = true
    try {
      await refillFromResult(resultUrl, 'clothing')
    } catch (err) {
      ElMessage.error('读取生成结果失败：' + (err as Error)?.message)
    } finally {
      isRefillingClothing.value = false
    }
    return
  }
  const droppedFiles = Array.from(e.dataTransfer?.files || [])
  if (droppedFiles.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    addClothingFiles(droppedFiles)
  }
  dragCounterClothing = 0
  isDragOverClothing.value = false
}

// 拖拽起点：把生成结果 URL 写到 dataTransfer
const onResultDragStart = (e: DragEvent) => {
  if (!e.dataTransfer || !resultImageUrl.value) return
  e.dataTransfer.setData(RESULT_DRAG_MIME, resultImageUrl.value)
  e.dataTransfer.setData('text/uri-list', resultImageUrl.value)
  e.dataTransfer.setData('text/plain', resultImageUrl.value)
  e.dataTransfer.effectAllowed = 'copy'
}

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
  stopPersonSpinner()
  stopClothingSpinner()
})

const generateImage = async () => {
  if (!canGenerate.value) {
    if (!modelLoaded.value) {
      ElMessage.warning('模型列表加载中，请稍候')
    } else if (modelList.value.length === 0 || !selectedModel.value) {
      ElMessage.error('暂无可用模型，请联系管理员配置')
    } else if (personFiles.value.length === 0) {
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
    // 多张人物照
    for (const file of personFiles.value) {
      fd.append('personImages', file)
    }
    // 多张衣物照（可选）
    for (const file of clothingFiles.value) {
      fd.append('clothingImages', file)
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

// 提示词库弹窗：从用户保存的风格列表里选一条直接回填到 stylePrompt
const promptLibraryRef = ref<InstanceType<typeof UserPromptLibraryDialog> | null>(null)
const onPromptSelect = (payload: { id: string; title: string; content: string }) => {
  stylePrompt.value = payload.content
  ElMessage.success(payload.title ? `已填入「${payload.title}」` : '已填入提示词')
}

// ============ 模板渲染辅助 ============
const modeBadge = computed(() => clothingFiles.value.length > 0
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
            <label class="block text-body-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
              <span>
                人物照 <span class="text-red-500">*</span>
                <span class="text-caption text-red-400 ml-1">必填 · 可上传多张</span>
              </span>
              <span class="text-caption text-gray-500 tabular-nums">{{ personFiles.length }} 张</span>
            </label>
            <div
              class="upload-dropzone"
              :class="{ 'is-dragover': isDragOverPerson }"
              @dragenter.prevent="onPersonDragEnter"
              @dragover.prevent="onPersonDragOver"
              @dragleave.prevent="onPersonDragLeave"
              @drop.capture="onPersonUploadDrop"
            >
              <el-upload
                ref="personUploadRef"
                class="w-full"
                drag
                :disabled="isLoading"
                :auto-upload="false"
                :multiple="true"
                :limit="MAX_TOTAL_IMAGES"
                :on-change="handlePersonChange"
                :on-exceed="handlePersonExceed"
                :http-request="handlePersonUpload"
                :show-file-list="false"
                accept="image/png,image/jpeg,image/webp,image/gif"
              >
                <div v-if="personFiles.length === 0" class="flex flex-col items-center justify-center py-3">
                  <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span class="text-body-sm text-gray-500">上传人物正面照 或 Ctrl+V 粘贴</span>
                  <span class="text-caption text-gray-400 mt-0.5">要求人物清晰、姿态自然、面部可见；光线充足</span>
                  <span v-if="isDragOverPerson" class="text-caption text-pink-500 mt-1">松手即可添加</span>
                </div>
                <div v-else class="upload-grid-wrapper">
                  <div class="upload-grid">
                    <div
                      v-for="(preview, idx) in personPreviews"
                      :key="idx"
                      class="upload-thumb"
                      @click.stop
                    >
                      <el-image
                        :src="preview"
                        :preview-src-list="personPreviews"
                        :initial-index="idx"
                        fit="cover"
                        class="upload-thumb-img"
                        alt="人物预览"
                      />
                      <button
                        type="button"
                        @click.stop="removePersonImage(idx)"
                        class="upload-thumb-remove"
                        :disabled="isLoading"
                        :title="`移除 ${personFileNames[idx] || ''}`"
                        aria-label="移除人物照"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span class="upload-thumb-name">{{ personFileNames[idx] }}</span>
                    </div>
                    <div v-if="personCanAddMore && !isLoading" class="upload-add-tile" :title="`还可添加 ${remainingSlots} 张`">
                      <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span class="text-caption text-gray-400 mt-0.5">还可添加 {{ remainingSlots }} 张</span>
                    </div>
                  </div>
                  <p class="text-caption text-gray-400 mt-2 text-center">
                    点击缩略图放大 · 点击 ✕ 移除单张 · 拖拽新图 或 Ctrl+V 粘贴继续添加
                  </p>
                </div>
              </el-upload>

              <!-- 拖拽回填中 loading（JS rAF 自驱动） -->
              <div v-if="isRefillingPerson" class="refill-overlay" role="status" aria-live="polite">
                <div ref="spinnerPersonRef" class="refill-spinner" aria-hidden="true"></div>
                <span class="refill-text">正在读取生成结果…</span>
              </div>
            </div>
            <button
              v-if="personFiles.length > 0"
              @click="clearAllPersonImages"
              :disabled="isLoading"
              class="mt-2 text-body-sm text-red-500 hover:text-red-700 flex items-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-500"
            >
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              清空人物照
            </button>
          </div>

          <!-- 衣物照（可选，可多张） -->
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
              <span>
                衣物照
                <span class="text-caption text-gray-400 ml-1">可选 · 多件单品一起传</span>
              </span>
              <span class="text-caption text-gray-500 tabular-nums">{{ clothingFiles.length }} 张</span>
            </label>
            <div
              class="upload-dropzone"
              :class="{ 'is-dragover': isDragOverClothing }"
              @dragenter.prevent="onClothingDragEnter"
              @dragover.prevent="onClothingDragOver"
              @dragleave.prevent="onClothingDragLeave"
              @drop.capture="onClothingUploadDrop"
            >
              <el-upload
                ref="clothingUploadRef"
                class="w-full"
                drag
                :disabled="isLoading"
                :auto-upload="false"
                :multiple="true"
                :limit="MAX_TOTAL_IMAGES"
                :on-change="handleClothingChange"
                :on-exceed="handleClothingExceed"
                :http-request="handleClothingUpload"
                :show-file-list="false"
                accept="image/png,image/jpeg,image/webp,image/gif"
              >
                <div v-if="clothingFiles.length === 0" class="flex flex-col items-center justify-center py-3">
                  <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <span class="text-body-sm text-gray-500">上传衣物照（可选，可多张）</span>
                  <span class="text-caption text-gray-400 mt-0.5">建议单品清晰、背景干净；多件单品（上下装+配饰）也能识别</span>
                  <span v-if="isDragOverClothing" class="text-caption text-pink-500 mt-1">松手即可添加</span>
                </div>
                <div v-else class="upload-grid-wrapper">
                  <div class="upload-grid">
                    <div
                      v-for="(preview, idx) in clothingPreviews"
                      :key="idx"
                      class="upload-thumb"
                      @click.stop
                    >
                      <el-image
                        :src="preview"
                        :preview-src-list="clothingPreviews"
                        :initial-index="idx"
                        fit="cover"
                        class="upload-thumb-img"
                        alt="衣物预览"
                      />
                      <button
                        type="button"
                        @click.stop="removeClothingImage(idx)"
                        class="upload-thumb-remove"
                        :disabled="isLoading"
                        :title="`移除 ${clothingFileNames[idx] || ''}`"
                        aria-label="移除衣物照"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span class="upload-thumb-name">{{ clothingFileNames[idx] }}</span>
                    </div>
                    <div v-if="clothingCanAddMore && !isLoading" class="upload-add-tile" :title="`还可添加 ${remainingSlots} 张`">
                      <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span class="text-caption text-gray-400 mt-0.5">还可添加 {{ remainingSlots }} 张</span>
                    </div>
                  </div>
                  <p class="text-caption text-gray-400 mt-2 text-center">
                    点击缩略图放大 · 点击 ✕ 移除单张 · 拖拽新图 继续添加
                  </p>
                </div>
              </el-upload>

              <!-- 拖拽回填中 loading（JS rAF 自驱动） -->
              <div v-if="isRefillingClothing" class="refill-overlay" role="status" aria-live="polite">
                <div ref="spinnerClothingRef" class="refill-spinner" aria-hidden="true"></div>
                <span class="refill-text">正在读取生成结果…</span>
              </div>
            </div>
            <button
              v-if="clothingFiles.length > 0"
              @click="clearAllClothingImages"
              :disabled="isLoading"
              class="mt-2 text-body-sm text-red-500 hover:text-red-700 flex items-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-500"
            >
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              清空衣物照（退回「自动设计穿搭」模式）
            </button>
          </div>

          <!-- 风格 / 场景（可选） -->
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-2">
              风格 / 场景
              <span class="text-caption text-gray-400 ml-1">（可选，留空走默认）</span>
              <button
                type="button"
                @click="randomStyle"
                :disabled="isLoading"
                title="随机一个场景提示词"
                class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium border border-pink-300 text-pink-700 hover:bg-pink-50 active:bg-pink-100 active:rotate-180 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 3h5v5M4 20l5-5M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
                随机
              </button>
              <button
                type="button"
                @click="promptLibraryRef?.open()"
                :disabled="isLoading"
                title="从提示词库选择（需要登录）"
                class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 active:bg-blue-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                </svg>
                从提示词库选择
              </button>
            </label>
            <div class="relative">
              <textarea
                v-model="stylePrompt"
                placeholder="例如：商务休闲 / 夏日海边 / 约会 / 街头潮流 / 学院风 / 晚宴礼服 / 居家舒适…"
                maxlength="5000"
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
                :class="stylePrompt.length >= 5000 ? 'text-red-500 font-semibold' : stylePrompt.length >= 4000 ? 'text-amber-500' : 'text-gray-400'"
              >{{ stylePrompt.length }} / 5000</span>
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
              :class="clothingFiles.length > 0 ? 'rotate-[-6deg] group-hover/btn:rotate-[-10deg]' : 'rotate-[6deg] group-hover/btn:rotate-[10deg]'"
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
                  <span class="text-body-lg tracking-wider">{{ clothingFiles.length > 0 ? '替换衣物中' : '设计穿搭中' }}</span>
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
              <strong>请勿关闭浏览器或刷新页面</strong>，否则请求将提前终止，已扣积分不会返还
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
              <span class="text-white/90 font-semibold text-h4 tracking-wide">{{ clothingFiles.length > 0 ? '衣物替换中' : '设计穿搭中' }}</span>
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
                <span>请勿关闭浏览器或刷新页面，否则请求将提前终止，已扣积分不会返还</span>
              </div>
            </div>
          </div>

          <div v-if="resultImageUrl && !isLoading" class="space-y-4">
            <div
              class="result-draggable"
              draggable="true"
              @dragstart="onResultDragStart"
            >
              <el-image
                :src="resultImageUrl"
                :preview-src-list="[resultImageUrl]"
                :initial-index="0"
                fit="contain"
                class="block w-full"
                style="cursor: zoom-in;"
                alt="生成结果"
              />
              <p class="text-caption text-gray-400 text-center mt-1 select-none">
                拖拽此图片到上方「人物照」或「衣物照」位即可继续编辑
              </p>
            </div>
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
    <UserPromptLibraryDialog ref="promptLibraryRef" scene="ai-outfit" @select="onPromptSelect" />

    <!-- 上传原图点击放大（人物照 / 衣物照 共用） -->
    <el-image-viewer
      v-if="zoomImageUrl"
      :url-list="[zoomImageUrl]"
      :initial-index="0"
      @close="zoomImageUrl = null"
    />
  </div>
</template>

<style scoped>
.el-upload {
  width: 100%;
}
:deep(.el-upload-dragger) {
  width: 100%;
  border-radius: 12px;
  /* 覆盖 EP 默认 overflow:hidden —— 不然长图会被裁掉只显示上半部分 */
  overflow: visible;
  padding: 12px;
}

/* 上传预览图：完整显示任意比例图片（fit="contain" + 合理 max-height 防止超高图撑爆布局）*/
.upload-preview-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}
:deep(.upload-preview-image) {
  display: block;
  max-width: 100%;
  max-height: 480px;
  width: auto;
  height: auto;
  margin: 0 auto;
}
:deep(.upload-preview-image img) {
  display: block;
  max-width: 100%;
  max-height: 480px;
  width: auto;
  height: auto;
  object-fit: contain;
  cursor: zoom-in;
}

/* ============ 多图上传：缩略图网格 ============ */
.upload-grid-wrapper {
  width: 100%;
  padding: 4px;
}
.upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.upload-thumb {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  cursor: zoom-in;
  transition: border-color .15s ease, transform .15s ease;
}
.upload-thumb:hover {
  border-color: #f9a8d4;          /* pink-300，与穿搭主题呼应 */
}
:deep(.upload-thumb-img) {
  display: block;
  width: 100%;
  height: 100%;
}
:deep(.upload-thumb-img img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.upload-thumb-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity .15s ease, background-color .15s ease, transform .15s ease;
  z-index: 2;
  cursor: pointer;
}
.upload-thumb:hover .upload-thumb-remove,
.upload-thumb-remove:focus-visible {
  opacity: 1;
}
.upload-thumb-remove:hover {
  background: #ec4899;             /* pink-500 */
  transform: scale(1.08);
}
.upload-thumb-remove:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  transform: none;
  background: rgba(0, 0, 0, 0.55);
}
@media (hover: none) {
  .upload-thumb-remove {
    opacity: 1;
  }
}
.upload-thumb-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 2px 6px;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.upload-add-tile {
  aspect-ratio: 1 / 1;
  border: 1.5px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fafafa;
  cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease;
}
.upload-add-tile:hover {
  border-color: #ec4899;
  background: #fdf2f8;
}

/* ============ 拖拽视觉反馈（粉色主题，AiOutfit 配色）============ */
.upload-dropzone {
  position: relative;
  border-radius: 12px;
  transition: background-color .15s ease;
}
.upload-dropzone.is-dragover :deep(.el-upload-dragger) {
  border-color: #ec4899;          /* pink-500 */
  background-color: rgb(var(--accent-50, 253 242 248));
  box-shadow: 0 0 0 3px rgba(236, 72, 153, .15) inset;
}
.upload-dropzone.is-dragover :deep(.el-upload-dragger) * {
  pointer-events: none;
}

/* ============ 拖拽回填 loading 遮罩 + JS rAF 自驱动 spinner ============ */
.refill-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  pointer-events: none;
}
.refill-spinner {
  display: block;
  width: 28px;
  height: 28px;
  border: 3px solid #fce7f3;          /* pink-100 */
  border-top-color: #ec4899;          /* pink-500 */
  border-radius: 50%;
  will-change: transform;
}
.refill-text {
  font-size: 13px;
  color: #4b5563;
  letter-spacing: 0.02em;
}

/* ============ 生成结果可拖区域 ============ */
.result-draggable {
  border-radius: 8px;
  transition: outline-color .15s ease;
  outline: 2px dashed transparent;
  outline-offset: 4px;
}
.result-draggable:hover {
  outline-color: #f9a8d4;          /* pink-300 */
  cursor: grab;
}
.result-draggable:active {
  cursor: grabbing;
  outline-color: #ec4899;
}
/* 阻止 el-image 内部 img 在拖动时浏览器默认「拖出新标签」预览 */
:deep(.result-draggable img) {
  -webkit-user-drag: element;
  user-drag: element;
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

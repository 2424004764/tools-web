<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { UploadProps } from 'element-plus'
import Sortable from 'sortablejs'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import GenerationHistoryDialog from './GenerationHistoryDialog.vue'
import UserPromptLibraryDialog from '@/components/Common/UserPromptLibraryDialog.vue'
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
  { value: '2048x1024', label: '2:1 宽屏' },
]

// 并发数：1-5，默认 1。N 个变体并发请求，每张独立结果/扣费/失败重试
const concurrencyOptions = [1, 2, 3, 4, 5]

// ============ localStorage 同步 ref ============
// 用法：直接像普通 ref 用（selectedSize.value / v-model="selectedSize"），
// 初始化时就从 localStorage 读取（合法值校验），任何变化都自动写回。
// 解决了「ref 默认值 → onMounted 异步赋值 → watch 才触发」的中间态：
// 进页面时 <select> 的 v-model 已经指向 cache 值，UI 立即正确显示。
function useCachedRef<T extends string | number>(
  key: string,
  defaultValue: T,
  validate?: (val: T) => boolean,
) {
  let initial: T = defaultValue
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      // 数字需要 parseInt；字符串直接用
      const parsed = (typeof defaultValue === 'number'
        ? (parseInt(raw, 10) as unknown as T)
        : (raw as unknown as T))
      if (typeof parsed === 'number' && Number.isNaN(parsed)) {
        // ignore: 解析失败走默认值
      } else if (!validate || validate(parsed)) {
        initial = parsed
      }
    }
  } catch {
    // localStorage 不可用（隐私模式），静默走默认值
  }
  const r = ref(initial)
  watch(r, (val) => {
    try { localStorage.setItem(key, String(val)) } catch { /* 静默忽略 */ }
  })
  return r
}

// 表单状态（直接从 localStorage 读初值，避免「默认值 → 异步赋值」的中间态）
const selectedSize = useCachedRef<string>(
  'ai-image-edit:size',
  sizeOptions[0].value,
  (val) => sizeOptions.some((s) => s.value === val),
)
const selectedConcurrency = useCachedRef<number>(
  'ai-image-edit:concurrency',
  1,
  (val) => concurrencyOptions.includes(val),
)
const prompt = ref('')
const promptTouched = ref(false)
// 批次级 loading：只要还有任意 slot 是 pending 就保持 true
const isBatchLoading = ref(false)

// 用户 store（右上角积分 badge 用）
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

// 历史弹窗 ref
const historyRef = ref<InstanceType<typeof GenerationHistoryDialog> | null>(null)

// 提示词库弹窗 ref（从提示词库选择）
const promptLibraryRef = ref<InstanceType<typeof UserPromptLibraryDialog> | null>(null)
// 选中提示词库里的某条后，回填到输入框（强制覆盖，保持和「点开 → 选中」的语义一致）
const onPromptSelect = (payload: { id: string; title: string; content: string }) => {
  prompt.value = payload.content
  ElMessage.success(payload.title ? `已填入「${payload.title}」` : '已填入提示词')
}

// 图片上传 — 多张图片，最多 MAX_IMAGES 张
// 保存 File 对象数组，预览用 base64 数组
const MAX_IMAGES = 16
const uploadRef = ref<any>(null)
const imageFiles = ref<File[]>([])
const imagePreviews = ref<string[]>([])
const uploadedFileNames = ref<string[]>([])
// 与上面三个数组严格对齐的唯一 id。拖拽排序后 Vue 用 :key 跟踪 DOM，
// 用下标 idx 作为 key 在 reorder 时会让 Vue 误判为「元素被替换」而闪烁，
// 改用与文件一一绑定的稳定 id 才能让 Vue 正确复用 DOM
const imageIds = ref<string[]>([])
// 与 imagePreviews 等长的宽高比字符串，如 '9/16' / '1/1' / '16/9'。
// 让 grid cell 根据图实际比例伸缩，9:16 长图不会被裁掉。解析异步、不阻塞预览显示。
const imageAspectStyles = ref<string[]>([])
// 缩略图网格 ref：用于挂载 Sortable
const imageGridRef = ref<HTMLElement | null>(null)

const canAddMore = computed(() => imageFiles.value.length < MAX_IMAGES)
const remainingSlots = computed(() => MAX_IMAGES - imageFiles.value.length)

// 从 dataURL 解析图片宽高比，异步填充 imageAspectStyles[idx]。
// 失败（如浏览器拒绝读图）时保持 undefined，cell 走默认正方形兜底。
const probeAspect = (dataUrl: string, idx: number) => {
  const img = new Image()
  img.onload = () => {
    if (!img.width || !img.height) return
    imageAspectStyles.value[idx] = `${img.width} / ${img.height}`
  }
  img.src = dataUrl
}

// el-upload onChange：每次新增/移除文件都会触发，仅处理新增。
// auto-upload=false 时 status='ready' 即代表「刚被加入内部列表」。
const handleChange: UploadProps['onChange'] = (uploadFile) => {
  if (uploadFile.status === 'ready' && uploadFile.raw) {
    addImageFiles([uploadFile.raw])
  }
  // 立刻清空 el-upload 内部列表，避免内部累积导致下次选择时 onExceed 误判
  uploadRef.value?.clearFiles()
}

// onExceed：超过 MAX_IMAGES 触发。直接提示，由用户自己处理。
const handleExceed: UploadProps['onExceed'] = () => {
  ElMessage.warning(`最多上传 ${MAX_IMAGES} 张图片`)
}

// 关闭 auto-upload 之后 http-request 不会再被调到，留个空实现兜底
const handleUpload = (_options: any): Promise<void> => {
  return Promise.resolve()
}

// 追加图片：超过上限的部分静默丢弃并提示
const addImageFiles = (files: File[]) => {
  let added = 0
  for (const file of files) {
    if (!canAddMore.value) {
      ElMessage.warning(`已达上限 ${MAX_IMAGES} 张`)
      break
    }
    if (!file.type.startsWith('image/')) {
      ElMessage.error(`已跳过非图片文件：${file.name || '未知'}`)
      continue
    }
    imageFiles.value.push(file)
    uploadedFileNames.value.push(file.name || 'image.png')
    imageIds.value.push(crypto.randomUUID())
    const reader = new FileReader()
    reader.onload = (e) => {
      // 同步追加到预览数组，保持索引一致
      const url = e.target?.result as string
      imagePreviews.value.push(url)
      // 异步探测宽高比，9:16 等长图上传时 grid cell 能随之拉高，缩略图不会被裁
      probeAspect(url, imagePreviews.value.length - 1)
    }
    reader.readAsDataURL(file)
    added++
  }
  if (added > 0) {
    ElMessage.success(added === 1 ? '图片已就绪' : `已添加 ${added} 张图片（共 ${imageFiles.value.length}/${MAX_IMAGES}）`)
    // 缩略图数量变化后重新挂 Sortable（addImageFiles 也用于拖拽回填，DOM 在那里被替换）
    nextTick(() => initImageSortable())
  }
}

// 移除指定索引的图片
const removeImage = (idx: number) => {
  if (isBatchLoading.value) return
  imageFiles.value.splice(idx, 1)
  imagePreviews.value.splice(idx, 1)
  uploadedFileNames.value.splice(idx, 1)
  imageIds.value.splice(idx, 1)
  imageAspectStyles.value.splice(idx, 1)
}

// 清空全部图片
const clearAllImages = () => {
  if (isBatchLoading.value) return
  imageFiles.value = []
  imagePreviews.value = []
  uploadedFileNames.value = []
  imageIds.value = []
  imageAspectStyles.value = []
  uploadRef.value?.clearFiles()
  nextTick(() => destroyImageSortable())
}

// 粘贴图片支持：追加到列表（已有图时继续往后加）
const handlePaste = (e: ClipboardEvent) => {
  if (isBatchLoading.value) return
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (blob) {
        const file = new File([blob], `clipboard-${Date.now()}.png`, { type: blob.type })
        addImageFiles([file])
      }
      return
    }
  }
}

// ============ 拖拽支持：生成结果可直接拖回上传区 ============
// 自定义 MIME，dataTransfer 用它区分「来自本页结果」与「外部文件」。
// 同时写 text/uri-list 与 text/plain，让拖到浏览器其他位置（标签页、外部编辑器）也能用。
const RESULT_DRAG_MIME = 'application/x-ai-image-edit-result'
const isDragOver = ref(false)
// dragenter/dragleave 在子元素上会反复触发，用计数器在真正离开 dropzone 时才关闭高亮
let dragCounter = 0
// 拖拽结果回填中：后端代理拿 blob 通常几百毫秒～几秒，期间在上传区显示 loading 遮罩
const isRefillingImage = ref(false)
// 自驱动 spinner：用 requestAnimationFrame 直接改 transform 角度，
// 绕开 CSS animation / prefers-reduced-motion / 第三方 CSS 注入缺失等问题。
const spinnerRef = ref<HTMLDivElement | null>(null)
let spinnerRafId = 0
let spinnerAngle = 0
const startSpinner = () => {
  if (!spinnerRef.value || spinnerRafId) return
  const tick = () => {
    spinnerAngle = (spinnerAngle + 6) % 360
    if (spinnerRef.value) spinnerRef.value.style.transform = `rotate(${spinnerAngle}deg)`
    spinnerRafId = requestAnimationFrame(tick)
  }
  tick()
}
const stopSpinner = () => {
  if (spinnerRafId) { cancelAnimationFrame(spinnerRafId); spinnerRafId = 0 }
}
// isRefillingImage 切换时同步启停 spinner；用 nextTick 等到 div 渲染完再取 ref
watch(isRefillingImage, async (val) => {
  if (val) {
    await nextTick()
    startSpinner()
  } else {
    stopSpinner()
  }
})

const onDragEnter = (e: DragEvent) => {
  e.preventDefault()
  if (isBatchLoading.value) return
  dragCounter++
  const types = e.dataTransfer?.types
  if (!types) return
  if (types.includes('Files') || types.includes(RESULT_DRAG_MIME)) {
    isDragOver.value = true
  }
}

const onDragOver = (e: DragEvent) => {
  // 必须 preventDefault，否则浏览器不会触发后续的 drop
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

const onDragLeave = (e: DragEvent) => {
  e.preventDefault()
  dragCounter = Math.max(0, dragCounter - 1)
  if (dragCounter === 0) isDragOver.value = false
}

// 必须在「捕获阶段」监听：el-upload-dragger 内部 onDrop 会显式调用
// e.stopPropagation()，导致冒泡阶段的外层 @drop 永远收不到事件。
// capture 模式让我们在子元素处理前先拿到事件，自己决定是否拦截。
const onUploadDrop = async (e: DragEvent) => {
  // 生成中：所有上传通道（拖入、生成结果回填、点击 picker）都已禁用
  if (isBatchLoading.value) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter = 0
    isDragOver.value = false
    return
  }
  // 路径 A：来自本页生成结果（URL → fetch → Blob → File）。
  // dataTransfer 里只有自定义 MIME / text-uri-list，没有真实文件，
  // el-upload 处理会空转，这里要 stopPropagation 抢在自己手里处理。
  // 自定义 MIME 现在是 JSON：{ url, recordId }，每张结果图带自己的 recordId，
  // 拖回上传区时走对应 recordId 的后端代理拿 blob，绕过第三方图床 CORS。
  let resultUrl = ''
  let resultRecordId = ''
  const dragPayload = e.dataTransfer?.getData(RESULT_DRAG_MIME)
  if (dragPayload) {
    try {
      const parsed = JSON.parse(dragPayload)
      if (parsed && typeof parsed === 'object') {
        resultUrl = parsed.url || ''
        resultRecordId = parsed.recordId || ''
      } else if (typeof parsed === 'string') {
        // 兼容旧版纯 URL 字符串
        resultUrl = parsed
      }
    } catch {
      // 非 JSON 时按纯 URL 处理
      resultUrl = dragPayload
    }
  }
  if (!resultUrl) {
    resultUrl = e.dataTransfer?.getData('text/uri-list')?.split('\n')[0] || ''
  }
  if (resultUrl) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter = 0
    isDragOver.value = false
    isRefillingImage.value = true
    try {
      // 第三方图床通常不带 CORS 头，前端 fetch 会失败。
      // 有 recordId 时复用「下载图片」同款后端代理拿 blob，绕过 CORS。
      let blob: Blob
      let filename = 'generated-result.png'
      if (resultRecordId) {
        const res = await fetchMyGenerationRecordImage(resultRecordId)
        blob = res.blob
        if (res.filename) filename = res.filename
      } else {
        // 兜底：极少数情况下没有 recordId（比如上游异常未返回）。
        // 这里有可能被 CORS 拦截，错误由 catch 统一提示。
        const resp = await fetch(resultUrl)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        blob = await resp.blob()
      }
      const file = new File([blob], filename, {
        type: blob.type || 'image/png',
      })
      // 把生成结果作为新图片追加（多图场景下插到末尾，不替换已有图）
      addImageFiles([file])
    } catch (err) {
      ElMessage.error('读取生成结果失败：' + (err as Error)?.message)
    } finally {
      isRefillingImage.value = false
    }
    return
  }

  // 路径 B：从操作系统拖入的真实文件 → 自己处理（el-upload-dragger 默认只取第一个 file，多图 drop 需要拦截）
  // 注意：addImageFiles 会自动跳过非图片文件 + 超出 MAX_IMAGES 的部分
  const droppedFiles = Array.from(e.dataTransfer?.files || [])
  if (droppedFiles.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    addImageFiles(droppedFiles)
  }
  dragCounter = 0
  isDragOver.value = false
}

const onSlotDragStart = (e: DragEvent, slot: ResultSlot) => {
  if (!e.dataTransfer || !slot.url) return
  // 自定义 MIME 用 JSON 携带 {url, recordId}：
  //   - url 给拖回上传区用（fetch blob / 当参考图）
  //   - recordId 给上传区代理走（绕过第三方图床 CORS）
  // text/uri-list 和 text/plain 只放 URL，方便拖到浏览器其他位置/外部编辑器
  const payload = JSON.stringify({ url: slot.url, recordId: slot.recordId })
  e.dataTransfer.setData(RESULT_DRAG_MIME, payload)
  e.dataTransfer.setData('text/uri-list', slot.url)
  e.dataTransfer.setData('text/plain', slot.url)
  e.dataTransfer.effectAllowed = 'copy'
}

// ============ 缩略图拖拽排序（HTML5 原生 / Sortable.js）============
// Sortable 实例：单个网格，挂在 imageGridRef 上
let imageSortable: Sortable | null = null

const destroyImageSortable = () => {
  if (imageSortable) {
    imageSortable.destroy()
    imageSortable = null
  }
}

// 初始化 / 重建 Sortable
// - 必须在 thumb DOM 渲染出来后挂载，所以统一用 nextTick 包一层
// - 「外部文件拖入」由父级 upload-dropzone 的 @drop.capture 处理，
//   Sortable 仅负责在容器内重排 DOM，不会拦截文件类型 dataTransfer
const initImageSortable = () => {
  destroyImageSortable()
  const el = imageGridRef.value
  if (!el) return
  if (imageIds.value.length < 2) return  // 只有 0/1 张时挂上也没意义
  imageSortable = Sortable.create(el, {
    animation: 150,
    ghostClass: 'upload-thumb-ghost',
    chosenClass: 'upload-thumb-chosen',
    dragClass: 'upload-thumb-dragging',
    // 延迟 80ms 才进入拖拽，避免和「点击放大」冲突（区分不动 vs 移动）
    delay: 80,
    delayOnTouchOnly: true,
    // 触摸起手在延迟期内移动超过 10px 即取消拖拽并放行滚动，
    // 否则从缩略图上起手滑动页面时前 80ms 会被 preventDefault 卡住
    touchStartThreshold: 10,
    disabled: isBatchLoading.value,
    onEnd: handleImageSortEnd,
  })
}

// 拖拽结束：同步重排 4 个并行数组（id / file / preview / name）
// 排序后图片发送给 AI 的顺序与新顺序一致（FormData 按数组顺序写入）
const handleImageSortEnd = (evt: Sortable.SortableEvent) => {
  const { oldIndex, newIndex } = evt
  if (
    oldIndex == null ||
    newIndex == null ||
    oldIndex === newIndex
  ) return

  const id = imageIds.value.splice(oldIndex, 1)[0]
  const file = imageFiles.value.splice(oldIndex, 1)[0]
  const preview = imagePreviews.value.splice(oldIndex, 1)[0]
  const name = uploadedFileNames.value.splice(oldIndex, 1)[0]
  const aspect = imageAspectStyles.value.splice(oldIndex, 1)[0]
  imageIds.value.splice(newIndex, 0, id)
  imageFiles.value.splice(newIndex, 0, file)
  imagePreviews.value.splice(newIndex, 0, preview)
  uploadedFileNames.value.splice(newIndex, 0, name)
  imageAspectStyles.value.splice(newIndex, 0, aspect)
}

// isBatchLoading 变化时切换 Sortable 的 disabled 状态
watch(isBatchLoading, (val) => {
  if (imageSortable) {
    imageSortable.option('disabled', val)
  }
})

// 提示词缓存 key：刷新页面后自动恢复上次输入
const PROMPT_CACHE_KEY = 'ai-image-edit:prompt'
// 尺寸 / 并发数 缓存 key 由 useCachedRef 内部固定（'ai-image-edit:size' / 'ai-image-edit:concurrency'），
// 这里不重复声明常量避免与 useCachedRef 实现耦合。

// 响应式：< 640px 视为手机端 → 「我的历史」改走独立页面 /ai-image-edit/history
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

const openHistory = () => {
  if (isMobile.value) {
    // 新标签页打开：留在当前页，正在生成的任务不会因路由跳转被中断
    window.open(router.resolve('/ai-image-edit/history').href, '_blank', 'noopener,noreferrer')
  } else {
    historyRef.value?.open()
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  document.addEventListener('paste', handlePaste)
  // 全局 ESC 兜底关闭预览（el-image / el-image-viewer 默认就支持，
  // 但移动端触屏或某些嵌套场景下不一定触发，这里强制接管）
  window.addEventListener('keydown', onGlobalKeydown)
  // 全局点击外部兜底关闭预览：移动端/嵌套 el-upload-dragger 时 EP 自带遮罩关闭
  // 偶尔不响应，这里用 mousedown 抢先一步（click 会晚一拍，避免和触发预览的 click 抢同一拍）
  window.addEventListener('mousedown', onGlobalClickOutside, true)
  // 监听 body 子树变化：viewer 通过 teleport 渲染到 body，需要观察其挂载时机
  viewerWrapperObserver.observe(document.body, { childList: true, subtree: true })
  // 首次扫描（可能在 mount 时 viewer 已渲染）
  attachViewerCloseHandlers()
  fetchModelList()
  // URL 带 prompt 参数时优先用它（从 AI 提示词工具跳转过来）
  const urlPrompt = route.query.prompt
  if (typeof urlPrompt === 'string' && urlPrompt.trim()) {
    prompt.value = decodeURIComponent(urlPrompt)
    return
  }
  // 恢复上次提交的提示词
  try {
    const cached = localStorage.getItem(PROMPT_CACHE_KEY)
    if (cached) prompt.value = cached
  } catch {
    // localStorage 不可用（隐私模式等），静默忽略
  }
  // selectedSize / selectedConcurrency 由上面的 useCachedRef 在初始化时已读 cache，
  // 此处不再重复读取（避免「默认值 → 异步赋值」的中间态闪烁）
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

// 全局 ESC 键关闭全屏预览
const onGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && previewOpen.value) {
    closePreview()
  }
}

// ============ 强制接管 viewer 关闭 ============
// 痛点：EP 默认的 hide-on-click-modal 在触屏 + 移动浏览器 + 部分事件穿透场景下不响应。
// 解决：viewer wrapper 一旦挂载（teleported 到 body），立刻在它上面挂 capture 阶段的
// mousedown 监听，点 wrapper 本身 / mask / 图片都能直接关闭；只有底部操作栏不关。
// 用 MutationObserver 自动跟随 wrapper 的挂载与卸载（v-if 控制的 viewer 反复进出）。
const viewerWrapperObserver = new MutationObserver(() => {
  attachViewerCloseHandlers()
})
// 哪些区域是「点击不关闭」（viewer 内部的工具栏 / 关闭按钮本身 / 切换按钮）
const VIEWER_KEEP_OPEN_SELECTOR = [
  '.el-image-viewer__actions',     // 底部操作栏（缩放/旋转/重置/左/右）
  '.el-image-viewer__close',     // 关闭按钮（按它自己会触发 EP close，不重复处理）
  '.el-image-viewer__arrow',     // 左右切换按钮
  '.el-image-viewer__prev',
  '.el-image-viewer__next',
].join(',')

// 当前已绑定的 wrapper 元素，用于解绑时去重
let attachedViewerWrapper: HTMLElement | null = null
const viewerMousedownHandler = (e: MouseEvent) => {
  const target = e.target as HTMLElement | null
  if (!target) return
  // 点在操作栏内 → 不关
  if (target.closest(VIEWER_KEEP_OPEN_SELECTOR)) return
  // 其余全部视为关闭信号（遮罩、图片本体、wrapper 空白区）
  e.stopPropagation()
  e.preventDefault()
  closePreview()
}

const attachViewerCloseHandlers = () => {
  // viewer 通过 teleport 渲染到 body 下，与组件 DOM 树解耦
  const wrapper = document.querySelector<HTMLElement>('.el-image-viewer__wrapper')
  if (!wrapper) return
  if (wrapper === attachedViewerWrapper) return
  // 先解绑旧 wrapper（如果存在）
  if (attachedViewerWrapper) {
    attachedViewerWrapper.removeEventListener('mousedown', viewerMousedownHandler, true)
  }
  // 在 capture 阶段抢先触发，确保比 EP 自带 handler 更早执行
  wrapper.addEventListener('mousedown', viewerMousedownHandler, true)
  attachedViewerWrapper = wrapper
}

const detachViewerCloseHandlers = () => {
  if (attachedViewerWrapper) {
    attachedViewerWrapper.removeEventListener('mousedown', viewerMousedownHandler, true)
    attachedViewerWrapper = null
  }
}

// 旧的兜底（保留给非 viewer 的边缘情况，但实际场景下 viewer 已经全覆盖）
const onGlobalClickOutside = (e: MouseEvent) => {
  if (!previewOpen.value) return
  const target = e.target as HTMLElement | null
  if (!target) return
  // 黑名单：viewer 自身 / 缩略图 / el-image wrapper（已被 viewer 内部监听器接管）
  if (target.closest('.el-image-viewer__wrapper')) return
  if (target.closest('.upload-thumb')) return
  if (target.closest('.el-image')) return
  closePreview()
}

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
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('mousedown', onGlobalClickOutside, true)
  viewerWrapperObserver.disconnect()
  detachViewerCloseHandlers()
  stopAllSlotVisuals()
  stopBtnAnim()
  stopSpinner()
  destroyImageSortable()
  // 兜底：预览开着时直接离开页面（路由切换），viewer 随组件卸载不会恢复 body 滚动锁
  restoreBodyScrollLock()
})

// ============ 生成结果：N 路并发，每张一个 Slot ============
type SlotStatus = 'pending' | 'success' | 'failed'

interface ResultSlot {
  /** 稳定 ID，用于 v-for key / 拖拽 payload 关联 recordId */
  id: string
  status: SlotStatus
  url: string
  recordId: string
  errorMsg: string
  elapsedSeconds: number
}

// 用 reactive 让 slot 内部属性（status/elapsedSeconds 等）变更触发更新
const results = reactive<ResultSlot[]>([])
// 计时器存 Map，避免 Vue 把 setInterval id 视为响应式字段
const slotTimers = new Map<string, ReturnType<typeof setInterval>>()

// ============ Per-slot canvas 粒子动画 ============
// 每张 pending slot 跑一个独立 canvas，粒子数 25（N=5 时共 125 个可接受）
interface Particle {
  x: number; y: number; vx: number; vy: number; r: number; hue: number; alpha: number
}
const slotCanvasAnims = new Map<string, number>()
const slotCanvasResizers = new Map<string, (() => void) | null>()

const startSlotCanvas = (slotId: string, canvas: HTMLCanvasElement) => {
  // 已被新一次生成替换过 / 已停止过 → 跳过
  if (slotCanvasAnims.has(slotId)) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
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
  slotCanvasResizers.set(slotId, resize)
  window.addEventListener('resize', resize)

  const W = () => canvas.width / dpr
  const H = () => canvas.height / dpr
  const particles: Particle[] = []
  const count = 25
  const hues = [260, 280, 320, 220, 180] // purple, violet, pink, blue, teal
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * W(),
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2 + 1,
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
    // Connections + center attract
    const cx = w / 2; const cy = h / 2
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 80) {
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          const alpha = (1 - dist / 80) * 0.18
          ctx.strokeStyle = `hsla(${particles[i].hue}, 60%, 65%, ${alpha})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
      const adx = cx - particles[i].x
      const ady = cy - particles[i].y
      const adist = Math.sqrt(adx * adx + ady * ady) || 1
      if (adist < 60) {
        particles[i].vx += adx / adist * 0.02
        particles[i].vy += ady / adist * 0.02
      }
    }
    // Center glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 + Math.sin(frame * 0.03) * 8)
    glow.addColorStop(0, 'rgba(168,85,247,0.15)')
    glow.addColorStop(0.5, 'rgba(99,102,241,0.06)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    frame++
    slotCanvasAnims.set(slotId, requestAnimationFrame(draw))
  }
  draw()
}

const stopSlotCanvas = (slotId: string) => {
  const id = slotCanvasAnims.get(slotId)
  if (id) { cancelAnimationFrame(id); slotCanvasAnims.delete(slotId) }
  const resize = slotCanvasResizers.get(slotId)
  if (resize) {
    window.removeEventListener('resize', resize)
    slotCanvasResizers.delete(slotId)
  }
}

const stopAllSlotCanvases = () => {
  for (const id of slotCanvasAnims.values()) cancelAnimationFrame(id)
  slotCanvasAnims.clear()
  for (const r of slotCanvasResizers.values()) {
    if (r) window.removeEventListener('resize', r)
  }
  slotCanvasResizers.clear()
}

// 重置结果数组为 N 个 pending slot（清空旧的 + 启动新计时器）
const resetResults = (n: number) => {
  stopAllSlotVisuals()
  results.splice(0, results.length, ...Array.from({ length: n }, createPendingSlot))
  for (const slot of results) startSlotTimer(slot)
}

// 全屏预览（统一接管：历史缩略图 + 上传区点击缩略图 + 生成结果图）
// 用 urlList + activeIndex 取代原来的 previewUrl，单图预览也包成单元素数组
const previewList = ref<string[]>([])
const previewIndex = ref(0)
const previewOpen = ref(false)

const openPreview = (url: string, list?: string[], index?: number) => {
  if (list && list.length > 0) {
    previewList.value = list
    previewIndex.value = typeof index === 'number' && index >= 0 && index < list.length
      ? index
      : list.indexOf(url)
    if (previewIndex.value < 0) previewIndex.value = 0
  } else {
    previewList.value = [url]
    previewIndex.value = 0
  }
  previewOpen.value = true
}
const closePreview = () => {
  previewOpen.value = false
  // EP 的 image-viewer 只在自己的 hide() 里恢复 body 滚动锁（overflow: hidden），
  // 而移动端「点图片/遮罩关闭」走的是 capture mousedown 兜底 → v-if 直接卸载，
  // hide() 不会执行 → 锁泄漏后整页无法滑动。这里统一兜底恢复。
  nextTick(restoreBodyScrollLock)
}

// 恢复 body 滚动锁。viewer 或其他 EP 弹层（dialog/drawer 的 .el-overlay）仍在展示时
// 不动——锁归它们管，由各自的生命周期负责恢复
const restoreBodyScrollLock = () => {
  if (document.body.style.overflow !== 'hidden') return
  if (document.querySelector('.el-image-viewer__wrapper')) return
  const overlays = document.querySelectorAll<HTMLElement>('.el-overlay')
  for (const el of overlays) {
    if (el.style.display !== 'none') return
  }
  document.body.style.overflow = ''
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

// 批次级 isBatchLoading 切换时驱动按钮动画；每格的 loading 由 slot-pending 自己的 spinner 渲染
watch(isBatchLoading, (val) => {
  if (val) {
    setTimeout(() => startBtnAnim(), 50)
  } else {
    stopBtnAnim()
  }
})

// ============ Slot 计时器管理 ============
// 每张图独立计时 + 独立 canvas 动画。
// canvas 启动完全绕开 Vue 函数 ref（在 nextTick 里 querySelector 拿 DOM），
// 避免 Vue re-render（elapsedSeconds 每秒+1 触发）把动画杀掉。
const startSlotTimer = (slot: ResultSlot) => {
  stopSlotTimer(slot)
  slotTimers.set(
    slot.id,
    setInterval(() => {
      slot.elapsedSeconds++
    }, 1000),
  )
  // 启动 canvas 粒子动画（等 Vue 把 DOM 渲染完）
  startSlotCanvasByDataAttr(slot.id)
}

const stopSlotTimer = (slot: ResultSlot) => {
  const t = slotTimers.get(slot.id)
  if (t) {
    clearInterval(t)
    slotTimers.delete(slot.id)
  }
  // 计时停了就顺手停 canvas（fireOneRequest 走这条路径级联生效）
  stopSlotCanvas(slot.id)
}

const stopAllSlotTimers = () => {
  for (const t of slotTimers.values()) clearInterval(t)
  slotTimers.clear()
}

// 同时停掉每格的 canvas 动画（批量结束 / 组件卸载时调用）
const stopAllSlotVisuals = () => {
  stopAllSlotTimers()
  stopAllSlotCanvases()
}

// 完全绕开 Vue 函数 ref 机制：通过 data-slot-canvas 属性找 canvas DOM，
// 在 nextTick 后启动。Vue re-render 不会再调用 ref 函数把动画杀掉。
const startSlotCanvasByDataAttr = (slotId: string) => {
  nextTick(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      `canvas[data-slot-canvas="${slotId}"]`,
    )
    if (canvas) startSlotCanvas(slotId, canvas)
  })
}

const formatElapsed = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
}

// 生成阶段文案（与旧 canvas 版本一致：分析构思 → 精细渲染 → 即将完成）
const phaseText = (s: number) => {
  if (s < 10) return '分析构思中'
  if (s < 25) return '精细渲染中'
  return '即将完成'
}

// 余额不足提示词（输入即时反馈）
const concurrencyHint = computed(() => {
  const cost = currentModelCost.value
  if (cost === 0) return ''
  const total = cost * selectedConcurrency.value
  if (userStore.credits.balance < total) {
    return `积分余额不足：本次需 ${total} 积分（${cost} × ${selectedConcurrency.value}），当前 ${userStore.credits.balance}`
  }
  return ''
})

// 是否可以生成：批次不在加载、模型就绪、提示词必填、余额足够 N×cost
const canGenerate = computed(() => {
  if (isBatchLoading.value) return false
  if (!modelLoaded.value || modelList.value.length === 0 || !selectedModel.value) return false
  if (prompt.value.trim().length === 0) return false
  const cost = currentModelCost.value
  if (cost > 0 && userStore.credits.balance < cost * selectedConcurrency.value) return false
  return true
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

// ============ 本次生成总耗时（用于「生成结果」标题后展示）============
// resetResults 时记录 startTime，所有 slot 全部 success/failed 时记录 endTime；
// 区间内如果还有重试（retrySlot），endTime 会被刷新。
const batchStartAt = ref<number | null>(null)
const batchEndAt = ref<number | null>(null)

const totalElapsedMs = computed(() => {
  if (batchStartAt.value == null) return 0
  const end = batchEndAt.value ?? Date.now()
  return Math.max(0, end - batchStartAt.value)
})

// 把秒级毫秒数格式化为「N秒」或「N分M秒」
const formatBatchDuration = (ms: number): string => {
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}秒`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return s === 0 ? `${m}分` : `${m}分${s}秒`
}

// 全部 slot 收尾（success 或 failed）时调用，把 batchEndAt 设为当前时间
// 仍在 pending 中则不更新（生成还没结束，计时器继续走）。
const finalizeBatchIfDone = () => {
  if (batchStartAt.value == null) return
  const allDone = results.every((s) => s.status !== 'pending')
  if (allDone) batchEndAt.value = Date.now()
}

// ============ 结果区网格列数：1 全宽，2 两列，3+ 三列（手机端一律单列） ============
const resultGridClass = computed(() => {
  const n = results.length
  if (n <= 1) return 'grid-cols-1'
  if (n === 2) return 'grid-cols-1 md:grid-cols-2'
  return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
})

// 创建初始 pending slot
const createPendingSlot = (): ResultSlot => ({
  id: crypto.randomUUID(),
  status: 'pending',
  url: '',
  recordId: '',
  errorMsg: '',
  elapsedSeconds: 0,
})

// 构建一次请求的 FormData（每次新建避免共享问题）
const buildFormData = () => {
  const fd = new FormData()
  fd.append('model', selectedModel.value)
  fd.append('size', selectedSize.value)
  if (prompt.value.trim()) {
    fd.append('prompt', prompt.value.trim())
  }
  // 多图：每张都用同一个字段名 'images'，后端用 formData.getAll('images') 读取
  for (const file of imageFiles.value) {
    fd.append('images', file)
  }
  return fd
}

// 单个 slot 的请求：成功/失败都直接改 slot 状态 + 停计时器，返回 balanceAfter 供调用方做最终余额对齐
const fireOneRequest = async (
  slot: ResultSlot,
  fd: FormData,
  idempotencyKey: string,
): Promise<{ ok: boolean; balanceAfter?: number }> => {
  try {
    const res = await functionsRequest.post('/api/ai-image-edit', fd, {
      // AI 生图偶尔跑到 3-5 分钟，覆盖默认 30s 超时到 11 分钟（后端 10 分钟 + 1 分钟缓冲）
      timeout: 660000,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    const data = res.data
    if (!data.ok) {
      slot.status = 'failed'
      slot.errorMsg = data.error || '生成失败'
      stopSlotTimer(slot)
      // 用服务端返回的 balance 覆盖显示（这是数据库真实值）
      const bal = typeof data.balance === 'number' ? data.balance : undefined
      return { ok: false, balanceAfter: bal }
    }
    slot.status = 'success'
    slot.url = data.data?.url || ''
    slot.recordId = data.data?.recordId || ''
    stopSlotTimer(slot)
    return {
      ok: true,
      balanceAfter: typeof data.data?.balanceAfter === 'number' ? data.data.balanceAfter : undefined,
    }
  } catch (error: any) {
    console.error('生成图片失败:', error)
    slot.status = 'failed'
    slot.errorMsg =
      error?.response?.data?.error || error?.message || '网络请求失败，请稍后重试'
    stopSlotTimer(slot)
    const errBalance = error?.response?.data?.balance
    return { ok: false, balanceAfter: typeof errBalance === 'number' ? errBalance : undefined }
  }
}

// 调用后端 API：N 路并发，每路独立扣费/独立计时/独立成功失败
const generateImage = async () => {
  if (!canGenerate.value) {
    promptTouched.value = true
    if (!modelLoaded.value) {
      ElMessage.warning('模型列表加载中，请稍候')
    } else if (modelList.value.length === 0 || !selectedModel.value) {
      ElMessage.error('暂无可用模型，请联系管理员配置')
    } else if (concurrencyHint.value) {
      ElMessage.error(concurrencyHint.value)
    } else {
      ElMessage.warning('请先输入提示词')
    }
    return
  }

  const n = selectedConcurrency.value
  const costPerRequest = currentModelCost.value
  const totalCost = costPerRequest * n
  const balanceBefore = userStore.credits.balance

  // 重置结果区为 N 个 pending slot（旧的 slot 计时器会被 stopAllSlotTimers 清掉）
  resetResults(n)
  isBatchLoading.value = true
  // 记录批次起止时间：startTime 在这里锁定，endTime 等最后一个 slot 收尾时由 finalizeBatchIfDone 写入
  batchStartAt.value = Date.now()
  batchEndAt.value = null

  // 乐观扣费：服务端在调上游前就已经扣费，前端立即把余额减掉，
  // 这样在 30~90s 的生成期间徽章和弹窗能保持与服务端一致。
  // 失败路径（部分或全部）会在 Promise.allSettled 完成后用服务端权威值对齐。
  if (totalCost > 0) {
    userStore.setBalance(balanceBefore - totalCost)
  }

  // N 路独立请求：每路一个 FormData、一个 Idempotency-Key、一个 Promise
  const tasks = results.map((slot) => {
    const idempotencyKey = crypto.randomUUID()
    const fd = buildFormData()
    return fireOneRequest(slot, fd, idempotencyKey)
  })

  const outcomes = await Promise.allSettled(tasks)

  // 统计成功/失败，并从任一成功响应里取服务端权威 balanceAfter
  // （成功响应的 balanceAfter 已扣完且失败的 reverse 已生效，是批次最终值）
  let serverBalance: number | null = null
  let successCount = 0
  let failedCount = 0
  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i]
    if (o.status === 'fulfilled' && o.value.ok) {
      successCount++
      if (typeof o.value.balanceAfter === 'number' && serverBalance === null) {
        serverBalance = o.value.balanceAfter
      }
    } else {
      failedCount++
      // 失败响应也可能带，服务端 reverse 后 balance 已回退
      if (o.status === 'fulfilled' && typeof o.value.balanceAfter === 'number' && serverBalance === null) {
        serverBalance = o.value.balanceAfter
      }
    }
  }

  // 应用余额：成功路径下 serverBalance 已包含失败 reverse 的最终值；
  // 全部失败时回退到 balanceBefore（服务端全部 reverse）
  if (serverBalance !== null) {
    userStore.setBalance(serverBalance)
  } else {
    userStore.setBalance(balanceBefore)
  }
  // 最终兜底：再拉一次服务端真值，防止中间环节对不齐
  userStore.fetchCredits(true)

  // 结果提示：全成功 / 全失败 / 部分成功分别给不同反馈
  if (failedCount === 0 && successCount === n) {
    ElMessage.success(n === 1 ? '图片生成成功' : `图片生成成功（${n}/${n}）`)
  } else if (successCount === 0) {
    ElMessage.error(`图片生成失败（0/${n}），可点击每张图上的「重试」`)
  } else {
    ElMessage.warning(
      `部分成功：${successCount}/${n} 已生成，${failedCount} 张失败已退还积分，点击失败格子上的「重试」可单独再试`,
    )
  }

  // 全部并发请求已 settle（成功或失败），写结束时间
  finalizeBatchIfDone()

  isBatchLoading.value = false
}

// 失败 slot 单格重试：独立幂等 key / 独立扣费 / 独立计时；批次级 isBatchLoading 仅在重试期间打开
const retrySlot = async (slot: ResultSlot) => {
  if (isBatchLoading.value) return
  const costPerRequest = currentModelCost.value
  const balanceBefore = userStore.credits.balance

  // 余额预检：单次重试只需 costPerRequest
  if (costPerRequest > 0 && balanceBefore < costPerRequest) {
    ElMessage.error(
      `积分余额不足：本次需 ${costPerRequest} 积分，当前 ${balanceBefore}`,
    )
    return
  }

  // 把 slot 重置为 pending + 启动独立计时
  slot.status = 'pending'
  slot.url = ''
  slot.recordId = ''
  slot.errorMsg = ''
  slot.elapsedSeconds = 0
  startSlotTimer(slot)
  isBatchLoading.value = true

  // 乐观扣费
  if (costPerRequest > 0) {
    userStore.setBalance(balanceBefore - costPerRequest)
  }

  const idempotencyKey = crypto.randomUUID()
  const fd = buildFormData()
  const result = await fireOneRequest(slot, fd, idempotencyKey)

  if (result.ok) {
    if (typeof result.balanceAfter === 'number') {
      userStore.setBalance(result.balanceAfter)
    } else {
      userStore.fetchCredits(true)
    }
    ElMessage.success('重试成功')
  } else {
    // 失败：服务端 reverse 已完成，前端乐观扣费回退
    userStore.setBalance(balanceBefore)
    userStore.fetchCredits(true)
    // slot 已经被 fireOneRequest 标为 failed + 写入 errorMsg
  }
  // 重试结束 → 重新判断是否所有 slot 收尾，更新 endTime
  finalizeBatchIfDone()
  isBatchLoading.value = false
}

// 下载单张 slot 图片：优先走后端代理（绕过第三方图床 CORS）
const downloadSlot = async (slot: ResultSlot) => {
  if (!slot.url) return
  if (slot.recordId) {
    try {
      const { blob, filename } = await fetchMyGenerationRecordImage(slot.recordId)
      const url = URL.createObjectURL(blob)
      autoDown(url, filename)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      window.open(slot.url, '_blank', 'noopener,noreferrer')
    }
    return
  }
  // 无 recordId（极少见）：直接 fetch 试一下，跨域失败再降级
  fetch(slot.url)
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      autoDown(url, `ai-image-${Date.now()}.png`)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
    .catch(() => {
      window.open(slot.url, '_blank', 'noopener,noreferrer')
    })
}

// 在新标签页查看单张 slot
const openSlotInNewTab = (slot: ResultSlot) => {
  if (slot.url) {
    window.open(slot.url, '_blank')
  }
}

// 把生成结果发送到上传区作为新的参考图
// 复用 onUploadDrop 中「路径 A」的逻辑：URL+recordId → 后端代理拿 blob → 构造 File → addImageFiles
// 主要用于手机端：触屏 HTML5 拖拽体验差，按钮是更直接的入口
const sendResultToUpload = async (slot: ResultSlot) => {
  if (!slot.url) return
  // 上传中 / 上传区满：避免静默失败，给用户明确反馈
  if (isBatchLoading.value) {
    ElMessage.warning('生成中，暂不能发送')
    return
  }
  if (!canAddMore.value) {
    ElMessage.warning(`已达上限 ${MAX_IMAGES} 张，请先移除部分图片`)
    return
  }
  isRefillingImage.value = true
  try {
    let blob: Blob
    let filename = 'generated-result.png'
    if (slot.recordId) {
      // 走后端代理拿 blob，绕开第三方图床 CORS
      const res = await fetchMyGenerationRecordImage(slot.recordId)
      blob = res.blob
      if (res.filename) filename = res.filename
    } else {
      // 兜底：极少数无 recordId 的历史结果
      const resp = await fetch(slot.url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      blob = await resp.blob()
    }
    const file = new File([blob], filename, {
      type: blob.type || 'image/png',
    })
    addImageFiles([file])
    // addImageFiles 内部已经会 ElMessage.success('图片已就绪')，
    // 等待 Vue 把新缩略图渲染完，再平滑滚到上传区让用户看到结果
    await nextTick()
    // 优先滚到 dropzone 容器（覆盖上传区+缩略图网格），比单纯滚到第一个缩略图更稳
    document.querySelector('.upload-dropzone')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  } catch (err) {
    ElMessage.error('读取生成结果失败：' + (err as Error)?.message)
  } finally {
    isRefillingImage.value = false
  }
}

// 跳转到「图片切割」工具，把当前生成图作为源图带上
// 路径使用 vue-router 解析，避免硬编码域名；recordId 同步带上以便 ImgCut 走后端代理绕开第三方图床 CORS
const openInImgCut = (slot: ResultSlot) => {
  if (!slot.url) return
  const params = new URLSearchParams()
  params.set('url', slot.url)
  if (slot.recordId) params.set('recordId', slot.recordId)
  const target = router.resolve({
    path: '/imgcut/',
    query: Object.fromEntries(params.entries()),
  }).href
  window.open(target, '_blank', 'noopener,noreferrer')
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
            <label class="block text-body-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
              <span>上传图片（可选）</span>
              <span v-if="imageFiles.length > 0" class="text-caption text-gray-500 tabular-nums">
                已选 {{ imageFiles.length }} / {{ MAX_IMAGES }}
              </span>
            </label>
            <div
              class="upload-dropzone"
              :class="{ 'is-dragover': isDragOver }"
              @dragenter.prevent="onDragEnter"
              @dragover.prevent="onDragOver"
              @dragleave.prevent="onDragLeave"
              @drop.capture="onUploadDrop"
            >
              <el-upload
                ref="uploadRef"
                class="w-full"
                drag
                :disabled="isBatchLoading"
                :auto-upload="false"
                :multiple="true"
                :limit="MAX_IMAGES"
                :on-change="handleChange"
                :on-exceed="handleExceed"
                :http-request="handleUpload"
                :show-file-list="false"
                accept="image/png,image/jpeg,image/webp,image/gif"
              >
                <!-- 空状态：上传提示 -->
                <div
                  v-if="imageFiles.length === 0"
                  class="flex flex-col items-center justify-center py-3"
                >
                  <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="text-body-sm text-gray-500">拖拽图片、点击上传 或 Ctrl+V 粘贴</span>
                  <span class="text-caption text-gray-400 mt-0.5">支持 PNG / JPEG / WebP / GIF · 最多 {{ MAX_IMAGES }} 张</span>
                  <span v-if="isDragOver" class="text-caption text-blue-500 mt-1">松手即可添加</span>
                </div>
                <!-- 有图状态：缩略图网格 + 末尾「继续添加」位 -->
                <div v-else class="upload-grid-wrapper">
                  <div ref="imageGridRef" class="upload-grid">
                    <div
                      v-for="(preview, idx) in imagePreviews"
                      :key="imageIds[idx]"
                      class="upload-thumb"
                      :style="imageAspectStyles[idx] ? { aspectRatio: imageAspectStyles[idx] } : undefined"
                      @click.stop
                    >
                      <el-image
                        :src="preview"
                        fit="contain"
                        class="upload-thumb-img"
                        alt="上传预览"
                        @click="openPreview(preview, imagePreviews, idx)"
                      />
                      <button
                        type="button"
                        @click.stop="removeImage(idx)"
                        class="upload-thumb-remove"
                        :disabled="isBatchLoading"
                        :title="`移除 ${uploadedFileNames[idx] || ''}`"
                        aria-label="移除图片"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span class="upload-thumb-name">{{ uploadedFileNames[idx] }}</span>
                    </div>
                    <!-- 末尾「继续添加」占位 -->
                    <div v-if="canAddMore && !isBatchLoading" class="upload-add-tile" :title="`还可添加 ${remainingSlots} 张`">
                      <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span class="text-caption text-gray-400 mt-0.5">还可添加 {{ remainingSlots }} 张</span>
                    </div>
                  </div>
                  <p class="text-caption text-gray-400 mt-2 text-center">
                    点击缩略图放大 · 点击 ✕ 移除单张 · 拖拽缩略图调整顺序 · 拖拽新图 或 Ctrl+V 粘贴继续添加
                  </p>
                </div>
              </el-upload>

              <!-- 回填中 loading：JS rAF 驱动的自转 spinner，不依赖任何 CSS 动画规则 -->
              <div v-if="isRefillingImage" class="refill-overlay" role="status" aria-live="polite">
                <div ref="spinnerRef" class="refill-spinner" aria-hidden="true"></div>
                <span class="refill-text">正在读取生成结果…</span>
              </div>
            </div>
            <button
              v-if="imageFiles.length > 0"
              @click="clearAllImages"
              :disabled="isBatchLoading"
              class="mt-2 text-body-sm text-red-500 hover:text-red-700 flex items-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-500"
            >
              <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              清空全部图片
            </button>
          </div>

          <!-- 提示词 -->
          <div>
            <label class="block text-body-sm font-medium text-gray-700 mb-2">
              提示词<span class="text-red-500">*</span>
              <span class="text-caption text-gray-400 ml-1">（必填）</span>
              <button
                type="button"
                @click="promptLibraryRef?.open()"
                title="从提示词库选择（需要登录）"
                class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 active:bg-blue-100 transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                </svg>
                从提示词库选择
              </button>
            </label>
            <div class="relative">
              <textarea
                v-model="prompt"
                placeholder="描述你想要的图片效果，例如：把图片中的天空变成日落、让人物戴上墨镜、生成一只坐在沙发上的猫..."
                maxlength="5000"
                class="w-full p-4 pr-10 pb-7 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-y"
                :class="{ 'border-red-400': promptTouched && !prompt.trim() }"
                @blur="promptTouched = true"
              ></textarea>
              <button
                v-if="prompt"
                type="button"
                @click="clearPrompt"
                title="清空提示词（会同时清空本地缓存）"
                class="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-red-500 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <!-- 字符计数：右下角 -->
              <span
                class="absolute bottom-2 right-3 text-caption pointer-events-none tabular-nums"
                :class="prompt.length >= 5000 ? 'text-red-500 font-semibold' : prompt.length >= 4000 ? 'text-amber-500' : 'text-gray-400'"
              >{{ prompt.length }} / 5000</span>
            </div>
            <span v-if="promptTouched && !prompt.trim()" class="text-caption text-red-500 mt-1 block">
              请输入提示词
            </span>
            <span v-else class="text-caption text-gray-400 mt-1 block">
              {{ imageFiles.length > 0 ? `已上传 ${imageFiles.length} 张参考图 + 描述修改效果 = 图生图；仅描述不传图 = 文生图` : '输入文字描述，AI为你生成图片' }}
            </span>
          </div>

          <!-- 模型独占一行；输出尺寸 + 并发数 并排一行 -->
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-body-sm font-medium text-gray-700 mb-2">模型</label>
              <select
                v-model="selectedModel"
                class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="m in modelList" :key="m.model_key" :value="m.model_key">
                  {{ m.model_label }}{{ m.credit_cost > 0 ? `（${m.credit_cost} 积分）` : '' }}
                </option>
              </select>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-body-sm font-medium text-gray-700 mb-2">输出尺寸</label>
<select
                v-model="selectedSize"
                class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="s in sizeOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
              </div>
              <div>
                <label class="block text-body-sm font-medium text-gray-700 mb-2">并发数</label>
<select
                v-model.number="selectedConcurrency"
                class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option v-for="n in concurrencyOptions" :key="n" :value="n">{{ n }} 张</option>
              </select>
                <span
                  class="text-caption mt-1 block"
                  :class="concurrencyHint ? 'text-red-500' : 'text-gray-400'"
                >
                  {{ concurrencyHint || `同时生成 ${selectedConcurrency} 个变体，可挑最满意的一张` }}
                </span>
              </div>
            </div>
          </div>

          <!-- 生成按钮 + 悬浮模式徽章 -->
          <div class="relative group/btn">
            <!-- 模式徽章：悬浮在按钮左上角 + 呼吸光晕 + hover 摆动 -->
            <div
              class="absolute -top-3 -left-2 z-20 pointer-events-none select-none transition-transform duration-300 group-hover/btn:scale-110"
              :class="imageFiles.length > 0 ? 'rotate-[-6deg] group-hover/btn:rotate-[-10deg]' : 'rotate-[6deg] group-hover/btn:rotate-[10deg]'"
            >
              <!-- 呼吸光晕（box-shadow 脉冲） -->
              <div
                class="absolute inset-0 rounded-full mode-badge-aura pointer-events-none"
                :class="imageFiles.length > 0
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'"
              ></div>
              <div
                class="relative px-3 py-1 rounded-full text-xs font-semibold shadow-lg ring-2 ring-white/40 backdrop-blur-sm flex items-center gap-1.5"
                :class="imageFiles.length > 0
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'"
              >
                <span class="inline-block animate-pulse">{{ imageFiles.length > 0 ? '🖼️' : '✨' }}</span>
                <span>{{ imageFiles.length > 0 ? 'AI 图片编辑' : '文生图' }}</span>
              </div>
            </div>

            <button
              ref="btnRef"
              @click="generateImage"
              :disabled="!canGenerate"
              :title="isBatchLoading ? '已有请求在进行中，请等待完成' : (!canGenerate ? '请先填写提示词并确保有可用模型' : '开始生成')"
              class="relative w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 overflow-hidden shadow-lg transition-all duration-300 ease-out group"
              :class="canGenerate && !isBatchLoading
                ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:-translate-y-0.5 hover:shadow-2xl hover:brightness-110 hover:saturate-150 active:translate-y-0 active:scale-[0.99]'
                : 'bg-gray-300 cursor-not-allowed shadow-none'"
            >
              <!-- 扫光层：hover 时扫过 -->
              <span
                v-if="canGenerate && !isBatchLoading"
                aria-hidden="true"
                class="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-white/30 blur-md opacity-0 group-hover:opacity-100"
                style="animation: btn-shine 1.1s ease-in-out infinite;"
              ></span>

              <template v-if="isBatchLoading">
                <span class="relative z-10 flex items-center gap-3">
                  <span class="flex gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                    <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse" style="animation-delay: 0.15s;" />
                    <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse" style="animation-delay: 0.3s;" />
                  </span>
                  <span class="text-body-lg tracking-wider">
                    AI 生成中 <span v-if="results.length > 1" class="text-white/80">（{{ results.length }} 张并发）</span>
                  </span>
                </span>
              </template>
              <template v-else>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span v-if="currentModelCost > 0 && selectedConcurrency > 1">
                  开始生成（{{ currentModelCost }} 积分 × {{ selectedConcurrency }}）
                </span>
                <span v-else-if="currentModelCost > 0">
                  开始生成（{{ currentModelCost }} 积分）
                </span>
                <span v-else>开始生成</span>
              </template>
            </button>
          </div>

          <!-- 生成中警示：勿关闭浏览器 -->
          <div
            v-if="isBatchLoading"
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

        <!-- 右侧：结果区 -->
        <div class="space-y-4">
          <label class="block text-body-sm font-medium text-gray-700">
            生成结果
            <span v-if="results.length > 1" class="text-caption text-gray-400 ml-1">
              （{{ results.length }} 张并发）
            </span>
            <span
              v-if="batchStartAt && batchEndAt && results.length > 0"
              class="text-caption text-gray-500 ml-2 tabular-nums"
              :title="'从点击「开始生成」到最后一个 slot 收尾的总耗时'"
            >
              耗时 {{ formatBatchDuration(totalElapsedMs) }}
            </span>
          </label>

          <!-- 空状态 -->
          <div
            v-if="results.length === 0"
            class="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center py-16 text-gray-400"
          >
            <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="text-body-sm">点击「开始生成」查看结果</span>
          </div>

          <!-- 结果网格：1/2/3 列自适应，手机端一律单列 -->
          <div
            v-else
            :class="['grid gap-3', resultGridClass]"
          >
            <div
              v-for="slot in results"
              :key="slot.id"
              class="result-slot"
              :class="`result-slot--${slot.status}`"
            >
              <!-- pending：每格独立 canvas 粒子 + 灯泡图标 + 阶段文案 -->
              <div
                v-if="slot.status === 'pending'"
                class="slot-pending"
                role="status"
                aria-live="polite"
              >
                <canvas :data-slot-canvas="slot.id" class="slot-pending-canvas" aria-hidden="true" />
                <div class="slot-pending-overlay">
                  <div class="slot-pending-bulb">
                    <div class="slot-pending-bulb-aura" />
                    <svg class="slot-pending-bulb-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <span class="slot-pending-title">AI 正在创作</span>
                  <span class="slot-pending-time">
                    {{ formatElapsed(slot.elapsedSeconds) }} · {{ phaseText(slot.elapsedSeconds) }}
                  </span>
                </div>
              </div>

              <!-- success：图片 + 下载/新标签页 -->
              <div v-else-if="slot.status === 'success'" class="slot-success">
                <div
                  class="result-draggable"
                  draggable="true"
                  @dragstart="onSlotDragStart($event, slot)"
                >
                  <el-image
                    :src="slot.url"
                    fit="contain"
                    class="block w-full result-image"
                    style="cursor: zoom-in;"
                    draggable="true"
                    alt="生成结果"
                    @click="openPreview(slot.url, results.map(r => r.url), results.findIndex(r => r.id === slot.id))"
                  >
                    <!-- 加载占位：success 状态瞬间或慢请求场景下避免宽高为 0 -->
                    <template #placeholder>
                      <div class="image-placeholder" role="status" aria-live="polite">
                        <!-- 直接用 Tailwind 的 animate-spin（项目里 TOS/AppsTab/ImageColorCount 等都用过，
                            spin keyframes 一定在产物里），绕开 EP / scoped CSS 任何潜在干扰 -->
                        <svg
                          class="image-placeholder-spinner animate-spin"
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-dasharray="30 20"
                            stroke-linecap="round"
                          />
                        </svg>
                        <span class="image-placeholder-text">加载中…</span>
                      </div>
                    </template>
                    <!-- 加载失败占位 -->
                    <template #error>
                      <div class="image-placeholder image-placeholder--error">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                        </svg>
                        <span class="image-placeholder-text">图片加载失败</span>
                      </div>
                    </template>
                  </el-image>
                  <p class="text-caption text-gray-400 text-center mt-1 select-none">
                    桌面端：拖拽此图片到上方上传区即可继续编辑；手机端：点击「发送至上传区」按钮
                  </p>
                </div>
                <div class="flex gap-2 mt-2 flex-wrap sm:flex-nowrap">
                  <button
                    @click="downloadSlot(slot)"
                    class="flex-1 min-w-[30%] py-2 rounded-lg bg-blue-600 text-white text-body-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                    下载
                  </button>
                  <button
                    @click="sendResultToUpload(slot)"
                    :disabled="isBatchLoading || !canAddMore || isRefillingImage"
                    class="flex-1 min-w-[30%] py-2 rounded-lg border border-accent-300 bg-accent-50 text-accent-700 text-body-sm font-medium hover:bg-accent-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent-50"
                    title="把当前生成结果作为新参考图发送到上传区（手机端专用入口）"
                    aria-label="发送至上传区"
                  >
                    <template v-if="isRefillingImage">
                      <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" stroke-opacity=".25" />
                        <path stroke-linecap="round" d="M21 12a9 9 0 0 0-9-9" />
                      </svg>
                      正在发送…
                    </template>
                    <template v-else>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
                      </svg>
                      发送至上传区
                    </template>
                  </button>
                  <button
                    @click="openSlotInNewTab(slot)"
                    class="flex-1 min-w-[30%] py-2 rounded-lg border border-gray-300 text-gray-700 text-body-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    新标签页
                  </button>
                </div>
                <!-- 跳转到「图片切割」工具：把当前生成图作为源图带上（带 recordId 走后端代理绕开第三方图床 CORS） -->
                <button
                  @click="openInImgCut(slot)"
                  class="w-full mt-2 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-body-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-colors flex items-center justify-center gap-1.5"
                  title="打开「图片切割」并把这张图作为源图加载"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121M12 12l2.879-2.879M12 12L9.121 14.879M21 3v6h-6M3 21v-6h6" />
                  </svg>
                  开始分割
                </button>
              </div>

              <!-- failed：错误信息 + 重试按钮 -->
              <div v-else class="slot-failed">
                <div class="slot-failed-icon">
                  <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                </div>
                <p class="slot-failed-title">生成失败</p>
                <p class="slot-failed-msg">{{ slot.errorMsg }}</p>
                <button
                  @click="retrySlot(slot)"
                  :disabled="isBatchLoading"
                  class="slot-retry-btn"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重试
                </button>
              </div>
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
        <p><strong>并发数（1-5）：</strong>选择「开始生成」后，浏览器会并行发出 N 个相同请求，每张结果独立显示、独立计时，失败的格子可单独「重试」（仅该次扣费）。适合同一提示词多跑几张变体挑选最佳。</p>
        <p><strong>模型说明：</strong></p>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong>gpt-image-2：</strong>通用图片编辑/生成模型，适用于文生图和图生图任务。</li>
          <li><strong>Gemini 3 Pro Image Preview：</strong>Google 旗舰图片模型，质量高、支持文生图与图生图。</li>
          <li><strong>Gemini 3.1 Flash Image Preview：</strong>Google Flash 图片预览版，速度快、性价比高，支持文生图与图生图。</li>
        </ul>
        <p class="text-ink-500">提示：生成结果受提示词质量影响，详细的描述通常能得到更好的效果。</p>
      </div>
    </ToolDetail>

    <!-- 用户生成历史弹窗 -->
    <GenerationHistoryDialog ref="historyRef" :on-preview="openPreview" />
    <UserPromptLibraryDialog ref="promptLibraryRef" scene="ai-image-edit" @select="onPromptSelect" />

    <!--
      历史缩略图全屏预览：渲染在 AiImageEdit.vue 根级，跟历史弹窗在同一 DOM 树层级之外，
      弹窗和预览图都在 body 下，由各自 nextZIndex()/显式 z-index 决定层叠，
      不会发生"列表盖住图片"的情况。
    -->
    <el-image-viewer
      v-if="previewOpen && previewList.length > 0"
      :url-list="previewList"
      :initial-index="previewIndex"
      teleported
      :z-index="9999"
      hide-on-click-modal
      :close-on-press-escape="true"
      @close="closePreview"
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
  /* minmax + auto-fill 保持列宽最小 96px、超出后自动折行；
     grid-auto-rows: auto 让每行高度跟着 row 里实际最高的 cell 走，
     长图（9:16）上传时该 cell 高度自然撑高，不会被压成正方形导致图片裁切 */
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  grid-auto-rows: auto;
  gap: 8px;
}
.upload-thumb {
  position: relative;
  /* 默认正方形兜底；JS 探测到宽高比后通过 :style="aspectRatio:..." 覆盖 */
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  cursor: grab;        /* 可拖拽排序（Sortable 延迟 80ms 触发，不与点击放大冲突）*/
  transition: border-color .15s ease, transform .15s ease;
}
.upload-thumb:hover {
  border-color: #93c5fd;
}
.upload-thumb:active {
  cursor: grabbing;
}
/* Sortable.js 拖拽反馈：原位置虚化 + 目标位置高亮 */
:deep(.upload-thumb-ghost) {
  opacity: 0.35;
  border-style: dashed;
  border-color: #3b82f6;
  background: #eff6ff;
}
:deep(.upload-thumb-chosen) {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}
:deep(.upload-thumb-dragging) {
  cursor: grabbing;
  transform: scale(1.04);
}
/* 阻止 el-image 内部 img 在拖拽时被浏览器当成图片拖出（会盖过父 div 的 dragstart）
   注意：不要同时写 pointer-events: none，否则点击缩略图放大也会失效 */
:deep(.upload-thumb-img img),
:deep(.upload-thumb img) {
  -webkit-user-drag: none;
  user-drag: none;
  /* Firefox：draggable=false 也能阻止 img 原生拖拽 */
  pointer-events: auto;
}
:deep(.upload-thumb-img) {
  display: block;
  width: 100%;
  height: 100%;
}
:deep(.upload-thumb-img img) {
  /* contain：9:16 等长图在正方形 / 长方形 cell 内完整显示（不被裁切）。
     cell 的 aspect-ratio 由 JS 根据图片宽高比动态设置，长图 cell 会拉高 */
  width: 100%;
  height: 100%;
  object-fit: contain;
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
  background: #ef4444;
  transform: scale(1.08);
}
.upload-thumb-remove:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  transform: none;
  background: rgba(0, 0, 0, 0.55);
}
/* 移动端 / 触屏：移除按钮始终可见，避免 hover 才能点 */
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
  border-color: #3b82f6;
  background: #eff6ff;
}

/* ============ 拖拽视觉反馈 ============ */
.upload-dropzone {
  position: relative;
  border-radius: 12px;
  transition: background-color .15s ease;
}
.upload-dropzone.is-dragover :deep(.el-upload-dragger) {
  border-color: #3b82f6;
  background-color: rgb(var(--accent-50, 239 246 255));
  box-shadow: 0 0 0 3px rgba(59, 130, 246, .15) inset;
}
.upload-dropzone.is-dragover :deep(.el-upload-dragger) * {
  pointer-events: none;
}

/* 生成结果可拖区域：鼠标拖动时显示 grab 光标 */
.result-draggable {
  border-radius: 8px;
  transition: outline-color .15s ease;
  outline: 2px dashed transparent;
  outline-offset: 4px;
}
.result-draggable:hover {
  outline-color: #93c5fd;
  cursor: grab;
}
.result-draggable:active {
  cursor: grabbing;
  outline-color: #3b82f6;
}
/* 阻止 el-image 内部 img 在拖动时浏览器默认「拖出新标签」预览 */
:deep(.result-draggable img) {
  -webkit-user-drag: element;
  user-drag: element;
}

/* ============ 拖拽回填 loading 遮罩 + 自驱动 spinner ============
   spinner 用 JS requestAnimationFrame 改 transform，
   完全不依赖 CSS 动画 / @keyframes / SVG SMIL，
   避免 prefers-reduced-motion、scoped keyframes、第三方 CSS 注入失败等问题。 */
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
  border: 3px solid #e0e7ff;          /* 浅灰蓝底圈 */
  border-top-color: #6366f1;          /* 顶部亮色 = 转的那一段 */
  border-radius: 50%;
  /* 关键：不写 animation；旋转由 JS rAF 直接改 style.transform */
  will-change: transform;
}
.refill-text {
  font-size: 13px;
  color: #4b5563;
  letter-spacing: 0.02em;
}

/* ============ N 路并发生成：每格独立样式 ============ */
.result-slot {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}
.result-slot--success {
  background: #fff;
}
.result-slot--failed {
  background: #fef2f2;
  border-color: #fecaca;
}

/* pending：紫色卡片 + canvas 粒子 + 灯泡图标 + 阶段文案 */
.slot-pending {
  position: relative;
  min-height: 220px;
  overflow: hidden;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
  color: #fff;
}
.slot-pending-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}
.slot-pending-overlay {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 220px;
  padding: 24px 16px;
  pointer-events: none;
}
.slot-pending-bulb {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.slot-pending-bulb-aura {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(168, 85, 247, 0.25);
  animation: ping-slow 2.4s ease-out infinite;
}
.slot-pending-bulb-icon {
  width: 26px;
  height: 26px;
  color: #d8b4fe;
  position: relative;
  z-index: 1;
}
.slot-pending-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.95);
}
.slot-pending-time {
  font-size: 12px;
  color: rgba(255,255,255,0.65);
  font-family: ui-monospace, SFMono-Regular, monospace;
  letter-spacing: 0.02em;
}

/* success：图片自然撑满，下载/新标签页紧凑两列
   min-height 与 .slot-pending 一致——从 pending 切到 success 的瞬间 el-image 还没
   加载完图片，wrapper 默认高度为 0，不锁最小高度会让整个结果区塌陷成宽高=0 */
.slot-success {
  display: flex;
  flex-direction: column;
  min-height: 220px;
}
/* 让 el-image wrapper 继承容器高度，避免 fit="contain" + 图片未加载完时塌成 0 */
:deep(.slot-success .el-image),
:deep(.result-image) {
  width: 100%;
  min-height: 220px;
  background: #fafafa;
  display: block;
}
/* contain 模式下：限制图片最大高度，避免 16:9 等细长比例图把按钮区顶到屏幕外 */
:deep(.slot-success .el-image__inner) {
  max-height: 480px;
  margin: 0 auto;
  display: block;
  object-fit: contain;
}
/* 图片加载占位：spinner + 文案，与 pending 状态视觉上一致 */
.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 220px;
  color: #9ca3af;
  font-size: 13px;
}
.image-placeholder-spinner {
  color: #6366f1;
}
.image-placeholder--error {
  color: #f87171;
}

/* ⚠️ prefers-reduced-motion 例外：系统开启「减弱动态效果」（如 Windows 关闭动画效果）时，
   tailwind.css 的全局媒体查询会把所有 CSS 动画冻结成 0.01ms 单次。
   但 loading 指示器不动，用户就感知不到「正在加载/正在生成」——
   这里单独放行这两个加载动画（转圈 + 灯泡光晕），与组件里 refill-spinner 用
   rAF 绕开 prefers-reduced-motion 的意图一致。 */
@media (prefers-reduced-motion: reduce) {
  .image-placeholder-spinner {
    animation-duration: 1s !important;
    animation-iteration-count: infinite !important;
  }
  .slot-pending-bulb-aura {
    animation-duration: 2.4s !important;
    animation-iteration-count: infinite !important;
  }
}

/* failed：错误居中 + 重试按钮 */
.slot-failed {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
}
.slot-failed-icon {
  color: #ef4444;
}
.slot-failed-title {
  font-size: 14px;
  font-weight: 600;
  color: #991b1b;
}
.slot-failed-msg {
  font-size: 12px;
  color: #b91c1c;
  word-break: break-word;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.slot-retry-btn {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #fca5a5;
  color: #b91c1c;
  font-size: 13px;
  font-weight: 500;
  transition: background-color .15s ease, border-color .15s ease;
}
.slot-retry-btn:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #f87171;
}
.slot-retry-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

/* 并发生成：每格 loading 小转圈 */
@keyframes slot-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

/* ============ Element Plus 全屏图片预览 ============
   el-image-viewer 默认 canvas 是 100vw × 100vh，img 同时设了 max-width:100% 与 max-height:100%，
   对 9:16 长图：
     - max-width:100vw 让图宽撑满视口
     - max-height:100vh 同时生效，触发等比缩放，宽度再被压回到 (100vh × 9/16) ≈ 56vh
   所以「9:16 长图 + 全屏 viewport」实际渲染宽度 ≈ 56vh（小尺寸屏甚至更窄），
   视觉上像被裁掉了一样（实际上不是被裁，只是等比缩小居中显示，上下大量黑边）。

   EP 2.x 默认行为就是这种「保持比例 + 居中」，并非 bug。但因为我们在上传缩略图上
   用了 cover，长图被裁掉时用户心理预期是「原图能看到全貌」，看到全屏 viewer 不再被裁
   反而觉得奇怪。下面的样式让全屏 viewer 在长图情况下显示更「贴近原图大小」：
     - 不强制拉伸 width:auto + max-width:100vw
     - max-height 减去 viewer 顶部 toolbar / 关闭按钮区域（实际值由 EP 内部 .el-image-viewer__actions 高度决定，约 56px）
     - object-fit:contain 保证不被裁切
   这段全局生效（el-image-viewer 是 teleport 到 body 的，scoped 样式无法触及） */
.el-image-viewer__canvas img,
 .el-image-viewer__img {
  max-width: 100vw !important;
  max-height: calc(100vh - 64px) !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
}
</style>

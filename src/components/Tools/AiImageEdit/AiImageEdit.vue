<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import GenerationHistoryDialog from './GenerationHistoryDialog.vue'
import CreationPickerDialog from './CreationPickerDialog.vue'
import UserPromptLibraryDialog from '@/components/Common/UserPromptLibraryDialog.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { autoDown } from '@/utils/file'
import { fetchToolModels, type PublicToolModel } from '@/api/tool-models'
import { fetchMyGenerationRecordImage } from '@/api/me'
import type { AiCreationImage } from '@/api/ai-creations'
import { useUserStore } from '@/store/modules/user'
import { useCachedRef } from './composables/useCachedRef'
import { useSlotVisuals, type ResultSlot } from './composables/useSlotVisuals'
import { useViewer } from './composables/useViewer'
import { useUpload, MAX_IMAGES } from './composables/useUpload'
import { useSaveToCreations } from './composables/useSaveToCreations'
import { useGenerate } from './composables/useGenerate'

const info = reactive({
  title: 'AI图片编辑',
  desc: 'AI智能图片编辑，支持图片生成（文生图）、图片编辑（图生图）。上传图片+输入文字描述，AI帮你一键生成新图片。',
})

// ============ 模型 / 尺寸 / 并发配置 ============
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

// 表单状态（直接从 localStorage 读初值，避免「默认值 → 异步赋值」的中间态）。
// selectedSize / selectedConcurrency 由 useCachedRef 初始化时已读 cache。
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

// ============ 提示词 ============
const prompt = ref('')
const promptTouched = ref(false)
// 提示词缓存 key：刷新页面后自动恢复上次输入
const PROMPT_CACHE_KEY = 'ai-image-edit:prompt'

// 提示词库弹窗 ref（从提示词库选择）
const promptLibraryRef = ref<InstanceType<typeof UserPromptLibraryDialog> | null>(null)
// 当前选中的提示词库 id（保存到「我的 AI 创作」时用作 group 复用键；未选则不传）
const selectedPromptId = ref<string | null>(null)
// 选中提示词库里的某条后，回填到输入框（强制覆盖，保持和「点开 → 选中」的语义一致）
const onPromptSelect = (payload: { id: string; title: string; content: string }) => {
  prompt.value = payload.content
  selectedPromptId.value = payload.id
  ElMessage.success(payload.title ? `已填入「${payload.title}」` : '已填入提示词')
}

// 清空提示词 + 移除 localStorage 缓存
const clearPrompt = () => {
  prompt.value = ''
  promptTouched.value = false
  selectedPromptId.value = null // 提示词被清空，原 prompt id 失效
  try {
    localStorage.removeItem(PROMPT_CACHE_KEY)
  } catch {
    // 静默忽略
  }
}

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

// ============ 用户 store / 路由 ============
// 用户 store（右上角积分 badge 用）
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

// 历史弹窗 ref
const historyRef = ref<InstanceType<typeof GenerationHistoryDialog> | null>(null)

// 从「我的创作」选择素材弹窗 ref
const creationPickerRef = ref<InstanceType<typeof CreationPickerDialog> | null>(null)

// 选中创作素材 → 后端代理拉 blob（R2 公网图不带 CORS 头，浏览器直接 fetch 会被拦）
// → 转 File 加入上传区（当作普通参考图）
const handlePickCreationImage = async (img: AiCreationImage) => {
  try {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(img.media_url)}`
    const resp = await fetch(proxyUrl)
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status}${text ? `: ${text}` : ''}`)
    }
    const blob = await resp.blob()
    const type = blob.type || 'image/png'
    const ext = type.includes('jpeg') || type.includes('jpg')
      ? 'jpg'
      : type.includes('webp')
        ? 'webp'
        : type.includes('gif')
          ? 'gif'
          : 'png'
    const file = new File([blob], `creation-${img.id}.${ext}`, { type })
    addImageFiles([file])
  } catch (err) {
    ElMessage.error('读取创作素材失败：' + (err as Error)?.message)
  }
}

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

// ============ 共享状态（各 composable 的输入） ============
// 用 reactive 让 slot 内部属性（status/elapsedSeconds 等）变更触发更新
const results = reactive<ResultSlot[]>([])
// 批次级 loading：只要还有任意 slot 是 pending 就保持 true
const isBatchLoading = ref(false)

// ============ 组合各功能 composable ============
const slotVisuals = useSlotVisuals()
const viewer = useViewer()
const upload = useUpload()
const save = useSaveToCreations({ results, prompt, selectedPromptId, selectedModel })
const gen = useGenerate({
  results,
  isBatchLoading,
  prompt,
  promptTouched,
  modelLoaded,
  modelList,
  selectedModel,
  selectedSize,
  selectedConcurrency,
  currentModelCost,
  imageFiles: upload.imageFiles,
  userStore,
  slotVisuals: {
    createPendingSlot: slotVisuals.createPendingSlot,
    startSlotTimer: slotVisuals.startSlotTimer,
    stopSlotTimer: slotVisuals.stopSlotTimer,
    stopAllSlotVisuals: slotVisuals.stopAllSlotVisuals,
  },
  clearSavedFlags: save.clearSavedFlags,
  // 生成完一张就立刻自动保存到创作（不等整批收尾；saveChecked 为 false 的图自动跳过）
  onSlotSuccess: (slot) => {
    void save.autoSaveSlot(slot)
  },
})

// 解构出模板需要的绑定名（保持与模板一致）
const {
  previewList, previewIndex, previewOpen,
  openPreview, closePreview, restoreBodyScrollLock,
} = viewer
const {
  uploadRef, imageFiles, imagePreviews, uploadedFileNames, imageIds, imageAspectStyles,
  imageGridRef, canAddMore, remainingSlots, isDragOver, isRefillingImage, spinnerRef,
  handleChange, handleExceed, handleUpload, addImageFiles, removeImage, clearAllImages,
  onDragEnter, onDragOver, onDragLeave, onUploadDrop, onSlotDragStart,
} = upload
const {
  savedGroupIds, savedImageCount, successfulResults, autoSaveSlot,
} = save
const {
  btnRef, canGenerate, concurrencyHint, generateImage, retrySlot,
  batchStartAt, batchEndAt, totalElapsedMs, formatBatchDuration,
} = gen
const { formatElapsed, phaseText } = slotVisuals

// 结果区网格列数：1 全宽，2+ 两列（不搞三列，避免卡片太挤；手机端一律单列）
const resultGridClass = computed(() => {
  const n = results.length
  if (n <= 1) return 'grid-cols-1'
  return 'grid-cols-1 md:grid-cols-2'
})

// ============ 单格操作按钮 ============

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
  if (!slot.url && !slot.recordId) return
  const params = new URLSearchParams()
  // 只有「短」的 http(s) URL 才放进 query：data: base64 大图动辄几 MB，
  // 塞进链接会让 window.open 因 URL 过长而静默失败（用户看到的就是"点了没反应"）。
  // data: 图一律靠 recordId 让 ImgCut 走后端代理取（见 ImgCut loadFromUrl）。
  const isShortHttpUrl = /^https?:\/\//i.test(slot.url) && slot.url.length <= 4000
  if (isShortHttpUrl) params.set('url', slot.url)
  if (slot.recordId) params.set('recordId', slot.recordId)
  const target = router.resolve({
    path: '/imgcut/',
    query: Object.fromEntries(params.entries()),
  }).href
  window.open(target, '_blank', 'noopener,noreferrer')
}

// ============ 生命周期编排 ============
onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
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
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
  slotVisuals.stopAllSlotVisuals()
  gen.stopBtnAnim()
  // 兜底：预览开着时直接离开页面（路由切换），viewer 随组件卸载不会恢复 body 滚动锁
  restoreBodyScrollLock()
})
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
              <span class="flex items-center gap-2">
                上传图片（可选）
                <button
                  type="button"
                  @click="creationPickerRef?.open()"
                  class="text-xs font-normal px-2 py-0.5 rounded-full border border-accent-300 text-accent-700 hover:bg-accent-50 transition-colors"
                  title="从「我的 AI 创作」里选择已有的生成图作为参考图"
                >从创作结果选择素材</button>
              </span>
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
                  <div
                    ref="imageGridRef"
                    class="upload-grid"
                    :class="{ 'is-single': imageFiles.length === 1 }"
                  >
                    <div
                      v-for="(preview, idx) in imagePreviews"
                      :key="imageIds[idx]"
                      class="upload-thumb"
                      :style="imageAspectStyles[idx]
                        ? {
                            aspectRatio: imageAspectStyles[idx].aspectRatio,
                            gridColumn: `span ${imageAspectStyles[idx].gridColumnSpan}`,
                          }
                        : { aspectRatio: '4 / 3' }"
                      @click.stop
                    >
                      <el-image
                        :src="preview"
                        fit="cover"
                        class="upload-thumb-img"
                        alt="上传预览"
                        @click="openPreview(preview, imagePreviews, idx)"
                      />
                      <button
                        type="button"
                        @click.stop="removeImage(idx)"
                        class="upload-thumb-remove"
                        :title="`移除 ${uploadedFileNames[idx] || ''}`"
                        aria-label="移除图片"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span class="upload-thumb-name">{{ uploadedFileNames[idx] }}</span>
                    </div>
                    <!-- 末尾「继续添加」占位（生成中也可继续添加图片） -->
                    <div v-if="canAddMore" class="upload-add-tile" :title="`还可添加 ${remainingSlots} 张`">
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
              class="mt-2 text-body-sm text-red-500 hover:text-red-700 flex items-center"
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
          <div class="flex items-center justify-between gap-2 flex-wrap">
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

            <!-- 自动保存到我的创作（无需手动、无开关）：生成完一张自动存一张 -->
            <div v-if="successfulResults.length > 0" class="flex items-center gap-2">
              <span
                v-if="savedGroupIds"
                class="text-caption text-green-600 font-medium"
              >
                ✓ 已保存 {{ savedImageCount }} 张到我的作品
              </span>
            </div>
          </div>

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

          <!-- 结果网格：1/2 列自适应（不设 3 列避免拥挤），手机端一律单列 -->
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
                </div>
                <!-- 自动保存状态：保存中 / 已保存 / 失败可重试（无需手动也无需勾选，生成完自动全部保存） -->
                <div class="flex items-center gap-2 px-1 mt-1.5 text-caption">
                  <span v-if="slot.saveStatus === 'saving'" class="flex items-center gap-1 text-blue-500 font-medium">
                    <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                    保存中…
                  </span>
                  <span v-else-if="slot.saveStatus === 'saved'" class="text-green-600 font-medium">✓ 已保存</span>
                  <template v-else-if="slot.saveStatus === 'failed'">
                    <span class="text-red-500">保存失败</span>
                    <button type="button" @click="autoSaveSlot(slot)" class="text-accent-600 hover:underline">重试保存</button>
                  </template>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2">
                  <button
                    @click="downloadSlot(slot)"
                    class="py-2 rounded-lg bg-blue-600 text-white text-body-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                    下载
                  </button>
                  <button
                    @click="sendResultToUpload(slot)"
                    :disabled="isBatchLoading || !canAddMore || isRefillingImage"
                    class="py-2 rounded-lg border border-accent-300 bg-accent-50 text-accent-700 text-body-sm font-medium hover:bg-accent-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent-50"
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
                    class="py-2 rounded-lg border border-gray-300 text-gray-700 text-body-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    新标签页
                  </button>
                  <!-- 跳转到「图片切割」工具：把当前生成图作为源图带上（带 recordId 走后端代理绕开第三方图床 CORS） -->
                  <button
                    @click="openInImgCut(slot)"
                    class="py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-body-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-colors flex items-center justify-center gap-1.5"
                    title="打开「图片切割」并把这张图作为源图加载"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121M12 12l2.879-2.879M12 12L9.121 14.879M21 3v6h-6M3 21v-6h6" />
                    </svg>
                    开始分割
                  </button>
                </div>
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
    <CreationPickerDialog ref="creationPickerRef" @select="handlePickCreationImage" />

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
/* CSS Grid：列宽下限 140px，span 2 的宽图横展更明显。
   grid-auto-flow: dense 让浏览器智能填充空隙。
   每张缩略图根据自身宽高比决定 gridColumnSpan：宽图（ratio>=1.6）span 2，
   让 2:1 / 16:9 横图能横着展开不被 1fr 等分列压扁成细条。
   aspect-ratio 同步作用：cell 高度按比例自适应，长宽各异都看着自然 */
.upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  grid-auto-flow: dense;
  grid-auto-rows: auto;
  gap: 8px;
}
/* 单图时让缩略图占更多横向空间（去掉列数限制，按容器宽度自适应） */
.upload-grid.is-single {
  grid-template-columns: minmax(0, 7fr) auto;
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
  /* 「+」位固定 96×96（flex/grid 模式下都适用） */
  width: 96px;
  height: 96px;
  flex: 0 0 auto;
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

/* success：图片自然撑满，操作区紧凑
   min-height 与 .slot-pending 一致——从 pending 切到 success 的瞬间 el-image 还没
   加载完图片，wrapper 默认高度为 0，不锁最小高度会让整个结果区塌陷成宽高=0 */
.slot-success {
  display: flex;
  flex-direction: column;
  min-height: 220px;
}
/* 让 el-image wrapper 铺满宽度，不再强制最小高度 / 加灰底——
   图片未加载完成时由 min-height 兜底，加载后按自身比例撑满，避免底部留大片空白 */
:deep(.slot-success .el-image),
:deep(.result-image) {
  width: 100%;
  display: block;
  border-radius: 10px;
  overflow: hidden;
}
/* contain 模式下：横向占满、纵向按自身比例（不再设固定 min-height / max-height 顶出留白）；
   仅对超高竖图设一个安全上限，避免把下方按钮顶出屏幕——height:auto + max-height 会等比缩小，
   不会产生 letterbox 空白 */
:deep(.slot-success .el-image__inner) {
  width: 100%;
  height: auto;
  max-height: 640px;
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

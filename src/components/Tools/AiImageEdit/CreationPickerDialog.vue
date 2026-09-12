<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAiCreations, type AiCreationImage } from '@/api/ai-creations'
import ManualUploadDialog from '@/components/Tools/MyAiCreations/ManualUploadDialog.vue'

// 从「我的 AI 创作」里选择图片作为上传素材（复用 fetchAiCreations 数据源）。
// 支持多选：用户勾选 N 张 → 点「确认」一次性 emit 数组给父组件，
// 父组件走 image-proxy 批量拉 blob 再 addImageFiles 追加到上传区。
//
// maxSelect 可选：限制最多可勾选的张数；不传则不限制。
// 用于「上传区已选了 K 张、剩余槽位只有 (MAX-K)」这种联动场景——
// 上传区满后弹窗里置灰未选图，避免用户选了又被上传区拒掉。
const props = defineProps<{
  /** 最多可选张数；不传（undefined）表示不限制 */
  maxSelect?: number
  /**
   * 预选中的图片 id 列表。打开弹窗时作为初始选中态（用于「上次选了 1、2、3、
   * 再次打开时仍要能看到它们被选中」的场景）。
   * 不传或传空数组则默认全空。父组件通常从「上传区里属于创作素材的 file.name
   * 解析出 id」算出来传进来，保证视图跟数据状态一致。
   */
  preselectedIds?: number[]
}>()

const emit = defineEmits<{
  (e: 'select', images: AiCreationImage[]): void
}>()

const visible = ref(false)
const uploadVisible = ref(false)
const loading = ref(false)
type PickerImage = AiCreationImage & { source_type: 'ai_generated' | 'manual_upload' }

const items = ref<PickerImage[]>([])
const page = ref(1)
const hasNext = ref(false)
const PAGE_SIZE = 24
const sourceFilter = ref<'all' | 'ai_generated' | 'manual_upload'>('all')
const keyword = ref('')
const selectedById = ref<Map<number, PickerImage>>(new Map())

const selectedIds = ref<Set<number>>(new Set())
const selectedImages = computed(() => Array.from(selectedById.value.values()))
const sourceParam = computed(() => sourceFilter.value === 'all' ? undefined : sourceFilter.value)
let loadVersion = 0

// 是否有限制 + 还剩几个可选 + 是否已达上限
const hasLimit = computed(() => typeof props.maxSelect === 'number' && props.maxSelect > 0)
const remainingQuota = computed(() =>
  hasLimit.value ? Math.max(0, (props.maxSelect as number) - selectedIds.value.size) : Infinity,
)
const isReachedLimit = computed(() => hasLimit.value && selectedIds.value.size >= (props.maxSelect as number))

// 移动端检测：弹窗宽度 / 网格列数都跟着 isMobile 走
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

const open = () => {
  visible.value = true
  selectedIds.value = new Set(props.preselectedIds ?? [])
  selectedById.value = new Map()
  page.value = 1
  hasNext.value = false
  void load(true)
}

const load = async (reset = false) => {
  const version = ++loadVersion
  loading.value = true
  try {
    const result = await fetchAiCreations({
      page: page.value,
      pageSize: PAGE_SIZE,
      source: sourceParam.value,
      q: keyword.value.trim() || undefined,
    })
    // 分类或关键词已变化时，丢弃旧请求结果，避免覆盖当前筛选条件。
    if (version !== loadVersion) return
    const imgs: PickerImage[] = result.groups.flatMap((g) => (g.images || []).map((img) => ({
      ...img,
      source_type: g.source_type,
    })))
    if (reset) items.value = imgs
    else items.value.push(...imgs.filter((img) => !items.value.some((existing) => existing.id === img.id)))
    imgs.forEach((img) => {
      if (selectedIds.value.has(img.id)) selectedById.value.set(img.id, img)
    })
    selectedById.value = new Map(selectedById.value)
    hasNext.value = result.pagination.hasNext
  } catch {
    if (version === loadVersion) ElMessage.error('加载创作结果失败，请稍后重试')
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

const loadMore = () => {
  if (!hasNext.value || loading.value) return
  page.value += 1
  void load()
}

const refresh = () => {
  loadVersion += 1
  page.value = 1
  hasNext.value = false
  items.value = []
  void load(true)
}

const onUploadSuccess = async (payload: { refresh: () => Promise<unknown> }) => {
  await payload.refresh()
  uploadVisible.value = false
  refresh()
  ElMessage.success('创作列表已刷新')
}

watch([sourceFilter, keyword], () => {
  if (visible.value) refresh()
})

// 切换选中态：单击图片不再立刻 emit，而是切换 selectedIds。
// 选中态通过右上角 ✓ 徽标 + 边框高亮反馈，桌面端 + 移动端都能看清。
//
// 限制逻辑：有 maxSelect 且已达上限时，**禁止再勾选新图**（已选的可以取消）。
// 阻止用户选了又被上传区拒掉——体验上比给个 error 提示更直接。
const togglePick = (img: PickerImage) => {
  const isSelected = selectedIds.value.has(img.id)
  if (isSelected) {
    // 取消选中永远允许
    selectedIds.value.delete(img.id)
    selectedById.value.delete(img.id)
  } else {
    // 新勾选：达上限则拦截
    if (hasLimit.value && selectedIds.value.size >= (props.maxSelect as number)) {
      ElMessage.warning(`已达上限 ${props.maxSelect} 张，先取消几张再选`)
      return
    }
    selectedIds.value.add(img.id)
    selectedById.value.set(img.id, img)
  }
  selectedIds.value = new Set(selectedIds.value)
  selectedById.value = new Map(selectedById.value)
}

// 确认选择：emit 数组给父组件，进入"提交中"态等父组件处理完手动调 close()。
// 不立即关闭弹窗的原因是父组件要走 image-proxy 拉 blob + addImageFiles，
// 多张图时这段耗时可观，用户中途看到弹窗"消失但上传区没变化"会以为没点上。
// submitting 态：禁用勾选 + footer 按钮变 loading，让用户明确感知在等待。
const submitting = ref(false)
const confirmPick = () => {
  if (selectedImages.value.length === 0) {
    ElMessage.warning('请先勾选素材')
    return
  }
  if (submitting.value) return
  submitting.value = true
  emit('select', selectedImages.value)
}

/** 父组件在 select handler 处理完后调用，正常关闭弹窗 */
const close = () => {
  visible.value = false
  submitting.value = false
}

/** 父组件 select handler 抛错时调用，恢复可交互状态但保留弹窗让用户重试 */
const cancelSubmitting = () => {
  submitting.value = false
}

// 关闭弹窗时清掉选中残留
watch(visible, (v) => {
  if (!v) {
    selectedIds.value = new Set()
    selectedById.value = new Map()
  }
})

defineExpose({ open, close, cancelSubmitting })

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="从我的创作选择素材"
    :width="isMobile ? '92vw' : '860px'"
    :close-on-click-modal="true"
    append-to-body
  >
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <el-radio-group v-model="sourceFilter" size="small" :disabled="submitting">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="ai_generated">AI 生成</el-radio-button>
          <el-radio-button label="manual_upload">手动上传</el-radio-button>
        </el-radio-group>
        <el-input
          v-model="keyword"
          clearable
          size="small"
          class="min-w-[180px] flex-1"
          placeholder="搜索文件名、提示词或标题"
          :disabled="submitting"
        />
        <el-button size="small" :disabled="submitting" @click="uploadVisible = true">上传图片</el-button>
      </div>

      <!-- 首次加载 / 切换筛选条件时：不展示旧列表，避免误以为筛选没有生效 -->
      <div v-if="loading && items.length === 0" class="flex min-h-[240px] flex-col items-center justify-center gap-3 text-gray-400 text-sm" role="status" aria-live="polite">
        <svg class="h-8 w-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" />
          <path class="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        <span>正在加载素材…</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!loading && items.length === 0" class="py-16 text-center text-gray-400 text-sm">
        {{ keyword.trim() || sourceFilter !== 'all' ? '没有匹配的创作结果' : '还没有创作结果，先去生成几张吧' }}
      </div>

      <!-- 图片网格：桌面 3 列 + h-56，移动 2 列 + h-40 让每张图清晰可辨 -->
      <div
        v-else
        :class="[
          'grid gap-3 max-h-[60vh] overflow-y-auto p-1',
          isMobile ? 'grid-cols-2' : 'grid-cols-3',
        ]"
        @scroll="(e) => { const el = e.target as HTMLElement; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) loadMore() }"
      >
        <div
          v-for="img in items"
          :key="img.id"
          :class="[
            'relative rounded-lg overflow-hidden border cursor-pointer group bg-gray-50 transition-colors',
            selectedIds.has(img.id)
              ? 'border-indigo-500 ring-2 ring-indigo-400/40'
              : (hasLimit && isReachedLimit
                  ? 'border-gray-200 opacity-50 cursor-not-allowed'
                  : 'border-gray-200 hover:border-indigo-400 active:border-indigo-500'),
            submitting ? 'opacity-70 pointer-events-none' : '',
          ]"
          role="checkbox"
          :aria-checked="selectedIds.has(img.id)"
          :aria-disabled="hasLimit && isReachedLimit && !selectedIds.has(img.id)"
          tabindex="0"
          @click="togglePick(img)"
          @keyup.enter="togglePick(img)"
          @keyup.space.prevent="togglePick(img)"
        >
            <img
              :src="img.thumbnail_url || img.media_url"
              :alt="img.filename || img.prompt || '创作素材'"

            loading="lazy"
            :class="[
              'w-full object-contain transition-transform duration-200 group-hover:scale-105',
              isMobile ? 'h-40' : 'h-56',
            ]"
          />

            <div class="absolute left-2 top-2 flex gap-1">
              <span class="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {{ img.source_type === 'manual_upload' ? '手动上传' : 'AI 生成' }}
              </span>
            </div>
            <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-2 py-1 text-xs text-white">
              {{ img.filename || '未命名图片' }}
            </div>

          <div
            class="absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shadow-sm"
            :class="selectedIds.has(img.id)
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white/80 border-gray-300 text-transparent group-hover:border-indigo-400'"
            aria-hidden="true"
          >
            <svg v-if="selectedIds.has(img.id)" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <!-- hover 时的「选择/取消」文字提示，仅桌面端有意义；移动端靠右上角 ✓ 反馈 -->
          <div
            class="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors flex items-end justify-center pb-2 pointer-events-none"
          >
            <span
              :class="[
                'text-xs text-white bg-indigo-600 px-2 py-1 rounded transition-opacity',
                isMobile
                  ? 'opacity-0'
                  : 'opacity-0 group-hover:opacity-100',
              ]"
            >{{ selectedIds.has(img.id) ? '取消' : '选择' }}</span>
          </div>
        </div>

        <!-- 加载中 / 加载更多 -->
        <div v-if="loading" class="col-span-full py-4 text-center text-gray-400 text-sm">
          加载中…
        </div>
        <div v-else-if="hasNext" class="col-span-full py-2 text-center">
          <button class="text-xs text-indigo-600 hover:underline" @click="loadMore">加载更多</button>
        </div>
      </div>
    </div>

    <!-- 底部 footer：已选 N 张 + 限额进度 + 确认按钮。
         el-dialog 默认无 footer，用 template #footer 注入 -->
    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm text-gray-500">
          已选 <span class="font-semibold text-indigo-600">{{ selectedImages.length }}</span>
          <template v-if="hasLimit">
            <span class="text-gray-400">/ {{ maxSelect }}</span>
            <span class="ml-1" :class="isReachedLimit ? 'text-amber-600' : 'text-gray-400'">
              （剩余 {{ remainingQuota }} 张
              <template v-if="selectedImages.length > 0">
                · 点击图片可取消勾选
              </template>）
            </span>
          </template>
          <span v-else-if="selectedImages.length > 0" class="text-gray-400 ml-1">
            （点击图片可取消勾选）
          </span>
        </span>
        <div class="flex items-center gap-2">
          <el-button :disabled="submitting" @click="visible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="selectedImages.length === 0"
            @click="confirmPick"
          >
            {{ submitting ? '正在添加…' : `确认选择${selectedImages.length > 0 ? `（${selectedImages.length}）` : ''}` }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
  <ManualUploadDialog v-model="uploadVisible" @success="onUploadSuccess" />
</template>

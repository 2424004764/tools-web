<!--
  认领弹窗：用户声明「这张图已发布到某平台」。

  用法（父组件）：
    <ClaimDialog
      ref="claimDlgRef"
      :image-id="img.id"
      :current-claims="claimsByImageId[img.id] || []"
      :image-name="img.prompt || 'AI 创作图'"
      @saved="onClaimsUpdated"
    />
    claimDlgRef.value?.open()

  工作流：
    1. open() 时记录原 claims → 进入「勾选态」
    2. 用户勾选/输入自定义平台 → 改变本地勾选集
    3. 提交时对比「原集合 vs 新集合」：
       - 新增的 → claimImage
       - 取消的 → unclaimImage
    4. 提交成功 emit 'saved' 给父组件刷新本地缓存
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  PRESET_PLATFORMS,
  claimImage,
  unclaimImage,
} from '@/api/ai-creations'

const props = defineProps<{
  /** 当前要认领的图片 id */
  imageId: number
  /** 已认领的平台名数组（来自父组件本地缓存） */
  currentClaims: string[]
  /** 图片名/描述，只用于弹窗标题展示，可选 */
  imageName?: string
}>()

const emit = defineEmits<{
  /** 提交成功后通知父组件更新本地缓存 */
  (e: 'saved', payload: { imageId: number; claims: string[] }): void
}>()

// 弹窗可见性
const visible = ref(false)
const submitting = ref(false)

// 移动端检测：弹窗宽度按 isMobile 走 92vw / 480px
const isMobile = ref(false)
const MOBILE_BREAKPOINT = 640
const updateIsMobile = () => {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

// 打开弹窗时记录的原认领（用于 diff 计算增删）
const originalClaims = ref<string[]>([])
// 用户当前勾选的状态（含预设 + 自定义）
const selected = ref<Set<string>>(new Set())

// 自定义平台输入框
const customInput = ref('')
// 已经输入但尚未提交的自定义平台（红色 tag 显示在已选区上方）
const customAdded = ref<string[]>([])

// 自定义平台的建议列表：来自已勾选的 + 历史（这里只用本次会话累计的，不持久化）
// 仅展示当前已添加的自定义平台，预设不展示在 chip 区
const allSelected = computed(() => Array.from(selected.value))

const presetSelectedCount = computed(
  () => PRESET_PLATFORMS.filter((p) => selected.value.has(p)).length,
)

const totalSelected = computed(() => selected.value.size)

const isPreset = (name: string) =>
  (PRESET_PLATFORMS as readonly string[]).includes(name)

const open = () => {
  originalClaims.value = [...props.currentClaims]
  selected.value = new Set(props.currentClaims)
  customAdded.value = props.currentClaims.filter((p) => !isPreset(p))
  customInput.value = ''
  visible.value = true
}

const close = () => {
  visible.value = false
}

defineExpose({ open, close })

// 添加自定义平台（点击 + 或按回车）
const addCustom = () => {
  const name = customInput.value.trim()
  if (!name) return
  if (name.length > 30) {
    ElMessage.warning('平台名不能超过 30 字')
    return
  }
  if (selected.value.has(name)) {
    ElMessage.warning('该平台已选')
    customInput.value = ''
    return
  }
  selected.value.add(name)
  selected.value = new Set(selected.value)
  // 同步进 customAdded（如果不是预设）
  if (!isPreset(name) && !customAdded.value.includes(name)) {
    customAdded.value = [...customAdded.value, name]
  }
  customInput.value = ''
}

// 移除某个已选平台（红色 tag 上的 ×）
const removeOne = (name: string) => {
  selected.value.delete(name)
  selected.value = new Set(selected.value)
  if (!isPreset(name)) {
    customAdded.value = customAdded.value.filter((p) => p !== name)
  }
}

// 提交：对比 originalClaims vs selected，计算增删
const submit = async () => {
  if (submitting.value) return
  submitting.value = true
  try {
    const original = new Set(originalClaims.value)
    const next = selected.value
    // 新增
    const toAdd: string[] = []
    // 取消
    const toRemove: string[] = []
    for (const p of next) {
      if (!original.has(p)) toAdd.push(p)
    }
    for (const p of original) {
      if (!next.has(p)) toRemove.push(p)
    }

    // 并发发请求，任一失败则提示但不影响其它
    const tasks: Promise<any>[] = []
    for (const p of toAdd) tasks.push(claimImage(props.imageId, p))
    for (const p of toRemove) tasks.push(unclaimImage(props.imageId, p))
    const results = await Promise.allSettled(tasks)

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      ElMessage.warning(`有 ${failed} 项操作失败，请重试`)
    } else if (toAdd.length + toRemove.length > 0) {
      ElMessage.success('保存成功')
    }
    // 不管成功失败都 emit，让父组件用最新勾选集刷新本地缓存
    emit('saved', { imageId: props.imageId, claims: Array.from(next) })
    if (failed === 0) close()
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e?.message || '未知错误'))
  } finally {
    submitting.value = false
  }
}

// 当 visible 关闭时清掉残留状态
watch(visible, (v) => {
  if (!v) {
    customInput.value = ''
    customAdded.value = []
  }
})

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
    title="认领发布平台"
    :width="isMobile ? '92vw' : '480px'"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="space-y-4">
      <!-- 顶部信息 -->
      <p class="text-body-sm text-gray-600 leading-relaxed">
        标记这张图已经在哪些平台发布过，方便后续追踪。<br />
        <span class="text-caption text-gray-400">（仅你可见，私有记录）</span>
      </p>

      <!-- 预设平台：checkbox 列表 -->
      <div>
        <label class="block text-body-sm font-medium text-gray-700 mb-2">
          预设平台
          <span v-if="presetSelectedCount > 0" class="text-caption text-blue-600 ml-1">
            已选 {{ presetSelectedCount }} / {{ PRESET_PLATFORMS.length }}
          </span>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label
            v-for="p in PRESET_PLATFORMS"
            :key="p"
            :class="[
              'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
              selected.has(p)
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50',
            ]"
          >
            <el-checkbox
              :model-value="selected.has(p)"
              @change="(v: any) => {
                const checked = !!v;
                if (checked) selected.add(p); else selected.delete(p);
                selected = new Set(selected);
              }"
            />
            <span class="text-body-sm">{{ p }}</span>
          </label>
        </div>
      </div>

      <!-- 自定义平台：输入 + 已添加的 tag 列表 -->
      <div>
        <label class="block text-body-sm font-medium text-gray-700 mb-2">
          自定义平台
          <span class="text-caption text-gray-400 ml-1">（输入平台名，回车添加）</span>
        </label>
        <div class="flex gap-2 mb-2">
          <el-input
            v-model="customInput"
            placeholder="如：知乎 / B 站 / 即刻"
            maxlength="30"
            show-word-limit
            class="!flex-1"
            @keyup.enter="addCustom"
            :disabled="submitting"
          />
          <el-button
            type="primary"
            plain
            :disabled="!customInput.trim() || submitting"
            @click="addCustom"
          >
            添加
          </el-button>
        </div>
        <!-- 已添加的自定义平台 tag（红色 × 可移除） -->
        <div v-if="customAdded.length > 0" class="flex flex-wrap gap-1.5">
          <span
            v-for="name in customAdded"
            :key="name"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-body-sm"
          >
            {{ name }}
            <button
              type="button"
              class="ml-0.5 text-indigo-500 hover:text-red-500 transition-colors"
              :title="`移除「${name}」`"
              :disabled="submitting"
              @click="removeOne(name)"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      </div>

      <!-- 当前已选汇总 -->
      <div v-if="totalSelected > 0" class="px-3 py-2 rounded-lg bg-gray-50 text-body-sm text-gray-600">
        当前已选 <span class="font-semibold text-blue-600">{{ totalSelected }}</span> 个平台
        <span v-if="allSelected.length > 0" class="text-gray-400 ml-1">
          （{{ allSelected.join('、') }}）
        </span>
      </div>
    </div>

    <template #footer>
      <el-button @click="close" :disabled="submitting">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts">
export default { name: 'ClaimDialog' }
</script>

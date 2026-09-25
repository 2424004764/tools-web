<!--
  标签编辑弹窗：给某个创作合集增删标签（AI 生成 / 手动上传通用）。

  用法（父组件）：
    <TagEditDialog
      ref="tagDlgRef"
      :group-id="tagDialogGroup?.id ?? 0"
      :group-title="tagDialogGroup ? groupTitle(tagDialogGroup) : ''"
      :tags="tagDialogGroup?.tags ?? []"
      :suggestions="suggestedTags"
      @saved="onTagsSaved"
    />
    tagDlgRef.value?.open()

  保存调 PATCH /api/ai-creations/groups/:id { tags }，成功后 emit 'saved' 交给父组件
  更新本地 groups + 刷新标签聚合（不做乐观更新，失败留在弹窗内可重试）。
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  updateAiCreationGroupTags,
  parseTagInput,
  MAX_CREATION_TAGS,
  MAX_CREATION_TAG_LEN,
} from '@/api/ai-creations'

const props = defineProps<{
  /** 要编辑的合集 id */
  groupId: number
  /** 合集标题，仅用于弹窗内展示 */
  groupTitle?: string
  /** 当前标签（父组件传入，弹窗内拷贝编辑） */
  tags: string[]
  /** 建议标签（当前用户其它合集的标签聚合），点击快速添加 */
  suggestions?: string[]
}>()

const emit = defineEmits<{
  (e: 'saved', payload: { groupId: number; tags: string[] }): void
}>()

const visible = ref(false)
const submitting = ref(false)
const localTags = ref<string[]>([])
const input = ref('')

// 建议里排除已添加的
const availableSuggestions = computed(() =>
  (props.suggestions || []).filter((s) => !localTags.value.includes(s)).slice(0, 12),
)

const open = () => {
  localTags.value = [...props.tags]
  input.value = ''
  visible.value = true
}

const close = () => {
  visible.value = false
}

defineExpose({ open, close })

// 从输入框添加：支持一次粘贴多个（逗号分隔自动拆分）
const addFromInput = () => {
  const incoming = parseTagInput(input.value)
  input.value = ''
  if (incoming.length === 0) return
  for (const tag of incoming) {
    if (localTags.value.includes(tag)) continue
    if (localTags.value.length >= MAX_CREATION_TAGS) {
      ElMessage.warning(`最多 ${MAX_CREATION_TAGS} 个标签`)
      break
    }
    localTags.value.push(tag)
  }
}

const addSuggestion = (tag: string) => {
  if (localTags.value.includes(tag)) return
  if (localTags.value.length >= MAX_CREATION_TAGS) {
    ElMessage.warning(`最多 ${MAX_CREATION_TAGS} 个标签`)
    return
  }
  localTags.value.push(tag)
}

const removeOne = (tag: string) => {
  localTags.value = localTags.value.filter((t) => t !== tag)
}

const submit = async () => {
  if (submitting.value) return
  submitting.value = true
  try {
    // 后端权威归一化；本地直接用结果（前端 parseTagInput 规则一致）
    const next = parseTagInput(localTags.value)
    const res = await updateAiCreationGroupTags(props.groupId, next)
    ElMessage.success(next.length > 0 ? '标签已保存' : '标签已清空')
    emit('saved', { groupId: props.groupId, tags: res.tags || next })
    close()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || e?.message || '保存标签失败')
  } finally {
    submitting.value = false
  }
}

watch(visible, (v) => {
  if (!v) {
    input.value = ''
  }
})
</script>

<template>
  <el-dialog
    v-model="visible"
    title="编辑标签"
    width="min(480px, 92vw)"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="space-y-4">
      <p v-if="groupTitle" class="text-sm text-gray-600 leading-relaxed truncate" :title="groupTitle">
        合集：<span class="font-medium text-gray-800">{{ groupTitle }}</span>
      </p>
      <p class="text-xs text-gray-400 leading-relaxed">
        标签仅自己可见，用于筛选整理。AI 生成与手动上传的合集都可以打标签，默认为空。
      </p>

      <!-- 当前标签 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          已有标签
          <span class="text-xs text-gray-400 ml-1">（{{ localTags.length }} / {{ MAX_CREATION_TAGS }}）</span>
        </label>
        <div v-if="localTags.length > 0" class="flex flex-wrap gap-1.5">
          <el-tag
            v-for="tag in localTags"
            :key="tag"
            closable
            :disable-transitions="true"
            :disabled="submitting"
            @close="removeOne(tag)"
          >
            {{ tag }}
          </el-tag>
        </div>
        <p v-else class="text-xs text-gray-400">暂无标签，在下方输入添加</p>
        <div class="flex gap-2 mt-2">
          <el-input
            v-model="input"
            placeholder="输入标签，逗号分隔可一次加多个"
            :maxlength="MAX_CREATION_TAG_LEN"
            class="!flex-1"
            :disabled="submitting"
            @keyup.enter="addFromInput"
          />
          <el-button
            type="primary"
            plain
            :disabled="!input.trim() || submitting"
            @click="addFromInput"
          >
            添加
          </el-button>
        </div>
      </div>

      <!-- 建议标签：来自当前用户其它合集 -->
      <div v-if="availableSuggestions.length > 0">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          使用的标签
          <span class="text-xs text-gray-400 ml-1">（点击快速添加）</span>
        </label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in availableSuggestions"
            :key="s"
            type="button"
            class="px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            :disabled="submitting"
            @click="addSuggestion(s)"
          >
            + {{ s }}
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="close" :disabled="submitting">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts">
export default { name: 'TagEditDialog' }
</script>

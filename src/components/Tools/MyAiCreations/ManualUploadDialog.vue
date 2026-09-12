<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus, Upload } from '@element-plus/icons-vue'
import {
  saveManualAiCreationFiles,
  fetchAiCreations,
  type ManualUploadFile,
  type ManualUploadResult,
} from '@/api/ai-creations'

const MAX_FILES = 8

type UploadEntry = ManualUploadFile & {
  id: string
  previewUrl: string
  extension: string
  filenameBase: string
}

const props = withDefaults(defineProps<{
  modelValue?: boolean
  title?: string
  category?: string
}>(), {
  modelValue: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'success': [payload: ManualUploadResult & { refresh: () => Promise<Awaited<ReturnType<typeof fetchAiCreations>> | void> }]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const entries = ref<UploadEntry[]>([])
const uploading = ref(false)
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function splitFilename(name: string) {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { filenameBase: name || 'image', extension: '' }
  return { filenameBase: name.slice(0, dot), extension: name.slice(dot) }
}

function addFiles(selected: FileList | File[]) {
  const available = MAX_FILES - entries.value.length
  const files = Array.from(selected).filter((file) => file.type.startsWith('image/')).slice(0, available)
  if (files.length === 0) {
    if (available <= 0) ElMessage.warning(`最多上传 ${MAX_FILES} 张图片`)
    else ElMessage.warning('请选择图片文件')
    return
  }
  if (files.length < Array.from(selected).length) ElMessage.warning(`最多上传 ${MAX_FILES} 张图片，非图片文件已跳过`)
  files.forEach((file) => {
    const { filenameBase, extension } = splitFilename(file.name)
    const previewUrl = URL.createObjectURL(file)
    const image = new Image()
    const entry: UploadEntry = {
      id: `${Date.now()}-${Math.random()}`,
      file,
      filename: file.name,
      filenameBase,
      extension,
      previewUrl,
    }
    image.onload = () => {
      entry.width = image.naturalWidth
      entry.height = image.naturalHeight
    }
    image.src = previewUrl
    entries.value.push(entry)
  })
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) addFiles(input.files)
  input.value = ''
}

function removeEntry(index: number) {
  URL.revokeObjectURL(entries.value[index]?.previewUrl || '')
  entries.value.splice(index, 1)
}

function onFilenameInput(entry: UploadEntry, value: string) {
  entry.filenameBase = value
  entry.filename = `${value || 'image'}${entry.extension}`
}

function reset() {
  entries.value.forEach((entry) => URL.revokeObjectURL(entry.previewUrl))
  entries.value = []
}

function close() {
  if (!uploading.value) visible.value = false
}

async function submit() {
  if (uploading.value || entries.value.length === 0) {
    if (entries.value.length === 0) ElMessage.warning('请先选择图片')
    return
  }
  uploading.value = true
  try {
    const result = await saveManualAiCreationFiles(
      entries.value.map(({ file, filename, width, height }) => ({ file, filename, width, height })),
      { title: props.title, category: props.category },
    )
    ElMessage.success(`已上传 ${result.inserted} 张图片`)
    emit('success', {
      ...result,
      refresh: () => fetchAiCreations({ source: 'manual_upload' }),
    })
    visible.value = false
    reset()
  } catch (error: any) {
    ElMessage.error(error?.message || '上传失败，请重试')
  } finally {
    uploading.value = false
  }
}

watch(visible, async (isVisible) => {
  if (!isVisible && !uploading.value) {
    await nextTick()
    reset()
  }
})

defineExpose({ open: () => { visible.value = true }, close })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="上传到我的创作"
    width="min(680px, 92vw)"
    append-to-body
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="manual-upload-dialog">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        hidden
        @change="onFileChange"
      />
      <button class="dropzone" type="button" :disabled="uploading" @click="fileInput?.click()">
        <el-icon :size="28"><Upload /></el-icon>
        <span>选择图片</span>
        <small>支持多选，最多 {{ MAX_FILES }} 张</small>
      </button>

      <div v-if="entries.length" class="file-list">
        <div v-for="(entry, index) in entries" :key="entry.id" class="file-row">
          <img :src="entry.previewUrl" :alt="entry.filename" class="preview" />
          <el-input
            :model-value="entry.filenameBase"
            :disabled="uploading"
            aria-label="文件名"
            @update:model-value="onFilenameInput(entry, String($event))"
          >
            <template #append>{{ entry.extension || '无扩展名' }}</template>
          </el-input>
          <el-button
            text
            type="danger"
            :icon="Delete"
            :disabled="uploading"
            :aria-label="`移除 ${entry.filename}`"
            @click="removeEntry(index)"
          />
        </div>
      </div>
    </div>
    <template #footer>
      <el-button :disabled="uploading" @click="close">取消</el-button>
      <el-button type="primary" :loading="uploading" :icon="Plus" @click="submit">上传</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.manual-upload-dialog { display: grid; gap: 16px; }
.dropzone { min-height: 116px; display: grid; place-items: center; gap: 6px; border: 1px dashed #b8c2cc; border-radius: 6px; background: #f8fafc; color: #344054; cursor: pointer; }
.dropzone:hover:not(:disabled) { border-color: #409eff; background: #f0f7ff; }
.dropzone:disabled { cursor: not-allowed; opacity: .65; }
.dropzone small { color: #98a2b3; }
.file-list { display: grid; gap: 10px; max-height: 360px; overflow-y: auto; }
.file-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) 32px; align-items: center; gap: 10px; }
.preview { width: 48px; height: 48px; object-fit: cover; border-radius: 4px; background: #eef2f6; }
</style>

<script lang="ts">
export default { name: 'ManualUploadDialog' }
</script>
